// Resize the work area, never shrink text or touch targets to fit the screen.
(() => {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let frame;
  let keyboardOpen = false;
  let restingHeight = window.innerHeight;
  let previousWidth = window.innerWidth;

  function editing() {
    const element = document.activeElement;
    if (!element || element.disabled || element.readOnly) return false;
    if (element.isContentEditable || element.tagName === 'TEXTAREA') return true;
    return element.tagName === 'INPUT' && ![
      'button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden',
      'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week'
    ].includes(element.type);
  }

  function fit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const layoutHeight = window.innerHeight || root.clientHeight;
      const width = window.innerWidth || root.clientWidth;
      const focused = editing();
      if (width !== previousWidth) {
        restingHeight = layoutHeight;
        keyboardOpen = false;
      }
      previousWidth = width;
      if ((!focused && !keyboardOpen) || layoutHeight > restingHeight) restingHeight = layoutHeight;

      // Pinch-zoom changes visualViewport CSS pixels, not the space available
      // to the page layout. Normalize it before detecting a software keyboard.
      const scale = viewport && Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1;
      const visible = viewport && Number.isFinite(viewport.height) && viewport.height > 0
        ? viewport.height * scale : layoutHeight;
      const height = Math.min(layoutHeight, visible);
      const reference = viewport ? layoutHeight : restingHeight;
      const reduction = Math.max(0, reference - height);
      // A tap can blur the field before the keyboard finishes closing. Keep
      // controls in place until usable height returns, including the fallback.
      keyboardOpen = keyboardOpen ? reduction > 24
        : focused && reduction >= Math.max(120, reference * .2);
      root.style.setProperty('--visible-height', `${height}px`);
      root.classList.toggle('keyboard-open', keyboardOpen);
    });
  }
  function reorient() {
    restingHeight = window.innerHeight;
    keyboardOpen = false;
    fit();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', reorient);
  window.addEventListener('pageshow', fit);
  window.screen?.orientation?.addEventListener('change', reorient);
  document.addEventListener('focusin', fit);
  document.addEventListener('focusout', fit);
  viewport?.addEventListener('resize', fit);
  fit();
})();
