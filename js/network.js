/* ============================================================
   network.js — Simulated Network Layer
   
   Simulates realistic network behavior with:
   - Random delays (1-3 seconds as per project requirements)
   - Packet drops (10-50% configurable rate)
   - Asynchronous message delivery
   - Server routing
   ============================================================ */

class Network {
  constructor() {
    // Initialize servers with their database APIs
    this.authServer = AuthServer;      // Authentication server
    this.appServer = AppServer;         // Application (expenses) server
    
    // Network configuration (per project requirements)
    this.dropRate = 0.2;     // 20% packet drop rate (10-50% allowed)
    this.minDelay = 1000;    // Minimum delay: 1 second
    this.maxDelay = 3000;    // Maximum delay: 3 seconds
  }

  /* Send message through network
     Simulates:
     1. Network delay (client → server)
     2. Possible packet drop
     3. Server routing and processing
     4. Network delay (server → client)
     
     Parameters:
       msg - Request object with method, url, token, body
       onSuccess - Callback for successful delivery
       onError - Callback for network errors
  */
  send(msg, onSuccess, onError) {
    const delay = this._randomDelay();
    
    console.log(
      `[Network] ▶ ${msg.method} ${msg.url}` +
      `  delay=${delay}ms  dropRate=${(this.dropRate * 100).toFixed(0)}%`
    );

    // Phase 1: Simulate network delay (client → server)
    setTimeout(() => {

      // Check if packet should be dropped
      if (this._shouldDrop()) {
        console.warn(`[Network] ✗ DROPPED  ${msg.method} ${msg.url}`);
        if (onError) onError('Network error: packet dropped. Please retry.');
        return;
      }

      // Route to correct server
      const server = this._findServer(msg.url);
      if (!server) {
        console.error(`[Network] ✗ No route for URL: ${msg.url}`);
        if (onError) onError(`No server found for ${msg.url}`);
        return;
      }

      console.log(`[Network] ✓ Delivering  ${msg.method} ${msg.url}`);

      // Server processes request (async with callback)
      server.handleRequest(msg, (response) => {
        console.log(`[Network] ✓ Server response: status=${response.status}`);
        
        // Phase 2: Simulate network delay (server → client)
        setTimeout(() => {
          console.log(`[Network] ◀ Response delivered  ${msg.url}`);
          if (onSuccess) onSuccess(response);
        }, delay / 2);
      });

    }, delay);
  }

  /* ── Private helper methods ──────────────────────────── */

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

  /* ── Public configuration methods ────────────────────── */

  // Change packet drop rate (must be between 0.1 and 0.5)
  setDropRate(rate) {
    if (rate < 0.1 || rate > 0.5) {
      console.warn('[Network] Drop rate must be between 0.10 and 0.50');
      return;
    }
    this.dropRate = rate;
    console.log(`[Network] Drop rate → ${(this.dropRate * 100).toFixed(0)}%`);
  }

  // Get current drop rate
  getDropRate() {
    return this.dropRate;
  }

  // Set custom delay range
  setDelayRange(min, max) {
    if (min < 0 || max < min) {
      console.warn('[Network] Invalid delay range');
      return;
    }
    this.minDelay = min;
    this.maxDelay = max;
    console.log(`[Network] Delay range → ${min}-${max}ms`);
  }
}

// Create single network instance (singleton pattern)
const network = new Network();