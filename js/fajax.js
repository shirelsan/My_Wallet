/* ============================================================
   fajax.js — FAJAX (Fake AJAX)
   
   Simulates XMLHttpRequest API for making network requests.
   Works with the Network class to send asynchronous requests.
   ============================================================ */

class FXMLHttpRequest {
  constructor() {
    this.method = null;      // HTTP method (GET, POST, PUT, DELETE)
    this.url = null;         // Request URL
    this.token = null;       // Authentication token
    this.onload = null;      // Success callback
    this.onerror = null;     // Error callback
    this.status = null;      // Response status code
    this.responseText = null; // Response body
  }

  /* Initialize request
     Must be called before send()
     
     Parameters:
       method - HTTP method (GET, POST, PUT, DELETE)
       url - Target URL (/auth/login, /expenses, etc)
  */
  open(method, url) {
    this.method = method.toUpperCase();
    this.url = url;
  }

  /* Set authentication token
     Token will be included in request to server
  */
  setToken(token) {
    this.token = token;
  }

  // Send request through network

  send(body = null) {
    if (!this.method || !this.url) {
      console.error('[FAJAX] Must call open() before send()');
      return;
    }

    // Prepare request message
    const message = {
      method: this.method,
      url: this.url,
      token: this.token,
      body: body ? JSON.parse(JSON.stringify(body)) : null  // Deep copy
    };

    // Send through network with callbacks
    network.send(
      message,
      
      // Success callback
      (response) => {
        this.status = response.status;
        this.responseText = JSON.stringify(response);
        if (this.onload) this.onload(response);
      },
      
      // Error callback
      (errorMessage) => {
        this.status = 0;  // 0 indicates network failure
        if (this.onerror) this.onerror(errorMessage);
      }
    );
  }
}