# Calm — Backend Setup (Phases 3–7)

The local extension (reading, modes, presets, Pomodoro, audio) works with **no
backend**. Accounts, cross-device sync, the web dashboard, Spotify, and billing
need services you provision. I scaffold all the code/config; you create the
accounts and paste the keys into `.env` files. **I never handle your passwords** —
Supabase Auth, Spotify, and Stripe manage credentials directly.

## What you'll create (all have free tiers except Stripe fees / a domain)
| Service | Why | Free tier |
| --- | --- | --- |
| **Supabase** | Auth + Postgres (settings, presets, focus stats) | ✅ |
| **Vercel** | Host the web dashboard (Next.js) | ✅ |
| **Spotify Developer** | Play a playlist at timer end (Premium users) | ✅ |
| **Stripe** | Pro subscriptions / one-time unlock | pay-per-use |
| **Domain** (optional) | e.g. calm.app for the dashboard | ~$12/yr |

## Phase 3 — Supabase (do this first)
1. Create a project at https://supabase.com → note the **Project URL** and **anon key**
   (Project Settings → API). Keep the **service_role** key secret (server only).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
   It creates the tables + Row-Level Security (every row is user-scoped).
3. Auth → Providers: enable **Email** and **Google**. For Google, add the
   redirect URLs Supabase shows you.

## Phase 4 — Extension auth/sync (I wire this once you have the keys)
- I add `src/config.js` (your Supabase URL + anon key), `src/auth.js`
  (`chrome.identity.launchWebAuthFlow` → Supabase session), and `src/sync.js`
  (debounced, offline-first sync of settings/presets/focus_sessions).
- New manifest permissions: `identity`, `storage`, and host access to your
  Supabase URL. Signed-out users keep the full local experience.

## Phase 5 — Web dashboard (Next.js on Vercel)
- I scaffold `calm-web/` (login, focus history, streaks, settings, account).
  You set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
  and deploy. The extension links to it and shares the Supabase session.

## Phase 6 — Spotify
1. Create an app at https://developer.spotify.com/dashboard → note **Client ID**;
   add the redirect URI I provide.
2. I add the OAuth connect flow + Web Playback SDK; on timer end, Premium users
   hear their chosen playlist, everyone else gets the built-in chime.

## Phase 7 — Billing (Stripe)
1. Create a Stripe account → a **monthly** price and a **one-time (lifetime)** price.
2. I add Stripe Checkout + a webhook (Vercel function) that flips
   `subscriptions.status` in Supabase; `isPro()` then reads from there.

## Extension signing key (stable ID)
The manifest's `"key"` field is the PUBLIC key that keeps the extension ID stable
(required so the Google-sign-in redirect URL never changes). Its PRIVATE half
lives at `~/.calm-keys/calm-extension-key.pem` (0600) — **outside** this folder,
because Chrome embeds any `.pem` found in the directory when packing, and this
repo is public. Never move it back here; `*.pem` is gitignored as a second guard.
It is only needed if you ever pack a `.crx` manually — the Web Store manages its
own keys.

## Privacy note (changes with accounts)
Conversations are still never read or sent. Once signed in, your **email, focus
stats, settings, and Spotify token** live in your Supabase row under RLS. The
free, signed-out extension remains local-only. I'll update `PRIVACY.md`
accordingly when auth ships.

---
**To continue:** create the Supabase project + run `schema.sql`, then paste me the
**Project URL** and **anon key** (both are safe to share; they're public client
keys). I'll wire `src/auth.js` + `src/sync.js` and we test end-to-end.
