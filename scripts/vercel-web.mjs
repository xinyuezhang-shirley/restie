// Point the GitHub-connected Vercel project "restie" at Supabase and rebuild production.
//   node --env-file=.env.deploy.local --env-file=.env.local scripts/vercel-web.mjs
// Uses Vercel's REST API (works with team-scoped vcp_ tokens, which the CLI rejects).
// Pushing to main also redeploys; this is for when env vars change.
const token = process.env.VERCEL_TOKEN;
const env = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
if (!token) throw new Error('VERCEL_TOKEN missing (.env.deploy.local)');
if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('.env.local missing: deploy Supabase first');

async function api(path, init = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} → ${res.status} ${body.error?.message ?? ''}`);
  return body;
}

const { projects } = await api('/v9/projects?search=restie&limit=20');
const project = projects.find((p) => p.name === 'restie');
if (!project) throw new Error('No Vercel project named "restie": import the GitHub repo first');
const q = `teamId=${project.accountId}`;

await api(`/v10/projects/${project.id}/env?upsert=true&${q}`, {
  method: 'POST',
  body: JSON.stringify(
    Object.entries(env).map(([key, value]) => ({ key, value, type: 'plain', target: ['production', 'preview', 'development'] })),
  ),
});
console.log('✓ env vars set:', Object.keys(env).join(', '));

const { deployments } = await api(`/v6/deployments?projectId=${project.id}&target=production&limit=1&${q}`);
if (!deployments?.length) throw new Error('No production deployment yet: push to main once');
const dep = await api(`/v13/deployments?forceNew=1&${q}`, {
  method: 'POST',
  body: JSON.stringify({ name: project.name, deploymentId: deployments[0].uid, target: 'production' }),
});
console.log(`… rebuilding production (${dep.id})`);

for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const d = await api(`/v13/deployments/${dep.id}?${q}`);
  if (d.readyState === 'READY') {
    const alias = project.targets?.production?.alias?.find((a) => !a.includes(project.accountId)) ?? d.url;
    console.log(`✓ live: https://${project.alias?.[0]?.domain ?? alias}`);
    process.exit(0);
  }
  if (d.readyState === 'ERROR' || d.readyState === 'CANCELED') throw new Error(`build ${d.readyState}: https://vercel.com (project restie → Deployments)`);
}
throw new Error('timed out waiting for the build (check the Vercel dashboard)');
