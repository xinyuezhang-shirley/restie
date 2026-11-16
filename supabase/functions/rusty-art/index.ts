// Rusty's drawings: a Supabase Edge Function that makes a picture for a hobby
// that isn't in the built-in set (or an illustration for a keepsake), checks
// it, and only hands back pictures that pass.
//
//   1. plan     Claude picks what to draw and writes the image prompt, in the
//               room's style.
//   2. draw     an OpenAI image model draws it, with the app's own art passed
//               in as style references (transparent PNG).
//   3. check    pixels: transparent background, no white halo, margins,
//               a single object of sensible size.
//               Claude, looking at it next to the references: appropriate?
//               shows the subject? makes sense? same style? reads as an object
//               in the room? (1–5 each; pass = relevant, logical, style ≥ 4,
//               composition and room fit ≥ 3, no text, pixels ok).
//   4. retry    at most twice, with the problems fed back into the prompt.
//   5. store    passing images go to the private `generated` bucket; every
//               attempt is recorded in generated_assets with its checks.
//
// Keys and limits (Supabase → Edge Functions → Secrets), never in the app:
//   OPENAI_API_KEY      required for drawing (without it: status "not_configured")
//   IMAGE_MONTHLY_CAP   images per person per month, retries included (default 9)
//   IMAGE_MODEL         default gpt-image-2.5-flare
//   IMAGE_QUALITY       default medium
//   STYLE_REF_BASE      where the reference art is served (default the web app)
//   ANTHROPIC_API_KEY   (already set for Rusty) for planning and checking

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { decode } from 'npm:fast-png@8.0.0';
import { decodeBase64, encodeBase64 } from 'jsr:@std/encoding@1/base64';

const MODEL = Deno.env.get('RUSTY_MODEL') ?? 'claude-opus-5-5';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
const IMAGE_MODEL = Deno.env.get('IMAGE_MODEL') ?? 'gpt-image-2.5-flare';
const IMAGE_QUALITY = Deno.env.get('IMAGE_QUALITY') ?? 'medium';
const CAP = Number(Deno.env.get('IMAGE_MONTHLY_CAP') ?? 9);
const REF_BASE = Deno.env.get('STYLE_REF_BASE') ?? 'https://restie.vercel.app/style-refs';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_ATTEMPTS = 3;
/** stop starting new attempts after this, so the request finishes in time */
const BUDGET_MS = 80_000;

const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Kind = 'hobby' | 'keepsake';

const STYLE = `Style (match the reference images exactly): a soft hand-painted watercolor and colored-pencil sticker; thin, slightly wobbly warm-brown outline; muted warm palette (cream, honey, terracotta, sage, soft brown; no neon, no pure black); gentle paper grain; seen slightly from above like furniture in a cozy room; one single object, centered, with generous empty margin all around; transparent background; no text, letters, numbers, logos or watermarks; no people; cute and cozy.`;

const REFS: Record<Kind, string[]> = {
  hobby: ['guitar.png', 'drawing.png', 'baking.png'],
  keepsake: ['object-notebook.png', 'object-sourdough.png', 'reading.png'],
};

const str = { type: 'string' };
const int = { type: 'integer' };
const bool = { type: 'boolean' };
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

async function ask<T>(content: Anthropic.Beta.BetaContentBlockParam[] | string, schema: object, effort: 'low' | 'medium'): Promise<T> {
  const res = (await claude.beta.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content }],
    output_config: { effort, format: { type: 'json_schema', schema } },
  } as never)) as unknown as Anthropic.Beta.BetaMessage;
  const text = res.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('no text from planner/judge');
  return JSON.parse(text.text) as T;
}

/* ------------------------------------------------------------------ plan */

async function plan(kind: Kind, subject: string, detail: string, feedback: string) {
  return ask<{ object: string; prompt: string }>(
    `You are the art director for Restie, a cozy app where an orange tabby cat named Rusty keeps hobbies in his little room.
${
  kind === 'hobby'
    ? `Draw the one object that best says the hobby "${subject}" and that a cat could keep in his room (e.g. pottery → a small glazed bowl on a tiny wheel; running → a pair of worn sneakers; chess → a small chess board mid-game).`
    : `Draw a small keepsake illustration of this memory: "${subject}"${detail ? ` (${detail})` : ''}: one object or tiny vignette that captures it.`
}
${feedback ? `The last attempt had these problems, fix them: ${feedback}\n` : ''}${STYLE}
Return "object" (what you'll draw, under 8 words) and "prompt" (the full image prompt, under 120 words, including the style).`,
    obj({ object: str, prompt: str }),
    'low',
  );
}

/* ------------------------------------------------------------------ draw */

