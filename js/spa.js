/* ============================================================
   spa.js — Single-Page Application Router
   Manages which "page" (view) is currently visible.

   Pages are HTML <template> elements with  data-page="name".
   The router renders a page by cloning its template into
   the #spa-outlet element and running an optional onEnter hook.

   Usage:
     SPA.register('login',    loginPageDef);
     SPA.register('register', registerPageDef);
     SPA.register('app',      appPageDef);
     SPA.navigate('login');

   A page definition object:
     {
       template : string,          // CSS selector for its <template>
       onEnter  : function|null,   // called after the page is rendered
       onLeave  : function|null    // called before navigating away
     }
   ============================================================ */

const SPA = (() => {

  let _pages   = {};      // name → page definition
  let _current = null;    // currently active page name

  /* ── Private helpers ────────────────────────────────────── */
  function _getOutlet() {
    const outlet = document.getElementById('spa-outlet');
    if (!outlet) {
      console.error('[SPA] #spa-outlet element not found in DOM');
    }
    return outlet;
  }

  /* ── Public API ─────────────────────────────────────────── */

  /**
   * Register a page.
   * @param {string} name   unique page identifier (e.g. 'login')
   * @param {Object} def    { template, onEnter?, onLeave? }
   */
  function register(name, def) {
    _pages[name] = def;
  }

  /**
   * Navigate to a page by name.
   * 1. Calls onLeave on the current page (if any)
   * 2. Clones the new page's <template> into #spa-outlet
   * 3. Calls onEnter on the new page (if defined)
   *
   * @param {string} name   target page name
   * @param {Object} [params]  optional data forwarded to onEnter
   */
  function navigate(name, params = {}) {
    const def = _pages[name];
    if (!def) {
      console.error(`[SPA] Unknown page: "${name}"`);
      return;
    }

    // 1. Leave current page
    if (_current && _pages[_current] && _pages[_current].onLeave) {
      _pages[_current].onLeave();
    }

    // 2. Find the template and clone it
    const tpl = document.querySelector(def.template);
    if (!tpl) {
      console.error(`[SPA] Template not found: "${def.template}"`);
      return;
    }
    const outlet  = _getOutlet();
    if (!outlet) return;

    // Clear previous content and inject new clone
    outlet.innerHTML = '';
    outlet.appendChild(tpl.content.cloneNode(true));

    _current = name;
    console.log(`[SPA] Navigated → ${name}`);

    // 3. Enter new page
    if (def.onEnter) def.onEnter(params);
  }

  /** Return the currently active page name (or null). */
  function current() { return _current; }

  return { register, navigate, current };
})();