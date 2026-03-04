/* ============================================================
   cookies.js — Cookie Management with Expiration
   
   Manages browser cookies for session persistence
   ============================================================ */

const Cookies = (() => {

  /**
   * Set a cookie with expiration
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {number} days - Days until expiration (null = session only)
   */
  function set(name, value, days = null) {
    let expires = '';
    
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = `; expires=${date.toUTCString()}`;
    }
    
    const encodedValue = encodeURIComponent(value);
    document.cookie = `${name}=${encodedValue}${expires}; path=/; SameSite=Strict`;
    
    console.log(`[Cookies] Set: ${name} (expires: ${days ? days + ' days' : 'session'})`);
  }

  /**
   * Get a cookie value
   * @param {string} name - Cookie name
   * @returns {string|null}
   */
  function get(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }
    return null;
  }

  /**
   * Delete a cookie
   * @param {string} name - Cookie name
   */
  function remove(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    console.log(`[Cookies] Deleted: ${name}`);
  }

  /**
   * Check if cookie exists
   * @param {string} name
   * @returns {boolean}
   */
  function exists(name) {
    return get(name) !== null;
  }

  return { set, get, remove, exists };
})();