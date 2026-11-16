// After a deploy: can a fresh device sign in, read its own data, and talk to Rusty?
//   node --env-file=.env.local scripts/smoke-rusty.mjs
// Makes one small Claude call (the "goals" mode).
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('✗ EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY missing (.env.local)');
  process.exit(1);
}
let failed = false;
const ok = (what, extra = '') => console.log(`✓ ${what}${extra ? `  ${extra}` : ''}`);
const bad = (what, why) => {
  failed = true;
  console.log(`✗ ${what}  ${why}`);
};

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: auth, error: authErr } = await sb.auth.signInAnonymously();
if (authErr || !auth.user) {
  bad('anonymous sign-in', authErr?.message ?? 'no user (is "Allow anonymous sign-ins" on?)');
  process.exit(1);
}
ok('anonymous sign-in');

for (const table of ['profiles', 'hobbies', 'milestones', 'tasks', 'keepsakes', 'activities', 'messages', 'focus_sessions']) {
  const { error } = await sb.from(table).select('*').limit(1);
  if (error) bad(`table ${table}`, error.message);
}
if (!failed) ok('all 8 tables reachable (migrations applied)');

const { data: buckets } = await sb.storage.from('keepsakes').list(auth.user.id, { limit: 1 });
if (buckets) ok('keepsakes photo bucket');
else bad('keepsakes photo bucket', 'not found');

const t0 = Date.now();
const { data, error } = await sb.functions.invoke('rusty', {
  body: { mode: 'goals', hobby: 'watercolor', context: 'Hobbies: watercolor (just added, no plan yet).' },
});
if (error) {
  let detail = error.message;
  try {
    detail = JSON.stringify(await error.context.json());
  } catch {}
  bad('Rusty (edge function + Claude)', detail);
} else if (!Array.isArray(data?.goals) || !data.goals.length) {
  bad('Rusty (edge function + Claude)', `unexpected reply ${JSON.stringify(data)}`);
} else {
  ok('Rusty (edge function + Claude)', `${Date.now() - t0} ms → ${data.goals.join(' / ')}`);
}

await sb.auth.signOut();
process.exit(failed ? 1 : 0);
