/* ============================================================
   app.js — Client Application Logic
   Wires together: SPA router, FAJAX requests, UI rendering.

   State:
     sessionToken — auth token received from authServer
     sessionUser  — safe user object { id, username, email }
     allExpenses  — cached array of the user's expense records
     editingId    — id of the expense being edited (null = new)
     currentView  — 'all' | 'paid' | 'unpaid'
     _pending     — Set of expense IDs currently being processed
                    (prevents duplicate requests / race conditions)
   ============================================================ */

/* ── App-level state ─────────────────────────────────────── */
let sessionToken = null;
let sessionUser  = null;
let allExpenses  = [];
let editingId    = null;
let currentView  = 'all';
let _searchTimer = null;
const _pending   = new Set(); // ← Race condition protection

/* ============================================================
   BOOT — runs after the DOM is ready
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  _registerPages();

  // ── Cookie session check ───────────────────────────────
  // If a valid session cookie exists (not yet expired),
  // skip the login screen and go straight into the app.
  const saved = CookieManager.loadSession();
  if (saved) {
    sessionToken = saved.token;
    sessionUser  = saved.user;
    SPA.navigate('app');
  } else {
    SPA.navigate('auth');
  }
});

/* ============================================================
   SPA PAGE REGISTRATION
   ============================================================ */
function _registerPages() {
  SPA.register('auth', {
    template: '#tpl-auth',
    onEnter:  _initAuthPage,
    onLeave:  null
  });

  SPA.register('app', {
    template: '#tpl-app',
    onEnter:  _initAppPage,
    onLeave:  null
  });
}

/* ============================================================
   UTILITY — FAJAX WRAPPER
   Sends a request via FAJAX and handles responses uniformly.
   ============================================================ */
/**
 * @param {string}   method    'GET' | 'POST' | 'PUT' | 'DELETE'
 * @param {string}   url       endpoint path
 * @param {Object}   body      request payload (null for GET/DELETE)
 * @param {Function} onSuccess called with full response when ok === true
 * @param {Function} [onFail]  called with response when ok === false
 *                             (defaults to showing a toast)
 */
function fajax(method, url, body, onSuccess, onFail) {
  const req = new FXMLHttpRequest();
  req.open(method, url);
  if (sessionToken) req.setToken(sessionToken);

  req.onload = (res) => {
    if (res.ok) {
      if (onSuccess) onSuccess(res);
    } else {
      if (onFail) onFail(res);
      else        toast(res.message || 'Something went wrong', 'error');
    }
  };

  req.onerror = () => {
    toast('Network error – packet dropped. Please retry.', 'error');
    if (onFail) onFail({ message: 'network error' });
  };

  req.send(body);
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
/**
 * Display a temporary notification at the bottom-right.
 * @param {string} msg
 * @param {'success'|'error'|'warning'} type
 */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${{ success: '✓', error: '✗', warning: '⚠' }[type] || 'ℹ'}</span>
                  <span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ============================================================
   AUTH PAGE
   ============================================================ */
function _initAuthPage() {
  // Wire tab buttons
  document.getElementById('tab-login').addEventListener('click',    () => _showAuthTab('login'));
  document.getElementById('tab-register').addEventListener('click', () => _showAuthTab('register'));

  // Wire submit buttons
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('btn-register').addEventListener('click', doRegister);

  // Enter key submits
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('reg-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doRegister();
  });
}

function _showAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
  _setAuthMsg('');
}

function _setAuthMsg(msg, type = '') {
  const el = document.getElementById('auth-msg');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'auth-msg' + (type ? ` ${type}` : '');
}

