# Calm — roadmap

The daily improvement task (09:00) implements the TOPMOST unchecked item, one
per day, harness-gated (`node tools/harness.js`), merged `--no-ff` to develop.
Items are ordered by (impact × feasibility) from a 13-agent audit + judge
panel, deduplicated, release-blockers first. Add new findings in priority
position; demote, never delete.

## A — Release blockers (v3.0.0 to the Chrome Web Store)

- [ ] Onboarding: first-run tour (3 quiet cards over the dock: pill → bloom →
      Focus Reader) + a "what's new in 3.0" note for upgraders. No modals over
      site content; dismiss = never again (localStorage).
- [ ] Generate store screenshots: headless-render the 5 hero shots (Bloom
      tray, Focus Reader dark+RTL, Pomodoro, intention card, settings) at
      1280×800 into store-assets/ via a tools/store-shots.js script.

## B — Flow features (highest-ranked new work)

- [ ] Answer-ready cue (S, score 4.77): while the tab is unfocused, detect
      generation-complete (adapter: stop-button disappears / stream ends) and
      flip document.title to "● Ready — Calm" + optional soft chime
      (audio.js); restore on focus. Zero new permissions.
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

- [ ] insertIntoInput textarea path REPLACES value instead of inserting at
      caret — type-ahead flush can clobber an existing draft (core.js).
- [ ] restoreDraft kept-text check reads innerText for textareas (always
      empty) — rewrites + refires input events every show (core.js).
- [ ] rt.scrollContainer staleness: React can replace the scroller node;
      add an isConnected check before quick-nav/scroll use (core.js).
- [ ] Move the hard-coded excluded-scroller selectors from core.js into a
      per-adapter excludedScrollers() field (adapters.js).
- [ ] Settings guard: prevent disabling BOTH the toggle button and the
      keyboard shortcut while auto-hide is on (no escape hatch left).
- [ ] Scroll-sensitivity thresholds (150/20px) into CALM.const.
- [ ] Retry-loop cap for scroll discovery (symmetric with composer's 120).
- [ ] Modes quick-popover z-index vs Focus Reader pane: popover (…002)
      floats above the pane (…001) — close popovers on focusreader enter.
- [ ] Doc-drift sweep: README is stale against the shipped design (FEATURES.md
      flags it ◐), and FEATURES.md still says "16 ordered no-build content
      scripts" while the manifest ships 17 (reader.js landed after the audit).
      Refresh both, and have the harness assert the script count matches the
      manifest so this drift fails the gate instead of aging quietly.

## D — Growth & platform (needs owner input where marked)

- [ ] Review-collection loop: after 7 active days, one quiet "enjoying
      Calm?" card → Web Store review link; never repeats after dismiss.
- [ ] i18n pass: extract UI strings; ship Hebrew (full RTL chrome) first.
- [ ] Growth measurement WITHOUT analytics: store-listing installs + a
      voluntary in-extension "how did you find us?" (local, user-sent).
- [ ] isPro seam → real entitlements via Supabase (grandfather early users)
      — blocked on OWNER: payment provider + pricing.
- [ ] Edge Add-ons submission package (same zip) — OWNER account needed.
- [ ] Firefox MV3 port (browser.* shims, background differences).

## Done

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