async function draw(prompt: string, refs: string[], who: string): Promise<Uint8Array> {
  const base = { model: IMAGE_MODEL, prompt, size: '1024x1024', quality: IMAGE_QUALITY, background: 'transparent', output_format: 'png', n: 1, safety_identifier: who };
  const call = (path: string, body: object) =>
    fetch(`https://api.openai.com/v1/images/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  // With the app's own art as style references; plain generation if that fails.
  let r = refs.length ? await call('edits', { ...base, images: refs.map((b) => ({ image_url: `data:image/png;base64,${b}` })) }) : null;
  if (!r || !r.ok) {
    if (r) console.warn('[rusty-art] edits failed', r.status, (await r.text()).slice(0, 300));
    r = await call('generations', base);
  }
  if (!r.ok) throw new Error(`image model ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error('image model returned no image');
  return decodeBase64(b64);
}

/* ---------------------------------------------------------------- checks */

/** Pixel checks that don't need a model. */
function pixelChecks(png: Uint8Array) {
  const problems: string[] = [];
  let img;
  try {
    img = decode(png);
  } catch {
    return { ok: false, problems: ['not a valid PNG'], coverage: 0 };
  }
  const { width: w, height: h, channels, data } = img;
  const max = img.depth === 16 ? 65535 : 255;
  if (channels !== 4) return { ok: false, problems: ['the background is not transparent (no alpha channel)'], coverage: 1 };
  const a = (x: number, y: number) => (data[(y * w + x) * 4 + 3] as number) / max;
  // corners must be see-through
  const corner = (x0: number, y0: number) => {
    let s = 0;
    for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) s += a(x, y);
    return s / 64;
  };
  if ([corner(0, 0), corner(w - 8, 0), corner(0, h - 8), corner(w - 8, h - 8)].some((v) => v > 0.05)) problems.push('the background is not transparent at the corners');
  // the object: its box, how much it fills, and a white fringe at its edges
  let x0 = w, y0 = h, x1 = 0, y1 = 0, solid = 0, edge = 0, white = 0;
  const step = 2;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const al = a(x, y);
      if (al > 0.12) {
        solid++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (al > 0.15 && al < 0.8) {
        edge++;
        const i = (y * w + x) * 4;
        if ([0, 1, 2].every((c) => (data[i + c] as number) / max > 0.92)) white++;
      }
    }
  }
  const coverage = solid / ((w / step) * (h / step));
  if (coverage < 0.05) problems.push('the object is too small or missing');
  if (coverage > 0.7) problems.push('the object fills the whole image; leave empty margin around it');
  const margin = Math.min(x0, y0, w - 1 - x1, h - 1 - y1) / w;
  if (solid && margin < 0.025) problems.push('the object touches the edge of the image; center it with margin');
  if (edge > 50 && white / edge > 0.35) problems.push('there is a white halo around the object; cut it out cleanly');
  return { ok: problems.length === 0, problems, coverage: Math.round(coverage * 100) / 100 };
}

interface Verdict {
  appropriate: boolean;
  hasText: boolean;
  shows: string;
  relevant: number;
  logical: number;
  style: number;
  composition: number;
  roomFit: number;
  problems: string;
}

/** Claude looks at it next to the reference art. */
async function judge(kind: Kind, subject: string, png: Uint8Array, refs: string[]): Promise<Verdict> {
  const image = (data: string) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data } });
  return ask<Verdict>(
    [
      { type: 'text', text: 'Reference art from the app (the target style):' },
      ...refs.map(image),
      { type: 'text', text: `The new image, meant to show ${kind === 'hobby' ? `the hobby "${subject}"` : `the memory "${subject}"`}:` },
      image(encodeBase64(png)),
      {
        type: 'text',
        text: `Check the new image strictly. Score 1–5 (5 = perfect):
- relevant: someone would recognize it as ${kind === 'hobby' ? `"${subject}"` : 'that memory'} at a glance.
- logical: it makes sense (correct object, plausible proportions, nothing broken or nonsensical).
- style: matches the references (watercolor and pencil look, thin warm-brown outline, muted warm palette, paper grain, same level of detail).
- composition: one object, centered, clean cut-out, nothing cropped.
- roomFit: would sit naturally as a small object on a desk or floor in the cozy room the references come from (perspective slightly from above, matching scale and light). ${kind === 'keepsake' ? 'Give 5 if not applicable.' : ''}
Also: "appropriate" (safe for everyone, nothing scary or inappropriate), "hasText" (any letters, numbers, logos or watermarks), "shows" (what it actually shows, under 10 words), and "problems" (concrete fixes for the next attempt, or "").`,
      },
    ],
    obj({ appropriate: bool, hasText: bool, shows: str, relevant: int, logical: int, style: int, composition: int, roomFit: int, problems: str }),
    'medium',
  );
}

// Framing (margins, clean cut-out, size) is measured exactly by the pixel checks, so the
// judge's composition score only needs to be "okay"; everything else must be good.
const passes = (v: Verdict, pix: { ok: boolean }) =>
  v.appropriate && !v.hasText && v.relevant >= 4 && v.logical >= 4 && v.style >= 4 && v.composition >= 3 && v.roomFit >= 3 && pix.ok;

/* ------------------------------------------------------------- the cap */

