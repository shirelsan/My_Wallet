/* ============================================================
   app.js — Main Application Entry Point

   ============================================================ */

const App = (() => {

  /* ── Global state ───────────────────────────────────────── */

  let sessionToken = null;   // Current auth token (null if logged out)
  let sessionUser = null;    // Current user object (null if logged out)
  let allExpenses = [];      // Cached expenses (loaded once, updated locally)
  let editingId = null;      // Which expense we're editing (null if adding new)
  let currentView = 'all';   // Current filter: 'all', 'paid', 'unpaid', or 'profile'

  // Race condition handling - track active requests
  const activeRequests = new Map();  // url → FXMLHttpRequest object

  /* ── View configuration ─────────────────────────────────── */

  // Titles and subtitles for each view (used in header)
  const VIEW_CONFIG = {
    all: { title: 'All Expenses', sub: 'Track and manage your spending' },
    paid: { title: 'Paid Expenses', sub: 'Cleared and settled transactions' },
    unpaid: { title: 'Pending', sub: 'Expenses awaiting payment' },
    profile: { title: 'My Profile', sub: 'Your account details and statistics' },
  };

  /* ── State getters ──────────────────────────────────────── */

  // These let other modules read state without directly accessing it
  // (Encapsulation - it's a good thing!)

  function getToken() { return sessionToken; }
  function getUser() { return sessionUser; }
  function getExpenses() { return allExpenses; }
  function getEditingId() { return editingId; }
  function getCurrentView() { return currentView; }

  /* ── State setters ──────────────────────────────────────── */

  function setExpenses(exp) { allExpenses = exp; }
  function setEditingId(id) { editingId = id; }

  /* ── Session management ─────────────────────────────────── */

  function setSession(token, user, remember = false) {
    sessionToken = token;
    sessionUser = user;
    CookieManager.saveSession(token, user);

    // "Remember me" just saves the username for next time
    if (remember) {
      CookieManager.set('mw_remember_username', user.username, 30);
    }
  }

  // Clear session on logout
  function clearSession() {
    //  Cancel all active requests before clearing session
    cancelAllRequests();

    CookieManager.clearSession();
    sessionToken = null;
    sessionUser = null;
    allExpenses = [];
  }

  /* ── Network request wrapper ────────────────────────────── */

  function request(method, url, body, onSuccess, onFail) {
    //  Cancel any previous request to the same URL
    if (activeRequests.has(url)) {
      console.log(`[App] Cancelling previous request to ${url}`);
      activeRequests.get(url).abort();
    }

    const req = new FXMLHttpRequest();
    req.open(method, url);
    if (sessionToken) req.setToken(sessionToken);

    // Store this request
    activeRequests.set(url, req);
    // Handle retry progress for user feedback
    req.onprogress = (event) => {
      if (event.type === 'retry') {
        const delaySeconds = (event.delay / 1000).toFixed(1);
        toast(
          `Network error. Retrying (${event.attempt}/${event.maxRetries}) in ${delaySeconds}s...`,
          'warning'
        );
      }
    };

    // Success handler
    req.onload = (res) => {
      //  Remove from active requests
      activeRequests.delete(url);

      if (res.ok) {
        if (onSuccess) onSuccess(res);
      } else {
        // Server returned an error (400, 401, 404, etc)
        if (onFail) onFail(res);
        else toast(res.message || 'Something went wrong', 'error');
      }
    };

    // Network error handler (packet dropped, no server, etc)
    req.onerror = () => {
      //  Remove from active requests
      activeRequests.delete(url);

      toast('Network error – packet dropped. Please retry.', 'error');
      if (onFail) onFail({ message: 'network error' });
    };

    req.send(body);

    //  Return the request object (caller can abort if needed)
    return req;
  }

  function cancelAllRequests() {
    console.log(`[App] Cancelling ${activeRequests.size} active requests`);
    activeRequests.forEach(req => req.abort());
    activeRequests.clear();
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

    // Auto-dismiss after 3.2 seconds
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

    // Update header
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
      // Update list title and clear search
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
    // Populate user info in sidebar
    document.getElementById('sidebar-username').textContent = sessionUser.username;
    document.getElementById('user-avatar').textContent = sessionUser.username[0].toUpperCase();

    // Wire up nav buttons
    document.getElementById('nav-all').addEventListener('click', () => showView('all'));
    document.getElementById('nav-unpaid').addEventListener('click', () => showView('unpaid'));
    document.getElementById('nav-paid').addEventListener('click', () => showView('paid'));
    document.getElementById('nav-profile').addEventListener('click', () => showView('profile'));

    // Logout button
    document.getElementById('btn-logout').addEventListener('click', AuthUI.doLogout);

    // Initialize expenses UI and load data
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

  /* ── Boot sequence ──────────────────────────────────────── */

  function boot() {
    registerPages();

    // Try to restore session from cookies
    const saved = CookieManager.loadSession();
    if (saved) {
      sessionToken = saved.token;
      sessionUser = saved.user;
      SPA.navigate('app');  // Auto-login if session exists
    } else {
      SPA.navigate('auth');  // No session - show login
    }
  }


  // This is what other modules can access
  return {
    getToken,
    getUser,
    getExpenses,
    getEditingId,
    getCurrentView,
    setExpenses,
    setEditingId,
    setSession,
    clearSession,
    request,
    cancelAllRequests,
    toast,
    showView,
    boot
  };
})();

/* ── Start the app when DOM is ready ────────────────────── */

// Wait for DOM to load, then boot up
document.addEventListener('DOMContentLoaded', () => {
  App.boot();
});