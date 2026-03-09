/* ============================================================
   auth-ui.js — Authentication UI Logic
   ============================================================ */

const AuthUI = (() => {

  function init() {
    // Wire tab buttons
    document.getElementById('tab-login').addEventListener('click', () => showTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => showTab('register'));

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

  function showTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('form-login').style.display = tab === 'login' ? '' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
    setMessage('');
  }

  function setMessage(msg, type = '') {
    const el = document.getElementById('auth-msg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'auth-msg' + (type ? ` ${type}` : '');
  }

  // Login logic
  function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) { 
      setMessage('Please fill in all fields', 'error'); 
      return; 
    }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';
    setMessage('Connecting…', 'pending');

    App.request('POST', '/auth/login', { username, password },
      (res) => {
        // Always save session to cookies (no more "remember me" option)
        App.setSession(res.data.token, res.data.user);
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span>';
        App.toast('Welcome back, ' + res.data.user.username + '! 👋', 'success');
        SPA.navigate('app');
      },
      (res) => {
        setMessage(res.message || 'Login failed', 'error');
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span>';
      }
    );
  }

  // Registration logic
  function doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    
    if (!username || !email || !password) { 
      setMessage('Please fill in all fields', 'error'); 
      return; 
    }

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account…';
    setMessage('Creating your account…', 'pending');

    App.request('POST', '/auth/register', { username, email, password },
      (res) => {
        // Always save session to cookies
        App.setSession(res.data.token, res.data.user);
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span>';
        App.toast('Account created! Welcome, ' + res.data.user.username + '! 🎉', 'success');
        SPA.navigate('app');
      },
      (res) => {
        setMessage(res.message || 'Registration failed', 'error');
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span>';
      }
    );
  }

  // Logout function to be called from the app page
  function doLogout() {
    // Send logout request and wait for it to complete before clearing session
    App.request('POST', '/auth/logout', null, 
      () => {
        // Success - logout request completed
        App.clearSession();
        SPA.navigate('auth');
      },
      () => {
        // Error - logout request failed, but still clear session locally
        App.clearSession();
        SPA.navigate('auth');
      }
    );
  }

  return { init, doLogout };
})();