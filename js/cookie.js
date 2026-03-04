/* ============================================================
   cookieManager.js — Session Cookie Manager
   
   אחראי על שמירת ה-session token ב-Cookie של הדפדפן.
   ה-Cookie פג תוקף אחרי זמן מוגדר (ברירת מחדל: שעה).
   
   שימוש:
     CookieManager.saveSession(token, user)  — שמור session
     CookieManager.loadSession()             — טען session קיים
     CookieManager.clearSession()            — מחק session (logout)
   ============================================================ */

const CookieManager = (() => {

  // ── תוקף ה-session ──────────────────────────────────────
  const SESSION_HOURS = 1;   // ← שנה כאן את משך ה-session בשעות

  const TOKEN_KEY = 'mw_token';
  const USER_KEY  = 'mw_user';

  /* ── פונקציות פנימיות ───────────────────────────────────── */

  /**
   * שמור ערך ב-Cookie עם תאריך תפוגה
   * @param {string} name   שם ה-cookie
   * @param {string} value  הערך (יקודד אוטומטית)
   * @param {number} hours  כמה שעות עד תפוגה
   */
  function _set(name, value, hours) {
    const expires = new Date();
    expires.setTime(expires.getTime() + hours * 60 * 60 * 1000);
    document.cookie =
      `${name}=${encodeURIComponent(value)}` +
      `; expires=${expires.toUTCString()}` +
      `; path=/` +
      `; SameSite=Strict`;
  }

  /**
   * קרא ערך של cookie לפי שם
   * @returns {string|null}
   */
  function _get(name) {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, val] = cookie.trim().split('=');
      if (key === name) return decodeURIComponent(val || '');
    }
    return null;
  }

  /**
   * מחק cookie על ידי דריסה עם תאריך עבר
   */
  function _remove(name) {
    document.cookie =
      `${name}=` +
      `; expires=Thu, 01 Jan 1970 00:00:00 UTC` +
      `; path=/`;
  }

  /* ── Public API ─────────────────────────────────────────── */

  /**
   * שמור session לאחר כניסה/הרשמה מוצלחת.
   * ה-Cookie יפוג אחרי SESSION_HOURS שעות.
   *
   * @param {string} token  session token מהשרת
   * @param {Object} user   { id, username, email }
   */
  function saveSession(token, user) {
    _set(TOKEN_KEY, token,                SESSION_HOURS);
    _set(USER_KEY,  JSON.stringify(user), SESSION_HOURS);
    console.log(`[CookieManager] Session saved — expires in ${SESSION_HOURS}h`);
  }

  /**
   * טען session קיים מה-Cookie.
   * אם ה-Cookie פג תוקף — הדפדפן כבר מחק אותו אוטומטית.
   *
   * @returns {{ token: string, user: Object } | null}
   *   מחזיר את ה-token ו-user אם קיימים, אחרת null
   */
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

  /**
   * מחק את ה-session (logout).
   * מסיר את שני ה-Cookies.
   */
  function clearSession() {
    _remove(TOKEN_KEY);
    _remove(USER_KEY);
    console.log('[CookieManager] Session cleared');
  }

  return { saveSession, loadSession, clearSession };
})();