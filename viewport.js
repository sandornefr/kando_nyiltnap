// Resize the work area, never shrink text or touch targets to fit the screen.
(() => {
  const root = document.documentElement;
  let frame;
  function fit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const height = window.visualViewport?.height || innerHeight;
      root.style.setProperty('--visible-height', `${height}px`);
      root.classList.toggle('keyboard-open', height < innerHeight * .75);
    });
  }
  addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  fit();
})();
