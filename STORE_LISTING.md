# Chrome Web Store — Submission Guide

Everything you need to publish **Calm**. I can't create your developer account,
pay the fee, or submit for you — those steps require your Google account and
payment. Below is the upload artifact, the exact copy to paste, and the checklist.

## 0. One-time setup (you)
1. Register as a Chrome Web Store developer (**one-time $5 USD fee**):
   https://chrome.google.com/webstore/devconsole
2. Verify your email / account.

## 1. Upload artifact (done for you)
Run `python3 install.py --zip` → produces `dist/calm-for-ai-chats-v<version>.zip`.
Upload that zip in the Developer Dashboard → **New item**.

## 2. Listing copy (paste-ready)

**Name**
> Calm — Reading Mode for AI Chats

**Summary (≤132 chars)**
> Distraction-free reading for ChatGPT & Gemini. Hide the input, Zen mode, set your reading width. Zero permissions, zero tracking.

**Description**
> Calm makes AI chats calmer to read.
>
> • Hide the input box for a clean reading view (Ctrl/Cmd+Shift+H)
> • Auto-hide as you scroll up; it returns at the bottom
> • Zen mode — hide the sidebar, header, and chips in one keypress (Ctrl/Cmd+Shift+Z)
> • Set your reading width — no more cramped column
> • Remember your layout across page loads
> • Quick scroll-to-top/bottom while reading
> • Your drafts are kept safe while the input is hidden
>
> Privacy first: no permissions, no network requests, no tracking. Your
> conversations never leave your browser.
>
> Works on ChatGPT and Gemini.

**Category:** Productivity
**Language:** English

## 3. Required assets
- [x] Icon 128×128 — `icons/icon128.png` (included)
- [ ] At least 1 screenshot **1280×800** or **640×400** (PNG/JPEG). Capture: input
      hidden, Zen mode, reading-width slider, settings panel.
- [ ] Small promo tile 440×280 (optional but recommended).
- [x] Privacy policy — host `PRIVACY.md` (e.g. enable GitHub Pages, or link the
      raw file) and paste the URL into the dashboard's Privacy tab.

## 4. Privacy tab answers
- Single purpose: "Adjust the on-screen reading layout of ChatGPT and Gemini."
- Permissions justification: none requested.
- Data usage: **does not collect or use user data** (check the boxes accordingly).
- Remote code: **No** (all code is bundled).

## 5. Naming caution ⚠️
The Web Store can reject titles/branding that lean on others' trademarks. The
**name** "Calm — Reading Mode for AI Chats" avoids "ChatGPT"/"Gemini", which is
good. Mentioning them in the **description** as supported sites is normally fine
(nominative use), but if review pushes back, soften to "popular AI chat sites."

## 6. Submit
Upload zip → fill listing → add screenshots + privacy URL → **Submit for review**.
MV3 + zero permissions usually means a fast review (often 1–3 days).
