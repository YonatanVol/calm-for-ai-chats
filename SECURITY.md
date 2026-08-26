# Security

## Reporting a vulnerability

Open a [private security advisory](https://github.com/YonatanVol/calm-for-ai-chats/security/advisories/new),
or email **yonatanes1@gmail.com** with `[calm-security]` in the subject.

Please include what you did, what happened, and which of the three sites it was
on. A proof of concept helps enormously; a screenshot of the console usually
does not.

You will get a first reply within **72 hours**. Calm is maintained by one
person, so please do not expect an out-of-hours response — but a report that
lands will be read and answered, not filed.

Please do not open a public issue for anything that could be exploited against
someone who has Calm installed.

## What Calm can and cannot do

The security story here is mostly a story about what is absent. Each of these
is checked by the merge gate on every push, so they cannot quietly stop being
true:

- **No permissions.** `manifest.json` declares no `permissions` and no
  `host_permissions` — the keys are absent entirely. Chrome grants only what is
  asked for, and nothing is asked for, so the
  extension is *incapable* of reading your browsing history, your tabs, your
  cookies or your storage on any other site.
- **No network.** There is no `fetch`, no `XMLHttpRequest`, no WebSocket, no
  remote script and no background service worker. Nothing is sent anywhere
  because there is nothing to send it with.
- **No account, no analytics, no third-party code.** No SDKs, no tag managers,
  no bundled libraries — the whole extension is the files in `src/`.
- **It never reads your conversation.** Calm changes how the page *looks*:
  hiding an element, dimming one, restyling text. The one feature that touches
  message content is the Focus Reader, which clones the visible response into
  its own pane — locally, in your browser, and nowhere else.

Everything Calm stores lives in your browser's own `localStorage` and
`sessionStorage` for those three sites: your settings, your parked thoughts,
your intention, and a local focus log. Uninstalling ends it.

## The one place untrusted content is handled

The Focus Reader takes HTML from the page — which contains text neither you nor
Calm wrote — and rebuilds it inside Calm's pane. That is the only route by
which page content becomes Calm's markup, so it gets the strictest handling in
the codebase:

- It is an **allowlist**, not a denylist. Every element and attribute is
  rebuilt from scratch and dropped unless explicitly permitted. It was a
  denylist once; a denylist is a list of the attacks you thought of.
- `href` values are validated and stripped of control characters; script,
  style, event handlers and embedded content never survive the rebuild.
- `tools/sanitizer-test.html` runs sixteen real attacks against it in a browser.
  Open it and look — the claim is checkable rather than asserted.

## Verifying any of this yourself

The repository is public specifically so these claims can be checked instead of
believed. A privacy promise you cannot inspect is a marketing sentence.

```bash
grep -rn "fetch(\|XMLHttpRequest\|WebSocket" src/     # expect nothing
python3 -c "import json;print(json.load(open('manifest.json'))['permissions'])"
node tools/harness.js
```

Or, without cloning: open `chrome://extensions`, find Calm, and read its
permission list. It should be empty.
