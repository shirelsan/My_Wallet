/* ============================================================
   fajax.js — FAJAX (Fake AJAX) with Automatic Retry
   ============================================================ */

class FXMLHttpRequest {
  constructor() {
    // Request properties
    this.method = null;      // HTTP method (GET, POST, PUT, DELETE)
    this.url = null;         // Target URL (/auth/login, /expenses, etc)
    this.token = null;       // Session token for authentication
    
    // Callbacks (you set these)
    this.onload = null;      // Called when request succeeds
    this.onerror = null;     // Called when all retries fail
    this.onprogress = null;  // Called on retry attempts
    
    // Response properties (filled in after request completes)
    this.status = null;      // HTTP status code (200, 404, 500, etc)
    this.responseText = null; // Response body as JSON string
    
    // Request tracking for cancellation
    this.requestId = null;   // Network request ID
    
    //  Retry mechanism configuration
    this.maxRetries = 3;        // Maximum retry attempts
    this.retryCount = 0;        // Current retry attempt (0 = first try)
    this.retryDelay = 1000;     // Initial delay: 1 second
    this.retryTimeoutId = null; // For canceling scheduled retries
    this.isRetrying = false;    // Track if currently in retry mode
    
    // Store request body for retries
    this._body = null;
  }


  open(method, url) {
    this.method = method.toUpperCase();
    this.url = url;
  }

// Set session token for authentication
  setToken(token) {
    this.token = token;
  }

// Set maximum retry attempts (optional)
  setMaxRetries(max) {
    this.maxRetries = Math.max(0, max);
  }

// Send the request with optional body
  send(body = null) {
    // Make sure they called open() first
    if (!this.method || !this.url) {
      console.error('[FAJAX] Must call open() before send()');
      return;
    }

    // Store body for retries
    this._body = body;
    
    // Reset retry state
    this.retryCount = 0;
    this.isRetrying = false;
    
    // Start the request
    this._attemptRequest();
  }

// Internal method to attempt sending the request (and handle retries)
  _attemptRequest() {
    // Package up the request message
    const message = {
      method: this.method,
      url: this.url,
      token: this.token,
      body: this._body ? JSON.parse(JSON.stringify(this._body)) : null
    };

    // Log retry attempts (but not the first try)
    if (this.retryCount > 0) {
      console.log(
        `[FAJAX] 🔄 Retry attempt ${this.retryCount}/${this.maxRetries} ` +
        `for ${this.method} ${this.url}`
      );
    }

    // Send through network with callbacks
    network.send(
      message,
      
      // Success callback - network delivered the response
      (response) => {
        this._handleSuccess(response);
      },
      
      // Error callback - packet was dropped or other network error
      (errorMessage) => {
        this._handleError(errorMessage);
      }
    );
    
    // Store the request ID (assigned by network)
    this.requestId = network.requestCounter;
  }

// Handle successful response
  _handleSuccess(response) {
    // Success! Reset retry state
    this.retryCount = 0;
    this.isRetrying = false;
    
    // If we retried and succeeded, log it
    if (this.retryCount > 0) {
      console.log(`[FAJAX] ✅ Request succeeded after ${this.retryCount} retries`);
    }
    
    this.status = response.status;
    this.responseText = JSON.stringify(response);
    
    if (this.onload) {
      this.onload(response);
    }
  }

//  Handle failed response (after all retries)
  _handleError(errorMessage) {
    // Check if we should retry
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.isRetrying = true;
      
      // Calculate exponential backoff delay
      // Formula: baseDelay * 2^(attempt-1)
      // Result: 1s, 2s, 4s, 8s, ...
      const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
      
      console.log(
        `[FAJAX] ⚠️ Request failed. Retrying in ${delay}ms... ` +
        `(attempt ${this.retryCount}/${this.maxRetries})`
      );
      
      // Notify app about retry (for UI feedback)
      if (this.onprogress) {
        this.onprogress({
          type: 'retry',
          attempt: this.retryCount,
          maxRetries: this.maxRetries,
          delay: delay,
          error: errorMessage
        });
      }
      
      // Schedule next attempt
      this.retryTimeoutId = setTimeout(() => {
        this.retryTimeoutId = null;
        this._attemptRequest();
      }, delay);
      
    } else {
      // Max retries reached - give up
      this.isRetrying = false;
      this.status = 0;
      
      console.error(
        `[FAJAX] ❌ Request failed after ${this.maxRetries} retries: ` +
        `${this.method} ${this.url}`
      );
      
      if (this.onerror) {
        this.onerror(
          errorMessage || 
          `Network error after ${this.maxRetries} retry attempts. Please try again.`
        );
      }
    }
  }

// Abort the request and any pending retries
  abort() {
    // Cancel any scheduled retry
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
      console.log('[FAJAX] Cancelled pending retry');
    }
    
    // Cancel active network request
    if (this.requestId) {
      network.cancelRequest(this.requestId);
      this.requestId = null;
    }
    
    // Reset retry state
    this.isRetrying = false;
    this.retryCount = 0;
    
    console.log('[FAJAX] Request aborted (including pending retries)');
  }

 //  Get current retry state (for UI feedback)
  getRetryState() {
    return {
      isRetrying: this.isRetrying,
      currentAttempt: this.retryCount,
      maxRetries: this.maxRetries,
      hasScheduledRetry: this.retryTimeoutId !== null
    };
  }
}