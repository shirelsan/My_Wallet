/* 
   dbApi.js — Database API (LocalStorage)
   Manages all application data using browser's LocalStorage
 */

/* ────────────────────────────────────────────────────────────
   USERS DB
   Storage key: "mw_users"
   Record: { id, username, email, password, createdAt }
   ──────────────────────────────────────────────────────────── */
const DBUsers = (() => {
  const KEY = 'mw_users';
  let _userCounter = 0;

  // Load users from LocalStorage
  function _load() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }

  // Save users to LocalStorage
  function _save(users) {
    localStorage.setItem(KEY, JSON.stringify(users));
  }

  // Generate unique user ID
  function _uid() {
    _userCounter++;
    return 'u_' + Date.now() + '_' + _userCounter;
  }

  /* ── Public API ─────────────────────────────────────────── */

  // Return all users
  function getAll() {
    return _load();
  }

  // Find user by username (case-insensitive)
  function findByUsername(username) {
    return _load().find(
      u => u.username.toLowerCase() === username.toLowerCase()
    ) || null;
  }

  // Find user by email (case-insensitive)
  function findByEmail(email) {
    return _load().find(
      u => u.email.toLowerCase() === email.toLowerCase()
    ) || null;
  }

  // Find user by ID
  function findById(id) {
    return _load().find(u => u.id === id) || null;
  }

  /* Add new user to the database
     Creates a user record with unique ID and timestamp.
     Returns the user object WITHOUT the password for security.
     
     Flow:
     1. Load existing users
     2. Create new record with generated ID
     3. Save to LocalStorage
     4. Return safe user object (without password field) */
  function add(data) {
    const users = _load();
    const record = {
      id: _uid(),
      username: data.username.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      createdAt: new Date().toISOString()
    };
    users.push(record);
    _save(users);

    // Return user without password (security)
    const { password, ...safe } = record;
    return safe;
  }

  /* Validate login credentials
     Checks if username and password match.
     Returns user object (without password) if valid, null otherwise. */
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
   Storage key: "mw_expenses"
   Record: { id, userId, title, amount, category, date, description, isPaid, createdAt, updatedAt }
   ──────────────────────────────────────────────────────────── */
const DBExpenses = (() => {
  const KEY = 'mw_expenses';
  let _expenseCounter = 0;

  // Load expenses from LocalStorage
  function _load() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }

  // Save expenses to LocalStorage
  function _save(expenses) {
    localStorage.setItem(KEY, JSON.stringify(expenses));
  }

  /* Generate unique expense ID
     Uses timestamp + counter to ensure uniqueness */
  function _uid() {
    _expenseCounter++;
    return 'exp_' + Date.now() + '_' + _expenseCounter;
  }

  /* ── Public API ─────────────────────────────────────────── */

  // Get all expenses for a specific user
  function getAllByUser(userId) {
    return _load().filter(e => e.userId === userId);
  }

  // Get single expense (only if it belongs to the user)
  function getOneByUser(id, userId) {
    return _load().find(e => e.id === id && e.userId === userId) || null;
  }

  /* Create new expense
     Generates ID, sets timestamps, saves to storage.
     Returns the created expense record. */
  function add(data) {
    const all = _load();
    const now = new Date().toISOString();
    const record = {
      id: _uid(),
      userId: data.userId,
      title: data.title.trim(),
      amount: parseFloat(data.amount),
      category: data.category,
      date: data.date,
      description: data.description || '',
      isPaid: data.isPaid || false,
      createdAt: now,
      updatedAt: now
    };
    all.push(record);
    _save(all);
    return record;
  }

  /* Update existing expense
     Only updates allowed fields for security.
     User must own the expense to update it.
     
     Flow:
     1. Load all expenses
     2. Find expense by ID and verify ownership
     3. Update only allowed fields
     4. Update timestamp
     5. Save and return updated record
     
     Allowed fields: title, amount, category, date, description, isPaid */
  function update(id, updates, userId) {
    const all = _load();
    const idx = all.findIndex(e => e.id === id && e.userId === userId);
    if (idx === -1) return null;

    // Update each field if provided
    if (updates.title) all[idx].title = updates.title;
    if (updates.amount) all[idx].amount = parseFloat(updates.amount);
    if (updates.category) all[idx].category = updates.category;
    if (updates.date) all[idx].date = updates.date;
    if (updates.description !== undefined) all[idx].description = updates.description;
    if (updates.isPaid !== undefined) all[idx].isPaid = updates.isPaid;

    all[idx].updatedAt = new Date().toISOString();
    _save(all);
    return all[idx];
  }

  // Delete expense (user must own it)
  function remove(id, userId) {
    const all = _load();
    const idx = all.findIndex(e => e.id === id && e.userId === userId);
    if (idx === -1) return false;
    all.splice(idx, 1);
    _save(all);
    return true;
  }

  /* Search expenses by text
     Searches in title, category, and description fields.
     Returns only expenses owned by the user.
     Case-insensitive search. */
  function search(query, userId) {
    const userExp = getAllByUser(userId);
    const q = query.toLowerCase().trim();
    if (!q) return userExp;
    return userExp.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.description && e.description.toLowerCase().includes(q))
    );
  }

  // Toggle payment status (paid/unpaid)
  function togglePaid(id, userId) {
    const exp = getOneByUser(id, userId);
    if (!exp) return null;
    return update(id, { isPaid: !exp.isPaid }, userId);
  }

  return { getAllByUser, getOneByUser, add, update, remove, search, togglePaid };
})();