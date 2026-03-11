/* ============================================================
   network.js — Simulated Network Layer

   ============================================================ */

class Network {
  constructor() {
    // Connect to our two servers
    this.authServer = AuthServer;      // Handles login/register/logout
    this.appServer = AppServer;         // Handles expenses CRUD

    // Network quality settings (you can change these!)
    this.dropRate = 0.2;     // 20% packet drop rate - not too harsh, not too kind
    this.minDelay = 1000;    // Minimum delay: 1 second (requirement)
    this.maxDelay = 3000;    // Maximum delay: 3 seconds (requirement)

    // Race condition handling
    this.requestCounter = 0;           // Unique ID for each request
    this.pendingRequests = new Map();  // Track active requests: requestId → {timestamp, onSuccess, onError}
  }


  // Main method to send a request through the network
  send(msg, onSuccess, onError) {

    this.dropRate = parseFloat((Math.random() * 0.4 + 0.1).toFixed(2));
    const requestId = ++this.requestCounter;
    msg.requestId = requestId;

    const delay = this._randomDelay();

    console.log(
      `[Network] ▶ [${requestId}] ${msg.method} ${msg.url}` +
      `  delay=${delay}ms  dropRate=${(this.dropRate * 100).toFixed(0)}%`
    );

    // Save callbacks for when response arrives (or if we need to cancel)
    this.pendingRequests.set(requestId, {
      timestamp: Date.now(),
      onSuccess,
      onError
    });

    // Phase 1: Simulate network delay (client → server)
    setTimeout(() => {

      //  Check if request was cancelled
      if (!this.pendingRequests.has(requestId)) {
        console.log(`[Network] ✗ Request ${requestId} was cancelled`);
        return;
      }

      // Check if packet should be dropped
      if (this._shouldDrop()) {
        console.warn(`[Network] ✗ DROPPED  [${requestId}] ${msg.method} ${msg.url}`);
        const pending = this.pendingRequests.get(requestId);
        this.pendingRequests.delete(requestId);
        if (pending && pending.onError) {
          pending.onError('Network error: packet dropped. Please retry.');
        }
        return;
      }

      // Route to correct server
      const server = this._findServer(msg.url);
      if (!server) {
        console.error(`[Network] ✗ No route for URL: ${msg.url}`);
        const pending = this.pendingRequests.get(requestId);
        this.pendingRequests.delete(requestId);
        if (pending && pending.onError) {
          pending.onError(`No server found for ${msg.url}`);
        }
        return;
      }

      console.log(`[Network] ✓ Delivering  [${requestId}] ${msg.method} ${msg.url}`);

      // Server processes request (async with callback)
      server.handleRequest(msg, (response) => {
        console.log(`[Network] ✓ Server response: [${requestId}] status=${response.status}`);

        // Check if we're still waiting for this response
        if (!this.pendingRequests.has(requestId)) {
          console.log(`[Network] ✗ Ignoring late response [${requestId}] - request was cancelled`);
          return;
        }

        // Phase 2: Simulate network delay (server → client)
        setTimeout(() => {
          const pending = this.pendingRequests.get(requestId);
          this.pendingRequests.delete(requestId);

          if (pending && pending.onSuccess) {
            console.log(`[Network] ◀ Response delivered  [${requestId}] ${msg.url}`);
            pending.onSuccess(response);
          }
        }, delay / 2);
      });

    }, delay);
  }

  /* ── Helper methods ─────────────────────────────────────── */

  // Generate random delay between min and max
  _randomDelay() {
    return Math.floor(
      Math.random() * (this.maxDelay - this.minDelay + 1)
    ) + this.minDelay;
  }

  // Determine if packet should be dropped
  _shouldDrop() {
    return Math.random() < this.dropRate;
  }

  // Find which server handles this URL
  _findServer(url) {
    if (url.startsWith('/auth')) return this.authServer;
    if (url.startsWith('/expenses')) return this.appServer;
    return null;
  }


  cancelRequest(requestId) {
    if (this.pendingRequests.has(requestId)) {
      console.log(`[Network] ✗ Cancelling request ${requestId}`);
      this.pendingRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending requests
   * 
   * Useful when user logs out or navigates to a different page.
   */
  cancelAllRequests() {
    const count = this.pendingRequests.size;
    this.pendingRequests.clear();
    console.log(`[Network] ✗ Cancelled ${count} pending requests`);
  }

  
}

// Create single network instance (singleton pattern)
const network = new Network();