/* ── Login ────────────────────────────────────────────────── */
function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { _setAuthMsg('Please fill in all fields', 'error'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';
  _setAuthMsg('Connecting…', 'pending');

  fajax('POST', '/auth/login', { username, password },
    (res) => {
      sessionToken = res.data.token;
      sessionUser  = res.data.user;
      CookieManager.saveSession(sessionToken, sessionUser); // ← save cookie
      btn.disabled = false;
      btn.innerHTML = '<span>Sign In</span>';
      SPA.navigate('app');
    },
    (res) => {
      _setAuthMsg(res.message || 'Login failed', 'error');
      btn.disabled = false;
      btn.innerHTML = '<span>Sign In</span>';
    }
  );
}

/* ── Register ─────────────────────────────────────────────── */
function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !email || !password) { _setAuthMsg('Please fill in all fields', 'error'); return; }

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account…';
  _setAuthMsg('Creating your account…', 'pending');

  fajax('POST', '/auth/register', { username, email, password },
    (res) => {
      sessionToken = res.data.token;
      sessionUser  = res.data.user;
      CookieManager.saveSession(sessionToken, sessionUser); // ← save cookie
      btn.disabled = false;
      btn.innerHTML = '<span>Create Account</span>';
      SPA.navigate('app');
    },
    (res) => {
      _setAuthMsg(res.message || 'Registration failed', 'error');
      btn.disabled = false;
      btn.innerHTML = '<span>Create Account</span>';
    }
  );
}

/* ============================================================
   APP PAGE
   ============================================================ */
function _initAppPage() {
  // Populate user info in sidebar
  document.getElementById('sidebar-username').textContent = sessionUser.username;
  document.getElementById('user-avatar').textContent = sessionUser.username[0].toUpperCase();

  // Default date in modal
  document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];

  // Nav buttons
  document.getElementById('nav-all').addEventListener('click',     () => showView('all'));
  document.getElementById('nav-unpaid').addEventListener('click',  () => showView('unpaid'));
  document.getElementById('nav-paid').addEventListener('click',    () => showView('paid'));
  document.getElementById('nav-profile').addEventListener('click', () => showView('profile'));

  // Toolbar
  document.getElementById('btn-add').addEventListener('click', openModal);
  document.getElementById('search-input').addEventListener('input', e => handleSearch(e.target.value));

  // Modal buttons
  document.getElementById('btn-save').addEventListener('click', saveExpense);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);

  // Close modal when clicking the dark overlay behind it
  document.getElementById('expense-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', doLogout);

  // Load expenses from server
  loadExpenses();
}

/* ── Logout ───────────────────────────────────────────────── */
function doLogout() {
  fajax('POST', '/auth/logout', null, () => {});
  CookieManager.clearSession(); // ← clear cookie on logout
  sessionToken = null;
  sessionUser  = null;
  allExpenses  = [];
  _pending.clear();
  SPA.navigate('auth');
}

/* ============================================================
   NAV / VIEW
   ============================================================ */
const VIEW_CONFIG = {
  all:     { title: 'All Expenses',   sub: 'Track and manage your spending' },
  paid:    { title: 'Paid Expenses',  sub: 'Cleared and settled transactions' },
  unpaid:  { title: 'Pending',        sub: 'Expenses awaiting payment' },
  profile: { title: 'My Profile',     sub: 'Your account details and statistics' },
};

function showView(view) {
  currentView = view;

  // Update nav active state (all 4 nav items)
  ['all', 'unpaid', 'paid', 'profile'].forEach(v => {
    document.getElementById(`nav-${v}`).classList.toggle('active', v === view);
  });

  const cfg = VIEW_CONFIG[view];
  document.getElementById('view-title').textContent    = cfg.title;
  document.getElementById('view-subtitle').textContent = cfg.sub;

  // Show/hide the two panels
  const isProfile = view === 'profile';
  document.getElementById('expenses-panel').style.display = isProfile ? 'none' : '';
  document.getElementById('profile-view').style.display   = isProfile ? ''     : 'none';

  if (isProfile) {
    renderProfile();
  } else {
    document.getElementById('list-title').textContent = cfg.title;
    document.getElementById('search-input').value = '';
    renderList(allExpenses);
  }
}

/* ============================================================
   LOAD & RENDER EXPENSES
   ============================================================ */
function loadExpenses() {
  document.getElementById('expense-list').innerHTML =
    '<div class="loading-row"><span class="spinner"></span> Loading your expenses…</div>';

  fajax('GET', '/expenses', null, (res) => {
    allExpenses = res.data || [];
    renderList(allExpenses);
    updateStats(allExpenses);
  });
}

