# Browser agent prompt: accounts and tokens for deploying Restie

Paste everything below the line into your browser agent. When it finishes, copy its final block into
`.env.deploy.local` at the repo root and run `bash scripts/deploy.sh` (or ask Claude Code to).

---

I'm deploying a small student app called **Restie**. I need you to set up three web accounts and hand me back a
few values. Work in my already signed-in browser. If a site asks me to sign in or verify (password, 2FA, email
code, CAPTCHA), stop and ask me to do it, then continue. Don't change billing plans or add payment methods.

## 1. Supabase (supabase.com/dashboard)

1. Sign in (or sign up with GitHub if I have no account).
2. Look for an existing project named **restie**. If there isn't one, create it:
   - Organization: my personal/default one (free plan).
   - Name: `restie`.
   - Database password: click **Generate a password**, then copy it before you continue. You'll need it at the end.
   - Region: **West US (North California)**.
   - If it says I've reached the free project limit, stop and tell me which projects exist; don't delete or pause
     anything.
3. Wait until the project finishes setting up (the dashboard stops showing "Setting up project").
4. Note the **project ref**: the 20 lowercase letters in the URL, `supabase.com/dashboard/project/<ref>`.
5. Authentication → **Sign In / Providers** (may be under "Configuration"): turn on **Allow anonymous sign-ins**
   and save.
6. Create a personal access token: avatar menu → **Account preferences → Access Tokens**
   (`supabase.com/dashboard/account/tokens`) → **Generate new token**, name `restie-cli`. If it asks for an expiry,
   choose 30 days. Copy it (it's shown only once).

## 2. Anthropic (console.anthropic.com)

The app's AI runs on the server. Its key goes straight into Supabase and nowhere else.

1. Sign in. Settings → **API Keys** → **Create Key**, name `restie-rusty`, default workspace.
2. Immediately go back to the Supabase project → **Edge Functions → Secrets** (or Project Settings → Edge
   Functions) → add a secret:
   - Name: `ANTHROPIC_API_KEY`
   - Value: the key you just created.
   - Save.
3. **Never** paste the key anywhere else, never include it in your report to me, and don't save it in notes.
4. Settings → **Limits**: tell me the current monthly spend limit. Ask me before changing it.

## 3. Vercel (vercel.com)

1. Sign in (or sign up with GitHub; the free Hobby plan is fine).
2. Avatar menu → **Account Settings → Tokens** (`vercel.com/account/tokens`) → **Create**:
   - Name: `restie-cli`
   - Scope: my personal account
   - Expiration: 30 days
   - Copy it.
3. You don't need to create a project. The deploy script makes one called `restie`.

## Report back

End with exactly this block, filled in, and nothing secret outside it:

```
SUPABASE_PROJECT_REF=<20 letters>
SUPABASE_DB_PASSWORD=<database password>
SUPABASE_ACCESS_TOKEN=<sbp_...>
VERCEL_TOKEN=<vercel token>
```

After the block, add one line each:
- whether anonymous sign-ins are on;
- whether the `ANTHROPIC_API_KEY` secret is saved (yes or no only, never the value);
- the Anthropic monthly spend limit;
- anything you couldn't do.
