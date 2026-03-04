/* ============================================================
   network.js — Simulated Network Layer

   Responsibilities:
     1. Receive messages from FAJAX (client → server direction)
     2. Apply a random delay  (MIN_DELAY … MAX_DELAY ms)
     3. Randomly drop messages at a configurable drop-rate
     4. Route surviving messages to the correct server
        based on the URL prefix in the message
     5. Deliver the server's synchronous response back to the
        originating FAJAX callback after another short delay

   Route table (URL prefix → server):
     /auth      → AuthServer.handleRequest()
     /expenses  → AppServer.handleRequest()
   ============================================================ */

/* ============================================================
   network.js — Simulated Network Layer (Async Version)
   
   *** UPDATED: Servers now use callbacks ***
   ============================================================ */

const Network = (() => {

  /* ── Configuration ──────────────────────────────────────── */
  let dropRate  = 0.2;
  const MIN_DELAY = 1000;
  const MAX_DELAY = 3000;

  /* ── Route table ────────────────────────────────────────── */
  const ROUTES = {
    '/auth':     (msg, callback) => AuthServer.handleRequest(msg, callback),
    // ↑ עכשיו מעביר גם callback!
    
    '/expenses': (msg, callback) => AppServer.handleRequest(msg, callback),
    // ↑ עכשיו מעביר גם callback!
  };

  /* ── Private helpers ────────────────────────────────────── */
  function _randomDelay() {
    return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
  }

  function _shouldDrop() {
    return Math.random() < dropRate;
  }

  function _findServer(url) {
    for (const prefix of Object.keys(ROUTES)) {
      if (url.startsWith(prefix)) return ROUTES[prefix];
    }
    return null;
  }

  /* ── Public API ─────────────────────────────────────────── */

  function send(msg) {
    const delay = _randomDelay();
    console.log(
      `[Network] ▶ ${msg.method} ${msg.url}` +
      `  delay=${delay}ms  dropRate=${(dropRate * 100).toFixed(0)}%`
    );

    // Phase 1 — simulate transit delay (client → server)
    setTimeout(() => {

      // ── Drop? ──────────────────────────────────────────────
      if (_shouldDrop()) {
        console.warn(`[Network] ✗ DROPPED  ${msg.method} ${msg.url}`);
        if (msg._onerror) msg._onerror('Network error: packet dropped');
        return;
      }

      // ── Route to server ────────────────────────────────────
      const serverFn = _findServer(msg.url);
      if (!serverFn) {
        console.error(`[Network] ✗ No route for URL: ${msg.url}`);
        const res = { status: 404, ok: false, message: `No server found for ${msg.url}` };
        if (msg._onload) msg._onload(res);
        return;
      }

      console.log(`[Network] ✓ Delivering  ${msg.method} ${msg.url}`);

      // ✨ Server processes request ASYNCHRONOUSLY via callback
      serverFn(msg, (response) => {
        // ↑ השרת קורא ל-callback הזה עם התגובה
        
        console.log(`[Network] ✓ Received response from server: status=${response.status}`);
        
        // Phase 2 — simulate return delay (server → client)
        setTimeout(() => {
          console.log(`[Network] ◀ Response  status=${response.status}  ${msg.url}`);
          if (msg._onload) msg._onload(response);
        }, delay / 2);
      });
      // ↑ עכשיו הרשת "מקבלת" את התגובה דרך callback!

    }, delay);
  }

  function setDropRate(rate) {
    if (rate < 0.1 || rate > 0.5) {
      console.warn('[Network] Drop rate must be between 0.10 and 0.50');
      return;
    }
    dropRate = rate;
    console.log(`[Network] Drop rate → ${(dropRate * 100).toFixed(0)}%`);
  }

  function getDropRate() {
    return dropRate;
  }

  return { send, setDropRate, getDropRate };
})();