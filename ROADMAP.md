# Calm — roadmap

The daily improvement task (09:00) implements the TOPMOST unchecked item, one
per day, harness-gated (`node tools/harness.js`), merged `--no-ff` to develop.
Items are ordered by (impact × feasibility) from a 13-agent audit + judge
panel, deduplicated, release-blockers first. Add new findings in priority
position; demote, never delete.

## Timeline

Assumes the 09:00 daily task keeps doing one item per day, S ≈ 1 day, M ≈ 2.
Dates are relative because the only hard dependency is the owner, not the work.

| When | What | Who |
| --- | --- | --- |
| **Now** | In-situ screenshot · CWS account ($5) · Submit | **owner** |
| +3–14 days | Review wait. Meanwhile: 3 hardening items, then where-was-I card + chat spotlight | auto |
| **~2 weeks** | **v3.1.0 live.** Launch posts, support channel | **owner** |
| Weeks 3–4 | Declutter checklist · waypoints · prompt locker · stats tab · review loop | auto |
| Weeks 5–6 | Hebrew + RTL chrome · adapter wave (Perplexity, Grok, DeepSeek) · Edge | auto (+owner for Edge) |
| Weeks 7–8 | Paid tier — pricing and provider first, and only if usage justifies it | **owner** decides |

Two things this ordering is deliberate about:

- **Bug reports outrank everything below them.** The moment there are real
  users, whatever they hit jumps the queue.
- **Billing is last on purpose.** Auth and sync were deleted to reach zero
  permissions, which is the strongest thing the listing says. Putting them
  back costs that, so it should only happen once people are actually using it.

## A — Release blockers (v3.1.0 to the Chrome Web Store)

- [ ] OWNER: take one in-situ screenshot on a real conversation and drop it in
      as store-assets/01-one-menu.png. The generated hero shots are honest but
      show Calm on a neutral backdrop, not on a real chat — a reviewer and a
      shopper both want to see the real thing. See store-assets/README.


## B — Flow features (highest-ranked new work)

- [ ] Where-was-I re-entry card (S, 4.13): returning to the tab after >5 min
      away shows a quiet card: your intention, parked thoughts count, and a
      "jump to where you stopped" scroll anchor. Session-local only.
- [ ] Chat spotlight (S, 4.0): stylesheet-gated mode that dims all turns
      except the latest exchange (adapter turn selector + html.cit-chatspot);
      the in-page sibling of the reader's Spotlight.
- [ ] Conversation waypoints (M, 4.33): content-free minimap of turn
      POSITIONS (no text) down the pane edge; click = jump; ⌥↑/⌥↓ hop between
      your own prompts. Positions only — never reads message content.