/* ── Category config ──────────────────────────────────────── */
const CATS = {
  Food:      { icon: '🍔', cls: 'cat-food' },
  Transport: { icon: '🚗', cls: 'cat-transport' },
  Health:    { icon: '🏥', cls: 'cat-health' },
  Housing:   { icon: '🏠', cls: 'cat-housing' },
  Shopping:  { icon: '🛍️', cls: 'cat-shopping' },
  General:   { icon: '📦', cls: 'cat-general' },
};
function _catInfo(cat) {
  return CATS[cat] || { icon: '💰', cls: 'cat-general' };
}

function renderList(expenses) {
  let list = [...expenses];
  if (currentView === 'paid')   list = list.filter(e => e.isPaid);
  if (currentView === 'unpaid') list = list.filter(e => !e.isPaid);
  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  const el = document.getElementById('expense-list');

  if (list.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🪙</div>
        <p>No expenses here yet.<br>
           Click <strong>＋ Add Expense</strong> to get started!</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(e => {
    const ci  = _catInfo(e.category);
    const amt = '₪' + parseFloat(e.amount).toLocaleString('he-IL', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const date = new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    const payTitle = e.isPaid ? 'Mark as pending' : 'Mark as paid';
    const payIcon  = e.isPaid ? '↺' : '✓';

    return `
      <div class="expense-item">
        <div class="expense-cat-icon ${ci.cls}">${ci.icon}</div>
        <div class="expense-info">
          <div class="expense-title">${e.title}</div>
          <div class="expense-meta">
            <span>${date}</span>
            <span class="badge badge-cat">${e.category}</span>
            <span class="badge ${e.isPaid ? 'badge-paid' : 'badge-unpaid'}">
              ${e.isPaid ? '✓ Paid' : '⏳ Pending'}
            </span>
            ${e.description ? `<span>· ${e.description}</span>` : ''}
          </div>
        </div>
        <div class="expense-amount">${amt}</div>
        <div class="expense-actions">
          <button class="action-btn pay"  title="${payTitle}"
                  onclick="togglePay('${e.id}')">${payIcon}</button>
          <button class="action-btn edit" title="Edit"
                  onclick="openEdit('${e.id}')">✎</button>
          <button class="action-btn del"  title="Delete"
                  onclick="deleteExpense('${e.id}')">🗑</button>
        </div>
      </div>`;
  }).join('');
}

/* ── Stats ────────────────────────────────────────────────── */
function updateStats(expenses) {
  const fmt = v => '₪' + v.toLocaleString('he-IL', {
    minimumFractionDigits: 0, maximumFractionDigits: 0
  });
  const n = v => `${v} expense${v !== 1 ? 's' : ''}`;

  const total  = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const paid   = expenses.filter(e =>  e.isPaid);
  const unpaid = expenses.filter(e => !e.isPaid);

  document.getElementById('stat-total').textContent        = fmt(total);
  document.getElementById('stat-count').textContent        = n(expenses.length);
  document.getElementById('stat-paid').textContent         = fmt(paid.reduce((s, e) => s + parseFloat(e.amount), 0));
  document.getElementById('stat-paid-count').textContent   = n(paid.length);
  document.getElementById('stat-unpaid').textContent       = fmt(unpaid.reduce((s, e) => s + parseFloat(e.amount), 0));
  document.getElementById('stat-unpaid-count').textContent = n(unpaid.length);
}

/* ============================================================
   SEARCH
   Filters instantly on the local allExpenses array — no network
   request needed. Searches title, category, and description.
   ============================================================ */
function handleSearch(q) {
  const query = q.trim().toLowerCase();

  // Empty query → show all expenses
  if (!query) {
    renderList(allExpenses);
    return;
  }

  // Filter locally — instant, no FAJAX, no delay, no drops
  const filtered = allExpenses.filter(e =>
    e.title.toLowerCase().includes(query)    ||
    e.category.toLowerCase().includes(query) ||
    (e.description && e.description.toLowerCase().includes(query))
  );

  renderList(filtered);
}

/* ============================================================
   MODAL — ADD / EDIT EXPENSE
   ============================================================ */
function openModal() {
  editingId = null;
  document.getElementById('modal-title').textContent   = 'Add Expense';
  document.getElementById('exp-title').value     = '';
  document.getElementById('exp-amount').value    = '';
  document.getElementById('exp-date').value      = new Date().toISOString().split('T')[0];
  document.getElementById('exp-category').value  = 'Food';
  document.getElementById('exp-paid').value      = 'false';
  document.getElementById('exp-desc').value      = '';
  document.getElementById('btn-save').textContent = 'Save Expense';
  document.getElementById('expense-modal').classList.add('open');
}

function openEdit(id) {
  const exp = allExpenses.find(e => e.id === id);
  if (!exp) return;
  editingId = id;
  document.getElementById('modal-title').textContent   = 'Edit Expense';
  document.getElementById('exp-title').value     = exp.title;
  document.getElementById('exp-amount').value    = exp.amount;
  document.getElementById('exp-date').value      = exp.date;
  document.getElementById('exp-category').value  = exp.category;
  document.getElementById('exp-paid').value      = String(exp.isPaid);
  document.getElementById('exp-desc').value      = exp.description || '';
  document.getElementById('btn-save').textContent = 'Update Expense';
  document.getElementById('expense-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('expense-modal').classList.remove('open');
}

/* ── Save (create or update) ──────────────────────────────── */
function saveExpense() {
  const title    = document.getElementById('exp-title').value.trim();
  const amount   = document.getElementById('exp-amount').value;
  const date     = document.getElementById('exp-date').value;
  const category = document.getElementById('exp-category').value;
  const isPaid   = document.getElementById('exp-paid').value === 'true';
  const desc     = document.getElementById('exp-desc').value.trim();

  if (!title)                            { toast('Please enter a title',        'warning'); return; }
  if (!amount || parseFloat(amount) < 0) { toast('Please enter a valid amount', 'warning'); return; }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  const body = { title, amount: parseFloat(amount), date, category, isPaid, description: desc };

  const _done = (res, msg) => {
    btn.disabled = false;
    btn.textContent = editingId ? 'Update Expense' : 'Save Expense';
    if (editingId) {
      const idx = allExpenses.findIndex(e => e.id === editingId);
      if (idx !== -1) allExpenses[idx] = res.data;
    } else {
      allExpenses.push(res.data);
    }
    renderList(allExpenses);
    updateStats(allExpenses);
    closeModal();
    toast(msg, 'success');
  };

  const _fail = (res) => {
    btn.disabled = false;
    btn.textContent = editingId ? 'Update Expense' : 'Save Expense';
    toast(res.message || 'Failed to save. Please retry.', 'error');
  };

  if (editingId) {
    fajax('PUT', `/expenses/${editingId}`, body, res => _done(res, 'Expense updated!'), _fail);
  } else {
    fajax('POST', '/expenses', body, res => _done(res, 'Expense added!'), _fail);
  }
}

/* ============================================================
   TOGGLE PAID
   Guarded by _pending to prevent race conditions:
   if a request for this ID is already in-flight, ignore click.
   ============================================================ */
function togglePay(id) {
  if (_pending.has(id)) return;   // ← already in-flight, ignore
  _pending.add(id);               // ← lock this ID

  fajax('PUT', `/expenses/${id}/pay`, null,
    (res) => {
      _pending.delete(id);        // ← unlock on success
      const idx = allExpenses.findIndex(e => e.id === id);
      if (idx !== -1) allExpenses[idx] = res.data;
      renderList(allExpenses);
      updateStats(allExpenses);
      toast(res.message, 'success');
    },
    (res) => {
      _pending.delete(id);        // ← unlock on failure too
      toast(res.message || 'Failed to update. Please retry.', 'error');
    }
  );
}

/* ============================================================
   DELETE
   Guarded by _pending to prevent race conditions:
   if a request for this ID is already in-flight, ignore click.
   ============================================================ */
function deleteExpense(id) {
  if (_pending.has(id)) return;   // ← already in-flight, ignore

  const exp = allExpenses.find(e => e.id === id);
  if (!exp || !confirm(`Delete "${exp.title}"?`)) return;

  _pending.add(id);               // ← lock this ID

  fajax('DELETE', `/expenses/${id}`, null,
    () => {
      _pending.delete(id);        // ← unlock on success
      allExpenses = allExpenses.filter(e => e.id !== id);
      renderList(allExpenses);
      updateStats(allExpenses);
      toast('Expense deleted', 'warning');
    },
    (res) => {
      _pending.delete(id);        // ← unlock on failure too
      toast(res.message || 'Failed to delete. Please retry.', 'error');
    }
  );
}

/* ============================================================
   PROFILE PAGE
   Renders user info + statistics + two hand-drawn charts.
   All data comes from the local allExpenses array (no network).
   ============================================================ */

/* ── Category colours (donut slices) ─────────────────────── */
const CAT_COLORS = {
  Food:      '#ff7d3b',
  Transport: '#1e6fff',
  Health:    '#f04b4b',
  Housing:   '#00c07a',
  Shopping:  '#a855f7',
  General:   '#8a95a3',
};

function renderProfile() {
  const user     = sessionUser;
  const expenses = allExpenses;

  /* ── User info ────────────────────────────────────────── */
  document.getElementById('profile-avatar').textContent = user.username[0].toUpperCase();
  document.getElementById('profile-name').textContent   = user.username;
  document.getElementById('profile-email').textContent  = user.email || '—';

  // createdAt comes from DBUsers — find via the stored user object
  const rawUser = DBUsers.findById(user.id);
  if (rawUser && rawUser.createdAt) {
    const since = new Date(rawUser.createdAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    document.getElementById('profile-since').textContent = `Member since ${since}`;
  }

  /* ── Stats numbers ────────────────────────────────────── */
  const total  = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const paid   = expenses.filter(e => e.isPaid);
  const paidPct = expenses.length ? Math.round((paid.length / expenses.length) * 100) : 0;
  const avg    = expenses.length ? total / expenses.length : 0;

  const fmtIL = v => '₪' + v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  document.getElementById('ps-total-amount').textContent = fmtIL(total);
  document.getElementById('ps-total-count').textContent  = expenses.length;
  document.getElementById('ps-paid-pct').textContent     = paidPct + '%';
  document.getElementById('ps-avg').textContent          = fmtIL(avg);

  /* ── Charts ───────────────────────────────────────────── */
  _renderDonut(expenses, fmtIL);
  _renderBarChart(expenses, fmtIL);
}

/* ── Donut chart — spending by category ──────────────────── */
function _renderDonut(expenses, fmtIL) {
  const canvas = document.getElementById('chart-donut');
  const legend = document.getElementById('donut-legend');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const radius = 85, inner = 50;

  // Aggregate by category
  const totals = {};
  expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount);
  });

  const grand = Object.values(totals).reduce((s, v) => s + v, 0);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  // Clear
  ctx.clearRect(0, 0, W, H);

  if (grand === 0) {
    ctx.fillStyle = '#eaecf0';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
    ctx.fill();
    legend.innerHTML = '<div style="color:var(--gray-500);font-size:.82rem">No data yet</div>';
    return;
  }

  // Draw slices
  let startAngle = -Math.PI / 2;
  entries.forEach(([cat, val]) => {
    const slice = (val / grand) * Math.PI * 2;
    const color = CAT_COLORS[cat] || '#8a95a3';

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Thin gap between slices
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Center label
  ctx.fillStyle = '#1a2030';
  ctx.font = 'bold 13px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmtIL(grand), cx, cy);

  // Legend
  legend.innerHTML = entries.map(([cat, val]) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${CAT_COLORS[cat] || '#8a95a3'}"></span>
      <span>${cat}</span>
      <span class="legend-pct">${Math.round((val / grand) * 100)}%</span>
    </div>
  `).join('');
}

/* ── Bar chart — top 5 expenses ──────────────────────────── */
function _renderBarChart(expenses, fmtIL) {
  const container = document.getElementById('bar-chart');
  if (!container) return;

  if (expenses.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem"><div class="empty-icon">📊</div><p>No expenses yet</p></div>';
    return;
  }

  // Sort by amount descending, take top 5
  const top5 = [...expenses]
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
    .slice(0, 5);

  const max = parseFloat(top5[0].amount);

  container.innerHTML = top5.map(e => {
    const pct  = Math.round((parseFloat(e.amount) / max) * 100);
    const ci   = _catInfo(e.category);
    return `
      <div class="bar-row">
        <div class="bar-label" title="${e.title}">
          ${ci.icon} ${e.title}
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="bar-amount">${fmtIL(parseFloat(e.amount))}</div>
      </div>`;
  }).join('');
}