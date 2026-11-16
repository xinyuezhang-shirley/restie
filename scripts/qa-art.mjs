// Rusty's drawing checks, tested: real app art must pass, deliberate failures must fail.
//   python3 scripts/make-qa-images.py /tmp/qa && node --env-file=.env.local scripts/qa-art.mjs /tmp/qa
// Calls the `rusty-art` function's "check" action (Claude looks at each image; no drawing, no cap).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const dir = process.argv[2];
const cases = [
  ['good-guitar.png', 'guitar', true],
  ['good-drawing.png', 'painting', true],
  ['good-reading.png', 'reading', true],
  ['bad-white-bg.png', 'guitar', false],
  ['bad-neon.png', 'painting', false],
  ['bad-text.png', 'guitar', false],
  ['bad-wrong-subject.png', 'chess', false],
  ['bad-too-big.png', 'reading', false],
];
const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInAnonymously();
let wrong = 0;
for (const [file, subject, expect] of cases) {
  const image = readFileSync(join(dir, file)).toString('base64');
  const { data, error } = await sb.functions.invoke('rusty-art', { body: { action: 'check', kind: 'hobby', subject, image } });
  if (error) {
    wrong++;
    let detail = error.message;
    try {
      detail = `${error.context.status} ${await error.context.text()}`;
    } catch {}
    console.log(`✗ ${file}: ${detail}`);
    continue;
  }
  const v = data.verdict;
  const ok = data.pass === expect;
  if (!ok) wrong++;
  console.log(
    `${ok ? '✓' : '✗'} ${file.padEnd(24)} expected ${expect ? 'pass' : 'fail'}, got ${data.pass ? 'pass' : 'fail'} · ` +
      `rel ${v.relevant} logic ${v.logical} style ${v.style} comp ${v.composition} room ${v.roomFit}${v.hasText ? ' TEXT' : ''}${v.appropriate ? '' : ' INAPPROPRIATE'}` +
      `${data.pixels.problems.length ? ` · pixels: ${data.pixels.problems.join('; ')}` : ''} · shows: ${v.shows}`,
  );
}
await sb.auth.signOut();
console.log(wrong ? `\n${wrong} case(s) wrong` : '\nall checks behaved as expected');
process.exit(wrong ? 1 : 0);
