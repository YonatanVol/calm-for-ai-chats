/* ===== Calm — src/background.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * MV3 service worker. It owns everything the content script can't do itself:
 *  - Google sign-in via chrome.identity.launchWebAuthFlow (unavailable in
 *    content scripts) exchanged for a Supabase session.
 *  - All Supabase network I/O (auth + PostgREST). Routing requests through the
 *    worker sidesteps the page-origin CORS restriction that content-script
 *    fetches are subject to under MV3.
 *  - Session storage + silent refresh in chrome.storage.local.
 *
 * The anon key below is a PUBLIC client key; RLS is the real guard. The
 * service_role key is never used here.
 */
"use strict";

const SUPABASE_URL = "https://jcjvzwgxdvohdbkgdzwg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjanZ6d2d4ZHZvaGRia2dkendnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDgxODMsImV4cCI6MjA5OTc4NDE4M30.BHaX4grvlzpsssPLqUpz0yjaNVP_9TscVSHYUOXb4bs";

const SESSION_KEY = "calm-session";

async function getStored() {
  const o = await chrome.storage.local.get(SESSION_KEY);
  return o[SESSION_KEY] || null;
}
async function putStored(session) {
  if (session) await chrome.storage.local.set({ [SESSION_KEY]: session });
  else await chrome.storage.local.remove(SESSION_KEY);
}

function toSession(access_token, refresh_token, expires_in, user) {
  return {
    access_token,
    refresh_token,
    expires_at: Date.now() + parseInt(expires_in || "3600", 10) * 1000,
    user: user || null,
  };
}

async function fetchUser(token) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
  });
  return r.ok ? await r.json() : null;
}

async function signInGoogle() {
  const redirectUrl = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
  const authUrl =
    SUPABASE_URL +
    "/auth/v1/authorize?provider=google&redirect_to=" +
    encodeURIComponent(redirectUrl);
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!responseUrl) throw new Error("Sign-in was cancelled");
  const u = new URL(responseUrl);
  let params = new URLSearchParams((u.hash || "").replace(/^#/, ""));
  if (!params.get("access_token")) params = u.searchParams; // some flows use query
  const access_token = params.get("access_token");
  if (!access_token) {
    throw new Error(
      params.get("error_description") || params.get("error") || "Sign-in failed"
    );
  }
  const user = await fetchUser(access_token);
  const session = toSession(
    access_token,
    params.get("refresh_token"),
    params.get("expires_in"),
    user
  );
  await putStored(session);
  return session;
}

async function refreshSession(session) {
  if (!session || !session.refresh_token) return null;
  const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!r.ok) {
    await putStored(null);
    return null;
  }
  const d = await r.json();
  const s = toSession(d.access_token, d.refresh_token, d.expires_in, d.user);
  await putStored(s);
  return s;
}

async function validSession() {
  let s = await getStored();
  if (!s) return null;
  if (Date.now() > s.expires_at - 60000) s = await refreshSession(s);
  return s;
}

// Authenticated PostgREST request. `req` = { method, path, body, headers }.
async function dbRequest(req) {
  let s = await validSession();
  if (!s) throw new Error("Not signed in");
  const call = (token) =>
    fetch(SUPABASE_URL + "/rest/v1/" + req.path, {
      method: req.method || "GET",
      headers: Object.assign(
        {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        req.headers || {}
      ),
      body: req.body != null ? JSON.stringify(req.body) : undefined,
    });
  let r = await call(s.access_token);
  if (r.status === 401) {
    s = await refreshSession(s);
    if (!s) throw new Error("Session expired");
    r = await call(s.access_token);
  }
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!r.ok) throw new Error((data && data.message) || "HTTP " + r.status);
  return data;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg && msg.type) {
        case "calm-signin-google":
          sendResponse({ ok: true, session: await signInGoogle() });
          break;
        case "calm-signout":
          await putStored(null);
          sendResponse({ ok: true });
          break;
        case "calm-session":
          sendResponse({ ok: true, session: await validSession() });
          break;
        case "calm-db":
          sendResponse({ ok: true, data: await dbRequest(msg.req) });
          break;
        default:
          sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // keep the message channel open for the async response
});
