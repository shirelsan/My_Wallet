

const CookieManager = (() => {

  const SESSION_HOURS = 1;   

  const TOKEN_KEY = 'mw_token';
  const USER_KEY  = 'mw_user';


  function _set(name, value, hours) {
    const expires = new Date();
    expires.setTime(expires.getTime() + hours * 60 * 60 * 1000);
    document.cookie =
      `${name}=${encodeURIComponent(value)}` +
      `; expires=${expires.toUTCString()}` +
      `; path=/` +
      `; SameSite=Strict`;
  }


  function _get(name) {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, val] = cookie.trim().split('=');
      if (key === name) return decodeURIComponent(val || '');
    }
    return null;
  }


  function _remove(name) {
    document.cookie =
      `${name}=` +
      `; expires=Thu, 01 Jan 1970 00:00:00 UTC` +
      `; path=/`;
  }

  function saveSession(token, user) {
    _set(TOKEN_KEY, token,                SESSION_HOURS);
    _set(USER_KEY,  JSON.stringify(user), SESSION_HOURS);
    console.log(`[CookieManager] Session saved — expires in ${SESSION_HOURS}h`);
  }

  function loadSession() {
    const token   = _get(TOKEN_KEY);
    const userRaw = _get(USER_KEY);

    if (!token || !userRaw) return null;

    try {
      const user = JSON.parse(userRaw);
      console.log(`[CookieManager] Session found for: ${user.username}`);
      return { token, user };
    } catch (e) {
      console.warn('[CookieManager] Invalid user cookie — clearing');
      clearSession();
      return null;
    }
  }


  function clearSession() {
    _remove(TOKEN_KEY);
    _remove(USER_KEY);
    console.log('[CookieManager] Session cleared');
  }

  return { saveSession, loadSession, clearSession };
})();