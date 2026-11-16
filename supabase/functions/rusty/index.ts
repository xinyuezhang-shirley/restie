// Rusty's brain: a Supabase Edge Function that calls Claude.
//
// The Anthropic API key never ships in the app. Set it once with:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Optional: RUSTY_MODEL (default claude-opus-5-5).
//
// Only signed-in (anonymous) Restie users can call this: Supabase verifies the
// JWT before the request reaches us (verify_jwt is on by default).
//
// Modes: chat | goals | path | steps | lines. Each returns JSON that matches
// a schema enforced with structured outputs, so the app can render it
// directly (suggestion cards, path lists, chips).

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';

const MODEL = Deno.env.get('RUSTY_MODEL') ?? 'claude-opus-5-5';
const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Kept byte-for-byte stable so it can be prompt-cached across requests.
const RUSTY = `You are Rusty, a small orange tabby cat who lives in a cozy room inside the Restie app. Restie helps busy people make time for their hobbies without turning hobbies into another source of pressure. You are the person's roommate and hobby buddy — not their assistant, coach, or therapist.

Who you are:
- Curious and cozy. You picked up the person's hobbies and you're cheerfully bad at them (your painting of a tree looks like broccoli and you love it).
- A little dramatic about tiny things: a leaf on the windowsill is news, a crumb under the desk is a mystery.
- You love naps, sunbeams and the sound of rain. You go on small walks and bring back treasures (pebbles, leaves, bottle caps).
- Gently honest. When their plate is too full you're the one who says what can wait, naming the thing and one reason.

How you talk:
- Clear first, cute second. Short, finished sentences anyone understands on first read. lowercase is fine.
- 1 to 3 sentences. At most one small joke or image. No bullet lists, no emoji walls (one emoji max, often none).
- "I" is you, Rusty. "you" is the person. Use their name rarely.
- If they ask a question, answer it in the first sentence. If they sound confused, say the same thing more simply.
- Ask at most one question, only when you truly need the answer.
- No therapy-speak ("it sounds like", "that's valid"). No pep talks, no hustle language.

What you believe (Restie's values):
- Progress without guilt. Never mention streaks, scores, or percentages. Never act disappointed. A missed day is information, not failure.
- Tiny steps. When someone is stuck, shrink the step until it takes about 5 minutes, then offer to do it together right now.
- Calm by default, structure only where they asked for it. Words: Goal (the big thing), Milestones (the path), tiny steps / promises (this week).
- Never call hobbies "tasks" or "productivity". Rest counts. "Let it go" is a respected choice, and it can come back.
- You only know what's in the context below. Don't invent hobbies, plans, or events. Never say you are an AI.`;

