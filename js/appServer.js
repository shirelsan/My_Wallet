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

/* ============================================================
   appServer.js — Expenses Application Server (Async Version)
   
   *** UPDATED: Now uses callbacks for async communication ***
   ============================================================ */

const AppServer = (() => {

  /* ── Authentication check ───────────────────────────────── */
  function _auth(token) {
    return token ? AuthServer.validateToken(token) : null;
  }

  function _unauthorized() {
    return { status: 401, ok: false, message: 'Unauthorized – please log in', data: null };
  }

  /* ── URL parser ─────────────────────────────────────────── */
  function _parseUrl(url) {
    const parts = url.replace('/expenses', '').split('/').filter(Boolean);
    return {
      id:     parts[0] || null,
      action: parts[1] || null
    };
  }

  /* ── Body validator ─────────────────────────────────────── */
  function _validateBody(body) {
    if (!body) return 'Request body is missing';
    if (!body.title || !body.title.trim()) return 'Title is required';
    if (body.amount === undefined || body.amount === null) return 'Amount is required';
    if (isNaN(parseFloat(body.amount)) || parseFloat(body.amount) < 0)
      return 'Amount must be a non-negative number';
    return null;
  }

  /* ── Route handlers (remain synchronous internally) ──────── */
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
   * *** UPDATED: Main entry point — now ASYNC with callback ***
   * Called by Network when a /expenses/* message arrives.
   * 
   * @param {{ method, url, token, body }} msg - Request message
   * @param {Function} callback - Called with response: (response) => void
   */
  function handleRequest(msg, callback) {
    // ↑ הוספנו פרמטר callback!
    
    console.log(`[AppServer] ${msg.method} ${msg.url}`);

    // 1. Authenticate
    const userId = _auth(msg.token);
    if (!userId) {
      callback(_unauthorized());
      // ↑ במקום return - קורא ל-callback
      return;
    }

    // 2. Parse URL
    const { id, action } = _parseUrl(msg.url);

    try {
      let response;  // ← נשמור את התגובה
      
      // Special routes
      if (msg.method === 'GET' && id === 'search') {
        response = _search(msg.url, userId);
      } else if (msg.method === 'PUT' && action === 'pay') {
        response = _togglePay(id, userId);
      } else {
        // Standard REST
        switch (msg.method) {
          case 'GET':
            response = id ? _getOne(id, userId) : _getAll(userId);
            break;
          case 'POST':
            response = _create(msg.body, userId);
            break;
          case 'PUT':
            response = _update(id, msg.body, userId);
            break;
          case 'DELETE':
            response = _delete(id, userId);
            break;
          default:
            response = { status: 405, ok: false, message: `Method not allowed: ${msg.method}`, data: null };
        }
      }
      
      // ✨ במקום return - קורא ל-callback!
      callback(response);
      
    } catch (e) {
      console.error('[AppServer] Internal error:', e);
      const errorResponse = { status: 500, ok: false, message: 'Internal server error', data: null };
      callback(errorResponse);
    }
  }

  return { handleRequest };
})();