- [ ] Prompt locker (M, 4.23): reusable own-text snippets + multi-draft
      parking, cross-site (localStorage, user's own text only); insert via
      the existing insertIntoInput pipeline.
- [ ] Prompt starters (M, 4.02): blank-composer ignition — 3 quiet starter
      chips ("Explain…", "Draft…", "Review…", user-editable) when the
      composer is empty and focused >10s.
- [ ] Declutter checklist (M, 4.33): per-site granular chrome toggles
      (banners, suggestion pills, avatars…) via an adapter declutterTargets
      map; each a stylesheet-gated class like zen.
- [ ] Quiet Noise (M, 3.8): Web-Audio-synthesized brown/pink noise + rain
      (no bundled files, zero network), timer-linked to Pomodoro focus
      blocks, gentle fade in/out.
- [ ] Local-first Stats tab (M, 3.92): focus minutes, streaks, per-site
      split from the existing logFocus data; sparklines in the settings
      panel; sync only if signed in. No shame mechanics — streaks pause,
      never "break".
- [ ] Shutdown ritual (M, 3.92): "End session" flow — park open thoughts,
      one-line note-to-tomorrow, next-time intention pre-filled on return.
- [ ] Focus schedule & soft landing (M, 3.9): time-of-day preset automation
      ("Calm hours"), pre-committed stop time with escalating ambient cues.
- [ ] Focus lock (S, 3.8): optional hold-to-unlock (800ms) on composer
      reveal during focus blocks — a speed bump for impulse checking.
- [ ] Two-minute ignition (S, 3.7): tiny "just start" timer from the
      intention card — 2 minutes, then asks "keep going?".
- [ ] Adapter wave 1 (M, 3.78): Perplexity, Grok, DeepSeek adapters
      (composer/scroll/zen/prose selectors + harness smoke per site).

## C — Hardening (audit-confirmed rough edges)

- [ ] rt.scrollContainer staleness: React can replace the scroller node; add
      an isConnected check before use, the same way currentComposer() already
      re-resolves a detached composer (core.js).
- [ ] Move the hard-coded excluded-scroller selectors from core.js into a
      per-adapter excludedScrollers() field (adapters.js).
- [ ] Scroll-sensitivity thresholds (150/20px) into CALM.const.

## D — Growth & platform (needs owner input where marked)

- [ ] Re-add a paid tier when billing exists (auth/sync were deleted in P1;
      supabase/schema.sql is kept in-repo for that day) — OWNER: provider +
      pricing.
- [ ] Review-collection loop: after 7 active days, one quiet "enjoying
      Calm?" card → Web Store review link; never repeats after dismiss.
- [ ] i18n pass: extract UI strings; ship Hebrew (full RTL chrome) first.
- [ ] Growth measurement WITHOUT analytics: store-listing installs + a
      voluntary in-extension "how did you find us?" (local, user-sent).
- [ ] Edge Add-ons submission package (same zip) — OWNER account needed.
- [ ] Firefox MV3 port (browser.* shims, background differences).

## Done

- [x] 2026-07-30 — Hardening items closed by the TDD rounds: the textarea
      draft-clobber (now inserts at the caret), restoreDraft's textarea check,
      and the uncapped scroll-discovery retry loop.

- [x] 2026-07-30 — Answer-ready cue: the tab title says when a reply finished
      while you were away, and stops the moment you look. Optional chime, off
      by default. Detects via the site's own stop-generating control, so a
      rotted selector yields a MISSED cue, never a false one. 8 scenarios.

- [x] 2026-07-30 — Store assets: tools/store-shots.js renders five 1280×800
      hero shots plus the 440×280 promo tile from the LIVE stylesheet and icon
      set, so they cannot drift from the real UI. Documented honestly: these
      are hero shots, not in-situ, and why.

- [x] 2026-07-30 — First-run tour: three short cards anchored to the menu
      (never a modal over the conversation), Skip on every card, Escape
      dismisses, remembered permanently, and it steps aside for Presentation.
      Written test-first; 13 scenario checks.

- [x] 2026-07-30 — H · Margin shipped (marginalia rail + automatic fallback),
      CSS review acted on, and the active-state colour regression from the
      host-isolation reset fixed. Harness 144; browser suites for the
      sanitizer and for cascade/contrast.

- [x] 2026-07-30 — full code review acted on: 18 confirmed defects fixed
      (Presentation lockout, Advanced-drawer wipe, preset typography, reset
      destroying its own panel, Focus Reader settings inert outside the pane,
      pomodoro stats, zen clobbering host styles, uncapped retry loop, shadow
      DOM keystroke capture, Escape gaps, dead controls). Sanitizer rewritten
      as an allowlist with a 16-case browser attack suite. Host-CSS isolation
      reset. Privacy claims corrected. Harness 87 -> 121.

- [x] 2026-07-30 — v3.1 menu rebuild, five phases merged to develop:
      P1 strip-network (zero permissions, zero network, auth/sync/config
      deleted, intention auto-open removed), P2 mode-registry (surface field,
      duplicated arrays gone, Reader folded into settings), P3 console (three
      menus become one, Advanced as an in-place drawer), P4 palette (⌘K over a
      derived action list), P5 polish (showToggleButton, presets, dockQuiet,
      a single Escape stack, nag z-index below the reader). Harness 57 → 87.

- [x] 2026-07-29 — STORE_LISTING.md rewritten truthfully: 3 sites, Focus Reader
      + focus suite, quiet-graphite positioning, real permissions story
      (identity + storage + Supabase host), CWS single-purpose statement,
      per-permission justification table, data-usage checkbox answers, and the
      5-shot 1280×800 asset list. Retired the false "zero permissions, no
      network requests" copy.
- [x] 2026-07-27 — P11 Focus Reader (bionic/Ease/Spotlight/RTL, sanitized
      local-only cloning); review-hardened; harness 57 checks.
- [x] 2026-07-27 — Quiet graphite palette (gold removed); Bloom tray +
      intention card redesigns; corner-anchored dock engine.
- [x] 2026-07-27 — PA review-criticals batch; truthful docs; v3.0.0;
      tools/harness.js merge gate; daily improvement routine.