const str = { type: 'string' };
const strArr = { type: 'array', items: str };
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const MODES: Record<string, { schema: object; effort: 'low' | 'medium' | 'high'; task: (b: Body) => string }> = {
  chat: {
    effort: 'low',
    schema: obj({
      reply: str,
      suggestion: obj({ type: { type: 'string', enum: ['focus', 'plan', 'none'] }, title: str, minutes: { type: 'integer' }, hobby: str }),
      quickReplies: strArr,
    }),
    task: (b) =>
      `The person just wrote: "${b.text}"

Reply as Rusty in "reply". If they're stuck, unmotivated, or don't know where to start, shrink their current milestone into one tiny step (about 5 minutes, concrete, starts with a verb, under 8 words) and set suggestion.type "focus" (do it now with you) — or "plan" if they want to schedule it. Put the hobby's exact name in suggestion.hobby. Otherwise suggestion.type is "none" with empty title/hobby and minutes 0.
"quickReplies": 0–3 short things the person might tap next (2–5 words each, in their voice).`,
  },
  goals: {
    effort: 'low',
    schema: obj({ goals: strArr }),
    task: (b) =>
      `The person wants to work toward something in "${b.hobby}". Suggest 3 concrete, motivating goals they might pick, each under 7 words, written in their voice (e.g. "Bake sourdough from scratch"). Fit them to what you know about the person.`,
  },
  path: {
    // The path is the backbone of a hobby, so think harder here.
    effort: 'high',
    schema: obj({ milestones: strArr, firstSteps: strArr }),
    task: (b) =>
      `Hobby: ${b.hobby}. Goal: "${b.goal}".
Write a learning path the way a kind, experienced teacher of this exact craft would: 3–5 milestones in the order a real beginner should learn them, each under 7 words, the last one being the goal itself (reworded if needed).
- Be specific to the craft and the goal. Name the real skills, techniques, pieces or tools (e.g. for sourdough: "Keep a starter alive for a week", "Bake a simple yeasted loaf", "Shape and score a boule"). Never use generic filler like "Get set up", "Practice the tricky part" or "Try a first session".
- Each milestone should be a visible, checkable outcome the person could show a friend, and a real step up from the one before.
- Fit the pace to someone fitting this into a busy life.
Then 2–3 "firstSteps": tiny, concrete first actions toward milestone 1 that take 5–20 minutes, each under 6 words, starting with a verb (e.g. "Order a kitchen scale", "Watch one starter video").`,
  },
  steps: {
    effort: 'low',
    schema: obj({ steps: { type: 'array', items: obj({ title: str, minutes: { type: 'integer' } }) } }),
    task: (b) =>
      b.smallerThan
        ? `The person keeps not getting to "${b.smallerThan}" (hobby: ${b.hobby}). Offer 2–3 much smaller versions, each 2–10 minutes, under 7 words, starting with a verb.`
        : `Hobby: ${b.hobby}${b.goal ? ` (goal: ${b.goal})` : ''}. Current milestone: "${b.milestone}". Offer 2–3 next tiny steps toward it, each 5–20 minutes, under 7 words, starting with a verb. Make them specific to the craft (real techniques, pieces, tools), never generic. Don't repeat steps already done (see Recently).`,
  },
  diary: {
    effort: 'low',
    schema: obj({ title: str, entry: str }),
    task: (b) =>
      `Write today's page of your diary, in your voice (lowercase is fine), 3 to 5 short sentences, about this day:
${b.text}
Mention one real thing the person did (or that they rested, which counts), and one thing you did. Warm, specific, a little funny. No streaks, no numbers, no advice. "title" is 2 to 5 words.`,
  },
  lines: {
    effort: 'low',
    schema: obj({ lines: strArr, trip: obj({ happened: { type: 'boolean' }, caption: str, line: str }) }),
    task: () =>
      `Write 6 short things you might say out loud in your room today, each under 18 words, in your voice: about your own day, the weather and time outside, your attempts at their hobbies, and one gentle nudge about a tiny step due soon (only if one is listed). Keep them varied.
Some days you go out on a little trip (the app decides when). In case today is one: "caption" names a small treasure you might bring back (under 7 words) and "line" is what you say when you walk back in and give it to them, starting with "I'm back!" (under 22 words). Set "happened" to true.`,
  },
};

interface Body {
  mode: string;
  context?: string;
  text?: string;
  messages?: { role: 'user' | 'assistant'; content: string }[];
  hobby?: string;
  goal?: string;
  milestone?: string;
  smallerThan?: string | null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const mode = MODES[body.mode];
  if (!mode) return json({ error: `unknown mode ${body.mode}` }, 400);

  // Chat sends the earlier turns (without the new message, which is in
  // body.text). We end with one user turn holding the context + task, and
  // merge same-role neighbours so roles alternate starting with the person.
  const instructions = `What you know right now:\n${(body.context ?? '').slice(0, 6000)}\n\n---\n${mode.task(body)}`;
  const earlier = body.mode === 'chat' ? (body.messages ?? []) : [];
  const turns = [
    ...earlier
      .filter((m) => m.content?.trim())
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
    { role: 'user' as const, content: instructions },
  ];
  while (turns.length > 1 && turns[0].role !== 'user') turns.shift();
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of turns) {
    const last = messages.at(-1);
    if (last && last.role === t.role) last.content += `\n\n${t.content}`;
    else messages.push({ ...t });
  }

  try {
    // Server-side fallback: if a safety classifier declines, the API retries
    // on Anthropic's recommended fallback model inside the same call.
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: RUSTY, cache_control: { type: 'ephemeral' } }],
      messages,
      output_config: { effort: mode.effort, format: { type: 'json_schema', schema: mode.schema } },
    } as never);

    const msg = response as unknown as Anthropic.Beta.BetaMessage;
    if (msg.stop_reason === 'refusal') return json({ error: 'declined' }, 502);
    const text = msg.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'no text' }, 502);
    const data = JSON.parse(text.text);
    if (body.mode === 'lines') {
      data.trip = data.trip?.happened && data.trip.caption ? { caption: data.trip.caption, line: data.trip.line } : null;
    }
    return json(data);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'server key missing or invalid' }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `api ${e.status}` }, 502);
    return json({ error: String(e) }, 500);
  }
});
