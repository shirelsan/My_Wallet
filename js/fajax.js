/* ============================================================
   fajax.js — FAJAX  (Fake AJAX)
   Simulates the browser's XMLHttpRequest / fetch API.

   Usage (mirrors the real XHR pattern):
     const req = new FXMLHttpRequest();
     req.open('POST', '/expenses');
     req.setToken(sessionToken);          // attach auth token
     req.onload  = (response) => { … };  // success or server-error
     req.onerror = (errMsg)   => { … };  // network-level error (drop)
     req.send({ title: 'Coffee', amount: 15 });

   Internally:
     – Packages method + url + token + body into a network envelope
     – Passes the envelope to Network.send()
     – Network calls back _onload / _onerror after simulated I/O
   ============================================================ */

class FXMLHttpRequest {
  constructor() {
    this.method       = null;   // HTTP verb
    this.url          = null;   // endpoint path
    this.token        = null;   // session / auth token
    this.onload       = null;   // (responseObject) => void
    this.onerror      = null;   // (errorString)    => void
    this.status       = null;   // filled after response
    this.responseText = null;   // raw JSON string after response
  }

  /* ── Public methods ─────────────────────────────────────── */

  /**
   * Prepare the request (mirrors XMLHttpRequest.open).
   * Must be called before send().
   * @param {string} method  'GET' | 'POST' | 'PUT' | 'DELETE'
   * @param {string} url     endpoint, e.g. '/expenses' or '/expenses/exp_1'
   */
  open(method, url) {
    this.method = method.toUpperCase();
    this.url    = url;
  }

  /**
   * Attach an authentication token that will be forwarded to the server.
   * @param {string} token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Dispatch the request through the Network layer.
   * @param {Object|null} body  JSON-serialisable payload (null for GET/DELETE)
   */
  send(body = null) {
    if (!this.method || !this.url) {
      console.error('[FAJAX] call open() before send()');
      return;
    }

    // Deep-copy the body so the network/server cannot mutate the caller's object
    const bodyCopy = body ? JSON.parse(JSON.stringify(body)) : null;

    // Envelope passed through the network layer
    const envelope = {
      method: this.method,
      url:    this.url,
      token:  this.token,
      body:   bodyCopy,

      // Callbacks are attached here; Network invokes them after delivery
      _onload: (response) => {
        this.status       = response.status;
        this.responseText = JSON.stringify(response);
        if (this.onload) this.onload(response);
      },

      _onerror: (errMsg) => {
        this.status = 0;
        if (this.onerror) this.onerror(errMsg);
      }
    };

    Network.send(envelope);
  }
}