const month = () => new Date().toISOString().slice(0, 7);
async function used(user: string) {
  const { data } = await admin.from('image_usage').select('count').eq('user_id', user).eq('month', month()).maybeSingle();
  return (data?.count as number | undefined) ?? 0;
}
async function spend(user: string) {
  const n = (await used(user)) + 1;
  await admin.from('image_usage').upsert({ user_id: user, month: month(), count: n });
  return n;
}

async function refsFor(kind: Kind): Promise<string[]> {
  const out: string[] = [];
  for (const name of REFS[kind]) {
    try {
      const r = await fetch(`${REF_BASE}/${name}`);
      // only real PNGs (a web app's catch-all route answers 200 with its HTML page)
      const bytes = r.ok && (r.headers.get('content-type') ?? '').includes('image/png') ? new Uint8Array(await r.arrayBuffer()) : null;
      if (bytes && bytes[0] === 0x89 && bytes[1] === 0x50) out.push(encodeBase64(bytes));
    } catch {
      /* draw without that one */
    }
  }
  return out;
}

async function hashId(id: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  return encodeBase64(new Uint8Array(d)).replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
}

/* -------------------------------------------------------------- handler */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const { data: who } = await createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } }).auth.getUser();
  const user = who?.user?.id;
  if (!user) return json({ error: 'sign in first' }, 401);

  let body: { action?: string; kind?: Kind; subject?: string; detail?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const kind: Kind = body.kind === 'keepsake' ? 'keepsake' : 'hobby';
  const subject = (body.subject ?? '').trim().slice(0, 120);

  // How much paint is left this month.
  if (body.action === 'status') {
    const n = await used(user);
    return json({ configured: !!OPENAI_KEY, cap: CAP, used: n, left: Math.max(0, CAP - n), model: IMAGE_MODEL });
  }

  // Run only the checks on a given image (for the QA test script; no drawing, no cap).
  if (body.action === 'check') {
    if (!body.image || !subject) return json({ error: 'image and subject required' }, 400);
    try {
      const png = decodeBase64(body.image);
      const pix = pixelChecks(png);
      const verdict = await judge(kind, subject, png, await refsFor(kind));
      return json({ pass: passes(verdict, pix), pixels: pix, verdict });
    } catch (e) {
      return json({ error: `check failed: ${String(e).slice(0, 300)}` }, 500);
    }
  }

  if (body.action !== 'generate' || !subject) return json({ error: 'action "generate" with a subject' }, 400);
  if (!OPENAI_KEY) return json({ status: 'not_configured' });
  if ((await used(user)) >= CAP) return json({ status: 'cap', left: 0 });

  const t0 = Date.now();
  const refs = await refsFor(kind);
  const safety = await hashId(user);
  const tries: { object: string; pixels: ReturnType<typeof pixelChecks>; verdict?: Verdict; error?: string }[] = [];
  let feedback = '';
  try {
    for (let i = 0; i < MAX_ATTEMPTS && Date.now() - t0 < BUDGET_MS; i++) {
      if ((await used(user)) >= CAP) break;
      const p = await plan(kind, subject, body.detail ?? '', feedback);
      await spend(user);
      let png: Uint8Array;
      try {
        png = await draw(p.prompt, refs, safety);
      } catch (e) {
        tries.push({ object: p.object, pixels: { ok: false, problems: [], coverage: 0 }, error: String(e).slice(0, 200) });
        break; // the model is down or refused: don't burn the cap
      }
      const pixels = pixelChecks(png);
      const verdict = await judge(kind, subject, png, refs);
      tries.push({ object: p.object, pixels, verdict });
      if (passes(verdict, pixels)) {
        const id = crypto.randomUUID();
        const path = `${user}/${id}.png`;
        const up = await admin.storage.from('generated').upload(path, png, { contentType: 'image/png', upsert: false });
        if (up.error) throw up.error;
        await admin.from('generated_assets').insert({ id, user_id: user, kind, subject, path, status: 'ready', attempts: i + 1, qa: { tries } });
        const { data: signed } = await admin.storage.from('generated').createSignedUrl(path, 7 * 24 * 3600);
        return json({ status: 'ready', id, path, url: signed?.signedUrl ?? null, object: p.object, verdict, left: Math.max(0, CAP - (await used(user))) });
      }
      feedback = [...pixels.problems, verdict.problems].filter(Boolean).join('; ');
    }
  } catch (e) {
    console.error('[rusty-art] failed', String(e).slice(0, 300));
    return json({ status: 'error', error: 'something went wrong while drawing' }, 500);
  }
  await admin.from('generated_assets').insert({ user_id: user, kind, subject, status: 'failed', attempts: tries.length, qa: { tries } });
  return json({ status: 'failed', tries: tries.map((t) => ({ object: t.object, problems: [...t.pixels.problems, t.verdict?.problems ?? t.error ?? ''].filter(Boolean) })), left: Math.max(0, CAP - (await used(user))) });
});
