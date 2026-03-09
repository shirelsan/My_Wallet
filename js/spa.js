/* ============================================================
   spa.js — Single Page Application Router
   ============================================================ */

const SPA = (() => {
  
  // Registry of all available pages
  const _pages = {};
  
  // Currently active page name
  let _current = null;

  /* ── Helper: Get the outlet element ─────────────────────── */
  function _getOutlet() {
    const outlet = document.getElementById('spa-outlet');
    if (!outlet) {
      console.error('[SPA] #spa-outlet element not found');
      return null;
    }
    return outlet;
  }

  /* ── Public: Register a page ────────────────────────────── */
  function register(name, definition) {
    if (!definition.template) {
      console.error(`[SPA] Page "${name}" must have a template`);
      return;
    }
    
    _pages[name] = {
      template: definition.template,
      onEnter: definition.onEnter || null,
      onLeave: definition.onLeave || null
    };
    
    console.log(`[SPA] Registered page: ${name}`);
  }

  /* ── Public: Navigate to a page ─────────────────────────── */
  function navigate(name, params = {}) {
    const def = _pages[name];
    if (!def) {
      console.error(`[SPA] Unknown page: "${name}"`);
      return;
    }

    // Phase 1: Call onLeave of current page
    if (_current && _pages[_current] && _pages[_current].onLeave) {
      _pages[_current].onLeave();
    }

    // Find the template and make a copy of its content
    const tpl = document.querySelector(def.template);
    if (!tpl) {
      console.error(`[SPA] Template not found: "${def.template}"`);
      return;
    }
    
    const outlet = _getOutlet();
    if (!outlet) return;

    // Phase 2: Replace the content with the new page
    outlet.innerHTML = '';
    outlet.appendChild(tpl.content.cloneNode(true));

    _current = name;
    console.log(`[SPA] Navigated → ${name}`);

    // Phase 3: Call onEnter of the new page
    if (def.onEnter) def.onEnter(params);
  }

  /* ── Public: Get current page name ──────────────────────── */
  function getCurrentPage() {
    return _current;
  }

  return { register, navigate, getCurrentPage };
})();