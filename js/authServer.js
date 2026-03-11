/* ============================================================
   authServer.js — Authentication Server
   ============================================================ */

const AuthServer = (() => {

  const SESSIONS_KEY = 'mw_sessions';

  // ✨ FIX: Load sessions from localStorage instead of only memory
  function _loadSessions() {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  function _saveSessions(sessions) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  // Get active sessions (loaded from localStorage)
  let activeSessions = _loadSessions();

  // Create a new session token for a user
  function _createToken(userId) {
    const token = `tok_${userId}_${Date.now()}`;
    activeSessions[token] = userId;
    _saveSessions(activeSessions);  //  Save to localStorage
    console.log('[AuthServer] Token created and saved:', token);
    return token;
  }

  // Delete a session (used when logging out)
  function _destroyToken(token) {
    delete activeSessions[token];
    _saveSessions(activeSessions);  //  Save to localStorage
    console.log('[AuthServer] Token destroyed:', token);
  }

  // Make sure registration data is valid
  function _validateRegister(body) {
    if (!body)
      return 'Request body is missing';
    if (!body.username || body.username.trim().length < 3)
      return 'Username must be at least 3 characters';
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
      return 'A valid email address is required';
    if (!body.password || body.password.length < 4)
      return 'Password must be at least 4 characters';
    return null;
  }

  // Make sure login data is valid
  function _validateLogin(body) {
    if (!body) return 'Request body is missing';
    if (!body.username || !body.username.trim()) return 'Username is required';
    if (!body.password) return 'Password is required';
    return null;
  }

  /* ── Route handlers ─────────────────────────────────────── */

  // Handle user registration
  function _register(msg) {

    // Validate input
    const err = _validateRegister(msg.body);
    if (err) return { status: 400, ok: false, message: err, data: null };

    // Check for duplicates
    if (DBUsers.findByUsername(msg.body.username))
      return { status: 409, ok: false, message: 'Username already taken', data: null };

    if (DBUsers.findByEmail(msg.body.email))
      return { status: 409, ok: false, message: 'Email already registered', data: null };

    //  create the user
    const user = DBUsers.add(msg.body);
    const token = _createToken(user.id);

    console.log(`[AuthServer] ✓ Registered: ${user.username}`);
    return { status: 201, ok: true, message: 'Registration successful', data: { user, token } };
  }

  // Handle user login
  function _login(msg) {
    const err = _validateLogin(msg.body);
    if (err) return { status: 400, ok: false, message: err, data: null };

    // Check credentials
    const user = DBUsers.validateCredentials(msg.body.username, msg.body.password);
    if (!user)
      return { status: 401, ok: false, message: 'Invalid username or password', data: null };

    const token = _createToken(user.id);

    console.log(`[AuthServer] ✓ Login: ${user.username}`);
    return { status: 200, ok: true, message: 'Login successful', data: { user, token } };
  }


  function _logout(msg) {
    if (msg.token) _destroyToken(msg.token);
    return { status: 200, ok: true, message: 'Logged out', data: null };
  }

  // Main request handler for the AuthServer
  function handleRequest(msg, callback) {
    console.log(`[AuthServer] ${msg.method} ${msg.url}`);

    try {
      let response;

      // Route to the right handler based on URL
      if (msg.method === 'POST' && msg.url === '/auth/register') {
        response = _register(msg);
      } else if (msg.method === 'POST' && msg.url === '/auth/login') {
        response = _login(msg);
      } else if (msg.method === 'POST' && msg.url === '/auth/logout') {
        response = _logout(msg);
      } else {
        response = { status: 404, ok: false, message: `Auth route not found: ${msg.url}`, data: null };
      }

      // Send response back through callback
      callback(response);

    } catch (e) {
      console.error('[AuthServer] Internal error:', e);
      const errorResponse = { status: 500, ok: false, message: 'Internal server error', data: null };
      callback(errorResponse);
    }
  }

  // Validate a session token and return the associated user ID, or null if invalid
  function validateToken(token) {
    activeSessions = _loadSessions();
    const userId = activeSessions[token] || null;
    
    if (userId) {
      console.log(`[AuthServer] ✓ Token validated: ${token} → userId: ${userId}`);
    } else {
      console.log(`[AuthServer] ✗ Invalid token: ${token}`);
    }
    
    return userId;
  }

  return { handleRequest, validateToken };
})();