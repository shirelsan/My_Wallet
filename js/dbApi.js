/* ============================================================
   dbApi.js — Database API (LocalStorage)
   Exposes two namespaced APIs:
     DBUsers    — users table
     DBExpenses — expenses table
   Only server-side code (authServer.js / appServer.js) should
   call these functions directly.
   ============================================================ */

/* ────────────────────────────────────────────────────────────
   USERS DB
   Storage key : "mw_users"
   Record shape: { id, username, email, password, createdAt }
   ──────────────────────────────────────────────────────────── */
const DBUsers = (() => {
  const KEY = 'mw_users';

  /* internal helpers */
  function _load() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function _save(users) {
    localStorage.setItem(KEY, JSON.stringify(users));
  }
  function _uid() {
    return 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /* ── Public API ─────────────────────────────────────────── */

  /** Return every user record */
  function getAll() {
    return _load();
  }

  /** Find by username (case-insensitive). Returns record or null. */
  function findByUsername(username) {
    return _load().find(
      u => u.username.toLowerCase() === username.toLowerCase()
    ) || null;
  }

  /** Find by email (case-insensitive). Returns record or null. */
  function findByEmail(email) {
    return _load().find(
      u => u.email.toLowerCase() === email.toLowerCase()
    ) || null;
  }

  /** Find by id. Returns record or null. */
  function findById(id) {
    return _load().find(u => u.id === id) || null;
  }

  /**
   * Add a new user.
   * @param {{ username, email, password }} data
   * @returns {Object} safe user (no password field)
   */
  function add(data) {
    const users = _load();
    const record = {
      id:        _uid(),
      username:  data.username.trim(),
      email:     data.email.trim().toLowerCase(),
      password:  data.password,          // plain-text for this simulation
      createdAt: new Date().toISOString()
    };
    users.push(record);
    _save(users);

    const { password, ...safe } = record;
    return safe;
  }

  /**
   * Validate login credentials.
   * @returns {Object|null} safe user if valid, null otherwise
   */
  function validateCredentials(username, password) {
    const user = findByUsername(username);
    if (!user || user.password !== password) return null;
    const { password: _, ...safe } = user;
    return safe;
  }

  return { getAll, findByUsername, findByEmail, findById, add, validateCredentials };
})();


/* ────────────────────────────────────────────────────────────
   EXPENSES DB
   Storage key : "mw_expenses"
   Record shape: {
     id, userId, title, amount, category,
     date, description, isPaid, createdAt, updatedAt
   }
   ──────────────────────────────────────────────────────────── */
const DBExpenses = (() => {
  const KEY = 'mw_expenses';

  /* internal helpers */
  function _load() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function _save(expenses) {
    localStorage.setItem(KEY, JSON.stringify(expenses));
  }
  function _uid() {
    return 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /* ── Public API ─────────────────────────────────────────── */

  /** All expenses owned by userId */
  function getAllByUser(userId) {
    return _load().filter(e => e.userId === userId);
  }

  /** Single expense by id, must belong to userId. Returns null if not found. */
  function getOneByUser(id, userId) {
    return _load().find(e => e.id === id && e.userId === userId) || null;
  }

  /**
   * Create a new expense.
   * @param {{ userId, title, amount, category, date, description, isPaid }} data
   */
  function add(data) {
    const all = _load();
    const now = new Date().toISOString();
    const record = {
      id:          _uid(),
      userId:      data.userId,
      title:       data.title.trim(),
      amount:      parseFloat(data.amount),
      category:    data.category  || 'General',
      date:        data.date      || now.split('T')[0],
      description: data.description || '',
      isPaid:      data.isPaid    || false,
      createdAt:   now,
      updatedAt:   now
    };
    all.push(record);
    _save(all);
    return record;
  }

  /**
   * Update an existing expense (owner-only).
   * @returns {Object|null} updated record, or null if not found
   */
  function update(id, updates, userId) {
    const all = _load();
    const idx = all.findIndex(e => e.id === id && e.userId === userId);
    if (idx === -1) return null;

    const allowed = ['title', 'amount', 'category', 'date', 'description', 'isPaid'];
    allowed.forEach(field => {
      if (updates[field] !== undefined) {
        all[idx][field] = (field === 'amount')
          ? parseFloat(updates[field])
          : updates[field];
      }
    });
    all[idx].updatedAt = new Date().toISOString();
    _save(all);
    return all[idx];
  }

  /**
   * Delete an expense (owner-only).
   * @returns {boolean} true if deleted
   */
  function remove(id, userId) {
    const all = _load();
    const idx = all.findIndex(e => e.id === id && e.userId === userId);
    if (idx === -1) return false;
    all.splice(idx, 1);
    _save(all);
    return true;
  }

  /**
   * Full-text search across title, category, description (owner's records only).
   * @returns {Array}
   */
  function search(query, userId) {
    const userExp = getAllByUser(userId);
    const q = query.toLowerCase().trim();
    if (!q) return userExp;
    return userExp.filter(e =>
      e.title.toLowerCase().includes(q)       ||
      e.category.toLowerCase().includes(q)    ||
      (e.description && e.description.toLowerCase().includes(q))
    );
  }

  /**
   * Toggle isPaid for an expense (owner-only).
   * @returns {Object|null}
   */
  function togglePaid(id, userId) {
    const exp = getOneByUser(id, userId);
    if (!exp) return null;
    return update(id, { isPaid: !exp.isPaid }, userId);
  }

  return { getAllByUser, getOneByUser, add, update, remove, search, togglePaid };
})();