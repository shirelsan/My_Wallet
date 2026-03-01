/* ============================================================
   authServer.js — Authentication Server
   Handles all requests routed to  /auth/*

   Endpoints:
     POST /auth/register  → register a new user
     POST /auth/login     → login an existing user
     POST /auth/logout    → invalidate session token

   Response envelope (all responses):
     { status: number, ok: boolean, message: string, data: any }

   Session tokens are kept in an in-memory Map:
     activeSessions: token → userId
   The appServer (appServer.js) calls  AuthServer.validateToken()
   to authenticate every expense request.
   ============================================================ */

const AuthServer = (() => {

  /* ── In-memory session store ────────────────────────────── */
  // token → userId
  const activeSessions = {};

  /* ── Token helpers ──────────────────────────────────────── */
  function _createToken(userId) {
    const token = `tok_${userId}_${Date.now()}`;
    activeSessions[token] = userId;
    return token;
  }

  function _destroyToken(token) {
    delete activeSessions[token];
  }

  /* ── Input validators ───────────────────────────────────── */
  function _validateRegister(body) {
    if (!body)                                       return 'Request body is missing';
    if (!body.username || body.username.trim().length < 3)
      return 'Username must be at least 3 characters';
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
      return 'A valid email address is required';
    if (!body.password || body.password.length < 4)  return 'Password must be at least 4 characters';
    return null; // null = valid
  }

  function _validateLogin(body) {
    if (!body)                               return 'Request body is missing';
    if (!body.username || !body.username.trim()) return 'Username is required';
    if (!body.password)                      return 'Password is required';
    return null;
  }

  /* ── Route handlers ─────────────────────────────────────── */
  function _register(msg) {
    const err = _validateRegister(msg.body);
    if (err) return { status: 400, ok: false, message: err, data: null };

    if (DBUsers.findByUsername(msg.body.username))
      return { status: 409, ok: false, message: 'Username already taken', data: null };

    if (DBUsers.findByEmail(msg.body.email))
      return { status: 409, ok: false, message: 'Email already registered', data: null };

    const user  = DBUsers.add(msg.body);          // returns safe user (no password)
    const token = _createToken(user.id);

    console.log(`[AuthServer] ✓ Registered: ${user.username}`);
    return { status: 201, ok: true, message: 'Registration successful', data: { user, token } };
  }

  function _login(msg) {
    const err = _validateLogin(msg.body);
    if (err) return { status: 400, ok: false, message: err, data: null };

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

  /* ── Public interface ───────────────────────────────────── */

  /**
   * Main entry point — called by Network when a /auth/* message arrives.
   * @param {{ method, url, token, body }} msg
   * @returns {{ status, ok, message, data }} response
   */
  function handleRequest(msg) {
    console.log(`[AuthServer] ${msg.method} ${msg.url}`);
    try {
      if (msg.method === 'POST' && msg.url === '/auth/register') return _register(msg);
      if (msg.method === 'POST' && msg.url === '/auth/login')    return _login(msg);
      if (msg.method === 'POST' && msg.url === '/auth/logout')   return _logout(msg);

      return { status: 404, ok: false, message: `Auth route not found: ${msg.url}`, data: null };
    } catch (e) {
      console.error('[AuthServer] Internal error:', e);
      return { status: 500, ok: false, message: 'Internal server error', data: null };
    }
  }

  /**
   * Validate a session token.
   * Called by appServer.js for every expense request.
   * @param {string} token
   * @returns {string|null} userId if valid, null otherwise
   */
  function validateToken(token) {
    return activeSessions[token] || null;
  }

  return { handleRequest, validateToken };
})();