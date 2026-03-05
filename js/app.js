/* ============================================================
   app.js — Main Application Entry Point
   
   Orchestrates:
     - Global state management
     - SPA routing
     - Session/cookie management
     - FAJAX wrapper for network requests
     - Toast notifications
   
   Delegates UI logic to:
     - AuthUI (auth-ui.js)
     - ExpensesUI (expenses-ui.js)
     - ProfileUI (profile-ui.js)
   ============================================================ */

const App = (() => {

  /* ── State ──────────────────────────────────────────────── */
  let sessionToken = null;
  let sessionUser = null;
  let allExpenses = [];
  let editingId = null;
  let currentView = 'all';
  const pending = new Set();

  /* ── View config ────────────────────────────────────────── */
  const VIEW_CONFIG = {
    all:     { title: 'All Expenses',   sub: 'Track and manage your spending' },
    paid:    { title: 'Paid Expenses',  sub: 'Cleared and settled transactions' },
    unpaid:  { title: 'Pending',        sub: 'Expenses awaiting payment' },
    profile: { title: 'My Profile',     sub: 'Your account details and statistics' },
  };

  /* ── State getters ──────────────────────────────────────── */
  function getToken() { return sessionToken; }
  function getUser() { return sessionUser; }
  function getExpenses() { return allExpenses; }
  function getEditingId() { return editingId; }
  function getCurrentView() { return currentView; }
  function isPending(id) { return pending.has(id); }

  /* ── State setters ──────────────────────────────────────── */
  function setExpenses(exp) { allExpenses = exp; }
  function setEditingId(id) { editingId = id; }
  function addPending(id) { pending.add(id); }
  function removePending(id) { pending.delete(id); }

  /* ── Session management ─────────────────────────────────── */
  function setSession(token, user, remember = false) {
    sessionToken = token;
    sessionUser = user;
    CookieManager.saveSession(token, user);
    
    // Save username for "remember me"
    if (remember) {
      Cookies.set('mw_remember_username', user.username, 30);
    }
  }

  function clearSession() {
    CookieManager.clearSession();
    sessionToken = null;
    sessionUser = null;
    allExpenses = [];
    pending.clear();
  }

  /* ── FAJAX wrapper ──────────────────────────────────────── */
  function request(method, url, body, onSuccess, onFail) {
    const req = new FXMLHttpRequest();
    req.open(method, url);
    if (sessionToken) req.setToken(sessionToken);

    req.onload = (res) => {
      if (res.ok) {
        if (onSuccess) onSuccess(res);
      } else {
        if (onFail) onFail(res);
        else toast(res.message || 'Something went wrong', 'error');
      }
    };

    req.onerror = () => {
      toast('Network error – packet dropped. Please retry.', 'error');
      if (onFail) onFail({ message: 'network error' });
    };

    req.send(body);
  }

  /* ── Toast notifications ────────────────────────────────── */
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

  /* ── View management ────────────────────────────────────── */
  function showView(view) {
    currentView = view;

    // Update nav active state
    ['all', 'unpaid', 'paid', 'profile'].forEach(v => {
      document.getElementById(`nav-${v}`).classList.toggle('active', v === view);
    });

    const cfg = VIEW_CONFIG[view];
    document.getElementById('view-title').textContent = cfg.title;
    document.getElementById('view-subtitle').textContent = cfg.sub;

    // Show/hide panels
    const isProfile = view === 'profile';
    document.getElementById('expenses-panel').style.display = isProfile ? 'none' : '';
    document.getElementById('profile-view').style.display = isProfile ? '' : 'none';

    if (isProfile) {
      ProfileUI.render();
    } else {
      document.getElementById('list-title').textContent = cfg.title;
      document.getElementById('search-input').value = '';
      ExpensesUI.renderList(allExpenses);
    }
  }

  /* ── Page initialization ────────────────────────────────── */
  function initAuthPage() {
    AuthUI.init();
  }

  function initAppPage() {
    // Populate user info
    document.getElementById('sidebar-username').textContent = sessionUser.username;
    document.getElementById('user-avatar').textContent = sessionUser.username[0].toUpperCase();

    // Nav buttons
    document.getElementById('nav-all').addEventListener('click', () => showView('all'));
    document.getElementById('nav-unpaid').addEventListener('click', () => showView('unpaid'));
    document.getElementById('nav-paid').addEventListener('click', () => showView('paid'));
    document.getElementById('nav-profile').addEventListener('click', () => showView('profile'));

    // Logout
    document.getElementById('btn-logout').addEventListener('click', AuthUI.doLogout);

    // Initialize expenses UI
    ExpensesUI.init();
    ExpensesUI.loadExpenses();
  }

  /* ── SPA registration ───────────────────────────────────── */
  function registerPages() {
    SPA.register('auth', {
      template: '#tpl-auth',
      onEnter: initAuthPage,
      onLeave: null
    });

    SPA.register('app', {
      template: '#tpl-app',
      onEnter: initAppPage,
      onLeave: null
    });
  }

  /* ── Boot ───────────────────────────────────────────────── */
  function boot() {
    registerPages();

    // Check for existing session
    const saved = CookieManager.loadSession();
    if (saved) {
      sessionToken = saved.token;
      sessionUser = saved.user;
      SPA.navigate('app');
    } else {
      SPA.navigate('auth');
    }
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    // State
    getToken,
    getUser,
    getExpenses,
    getEditingId,
    getCurrentView,
    isPending,
    setExpenses,
    setEditingId,
    addPending,
    removePending,
    
    // Session
    setSession,
    clearSession,
    
    // Network
    request,
    
    // UI
    toast,
    showView,
    
    // Boot
    boot
  };
})();

/* ── Start app when DOM ready ───────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  App.boot();
});