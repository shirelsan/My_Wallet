/* ============================================================
   appServer.js — Expenses Application Server
   Handles all requests routed to  /expenses/*

   Every request MUST carry a valid session token.
   Token validation is delegated to AuthServer.validateToken().

   REST API:
     GET    /expenses              → list all expenses (current user)
     GET    /expenses/:id          → get one expense
     GET    /expenses/search?q=…   → search expenses
     POST   /expenses              → create new expense
     PUT    /expenses/:id          → update expense
     PUT    /expenses/:id/pay      → toggle paid/unpaid
     DELETE /expenses/:id          → delete expense

   Response envelope:
     { status: number, ok: boolean, message: string, data: any }
   ============================================================ */

const AppServer = (() => {

  /* ── Authentication check ───────────────────────────────── */
  function _auth(token) {
    // Returns userId string, or null if token invalid / missing
    return token ? AuthServer.validateToken(token) : null;
  }

  function _unauthorized() {
    return { status: 401, ok: false, message: 'Unauthorized – please log in', data: null };
  }

  /* ── URL parser ─────────────────────────────────────────── */
  // Extracts id and optional sub-action from the URL path.
  // Examples:
  //   /expenses           → { id: null,     action: null  }
  //   /expenses/exp_123   → { id: 'exp_123', action: null  }
  //   /expenses/exp_123/pay → { id: 'exp_123', action: 'pay' }
  //   /expenses/search    → { id: 'search', action: null  }
  function _parseUrl(url) {
    const parts = url.replace('/expenses', '').split('/').filter(Boolean);
    return {
      id:     parts[0] || null,
      action: parts[1] || null
    };
  }

  /* ── Body validator ─────────────────────────────────────── */
  function _validateBody(body) {
    if (!body)                             return 'Request body is missing';
    if (!body.title || !body.title.trim()) return 'Title is required';
    if (body.amount === undefined || body.amount === null) return 'Amount is required';
    if (isNaN(parseFloat(body.amount)) || parseFloat(body.amount) < 0)
      return 'Amount must be a non-negative number';
    return null;
  }

  /* ── Route handlers ─────────────────────────────────────── */
  function _getAll(userId) {
    const expenses = DBExpenses.getAllByUser(userId);
    return { status: 200, ok: true, message: 'OK', data: expenses };
  }

  function _getOne(id, userId) {
    const exp = DBExpenses.getOneByUser(id, userId);
    if (!exp) return { status: 404, ok: false, message: 'Expense not found', data: null };
    return { status: 200, ok: true, message: 'OK', data: exp };
  }

  function _search(url, userId) {
    // Extract ?q= param from the full URL string
    const qIdx = url.indexOf('?q=');
    const query = qIdx !== -1 ? decodeURIComponent(url.slice(qIdx + 3)) : '';
    const results = DBExpenses.search(query, userId);
    return { status: 200, ok: true, message: 'OK', data: results };
  }

  function _create(body, userId) {
    const err = _validateBody(body);
    if (err) return { status: 400, ok: false, message: err, data: null };

    const exp = DBExpenses.add({ ...body, userId });
    console.log(`[AppServer] ✓ Created expense: "${exp.title}"`);
    return { status: 201, ok: true, message: 'Expense created', data: exp };
  }

  function _update(id, body, userId) {
    if (!id) return { status: 400, ok: false, message: 'Expense ID required', data: null };
    const updated = DBExpenses.update(id, body, userId);
    if (!updated) return { status: 404, ok: false, message: 'Expense not found', data: null };
    console.log(`[AppServer] ✓ Updated expense: ${id}`);
    return { status: 200, ok: true, message: 'Expense updated', data: updated };
  }

  function _togglePay(id, userId) {
    if (!id) return { status: 400, ok: false, message: 'Expense ID required', data: null };
    const updated = DBExpenses.togglePaid(id, userId);
    if (!updated) return { status: 404, ok: false, message: 'Expense not found', data: null };
    const msg = updated.isPaid ? 'Marked as paid' : 'Marked as pending';
    console.log(`[AppServer] ✓ ${msg}: ${id}`);
    return { status: 200, ok: true, message: msg, data: updated };
  }

  function _delete(id, userId) {
    if (!id) return { status: 400, ok: false, message: 'Expense ID required', data: null };
    const ok = DBExpenses.remove(id, userId);
    if (!ok) return { status: 404, ok: false, message: 'Expense not found', data: null };
    console.log(`[AppServer] ✓ Deleted expense: ${id}`);
    return { status: 200, ok: true, message: 'Expense deleted', data: { id } };
  }

  /* ── Public interface ───────────────────────────────────── */

  /**
   * Main entry point — called by Network when a /expenses/* message arrives.
   * @param {{ method, url, token, body }} msg
   * @returns {{ status, ok, message, data }} response
   */
  function handleRequest(msg) {
    console.log(`[AppServer] ${msg.method} ${msg.url}`);

    // 1. Authenticate
    const userId = _auth(msg.token);
    if (!userId) return _unauthorized();

    // 2. Parse URL
    const { id, action } = _parseUrl(msg.url);

    try {
      // Special routes first
      // GET /expenses/search?q=...
      if (msg.method === 'GET' && id === 'search') return _search(msg.url, userId);

      // PUT /expenses/:id/pay
      if (msg.method === 'PUT' && action === 'pay') return _togglePay(id, userId);

      // Standard REST
      switch (msg.method) {
        case 'GET':    return id ? _getOne(id, userId) : _getAll(userId);
        case 'POST':   return _create(msg.body, userId);
        case 'PUT':    return _update(id, msg.body, userId);
        case 'DELETE': return _delete(id, userId);
        default:
          return { status: 405, ok: false, message: `Method not allowed: ${msg.method}`, data: null };
      }
    } catch (e) {
      console.error('[AppServer] Internal error:', e);
      return { status: 500, ok: false, message: 'Internal server error', data: null };
    }
  }

  return { handleRequest };
})();