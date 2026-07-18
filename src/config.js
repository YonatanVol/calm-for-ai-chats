/* ===== Calm — src/config.js =====
 * Copyright © 2026 Yonatan Volsky. All rights reserved.
 * Proprietary and source-available; see LICENSE. Not open-source.
 *
 * Supabase connection for the extension. Both values below are PUBLIC client
 * keys: the anon key is a JWT with the "anon" role and is safe to ship in the
 * extension — Row-Level Security (see supabase/schema.sql) is what actually
 * protects each user's rows. The service_role key is NEVER placed here; it
 * belongs only on a server.
 */
(function () {
  "use strict";
  var CALM = (window.CALM = window.CALM || {});
  CALM.config = {
    SUPABASE_URL: "https://jcjvzwgxdvohdbkgdzwg.supabase.co",
    SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjanZ6d2d4ZHZvaGRia2dkendnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDgxODMsImV4cCI6MjA5OTc4NDE4M30.BHaX4grvlzpsssPLqUpz0yjaNVP_9TscVSHYUOXb4bs",
  };
})();
