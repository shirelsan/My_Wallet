// Navigate to a registered page by name, optionally with parameters
function navigate(name, params = {}) {
  const def = _pages[name];
  if (!def) {
    console.error(`[SPA] Unknown page: "${name}"`);
    return;
  }

  // Phase 1: Call onLeave of current page (assuming it's always valid)
  if (_current && _pages[_current].onLeave) {
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