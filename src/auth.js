/* ===== Calm — src/auth.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Content-script session bridge. The actual OAuth + network work lives in the
 * background service worker (src/background.js); this thin layer exposes a
 * synchronous-feeling CALM.auth to the rest of the extension and relays calls
 * over chrome.runtime messaging. Signed-out users keep the full local app.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  if (!CALM.site) return;

  var current = null;
  var listeners = [];

  function send(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (resp) {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp || { ok: false, error: "no response" });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    });
  }

  function setSession(s) {
    current = s || null;
    listeners.forEach(function (fn) {
      try {
        fn(current);
      } catch (_) {}
    });
  }

  CALM.auth = {
    session: function () {
      return current;
    },
    user: function () {
      return current && current.user;
    },
    isSignedIn: function () {
      return !!(current && current.access_token);
    },
    token: function () {
      return current && current.access_token;
    },
    // fn is called immediately with the current session, then on every change.
    onChange: function (fn) {
      listeners.push(fn);
      try {
        fn(current);
      } catch (_) {}
    },
    signInWithGoogle: async function () {
      var r = await send({ type: "calm-signin-google" });
      if (r.ok) setSession(r.session);
      return r;
    },
    signOut: async function () {
      await send({ type: "calm-signout" });
      setSession(null);
    },
    // Re-read (and silently refresh) the stored session.
    refresh: async function () {
      var r = await send({ type: "calm-session" });
      setSession(r.ok ? r.session : null);
      return current;
    },
    // Authenticated PostgREST request via the worker. Returns { ok, data | error }.
    db: function (req) {
      return send({ type: "calm-db", req: req });
    },
  };

  CALM.auth.refresh();
})();
