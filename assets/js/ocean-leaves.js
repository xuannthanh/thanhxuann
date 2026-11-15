(() => {
  'use strict';

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'ocean-leaves-paused';
  const leafSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" fill="none" aria-hidden="true"><path d="M27 2C11 4 1 15 4 29c2 8 12 11 19 4C31 25 29 10 27 2Z" fill="currentColor"/><path d="M7 45C10 30 17 17 25 6M12 29l-5-9M16 22l8-2M19 16l-3-7" stroke="#d5f1ff" stroke-width="1.2" stroke-linecap="round" opacity=".65"/></svg>';
  let paused = false;
  let layer;
  let toggle;

  try { paused = localStorage.getItem(storageKey) === 'true'; } catch { /* Storage is optional. */ }

  function update() {
    if (!layer) return;
    layer.classList.toggle('is-paused', paused || document.hidden);
    toggle.setAttribute('aria-pressed', String(paused));
    const label = paused ? 'Resume falling leaves' : 'Pause falling leaves';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  function syncMotion() {
    if (motion.matches) {
      layer?.remove();
      toggle?.remove();
      layer = toggle = undefined;
      return;
    }
    if (layer) return;

    layer = document.createElement('div');
    layer.className = 'ocean-leaves';
    layer.setAttribute('aria-hidden', 'true');
    const colors = ['#78caff', '#9cddff', '#59b3f0'];
    for (let i = 0; i < 18; i++) {
      const leaf = document.createElement('span');
      leaf.className = 'ocean-leaf';
      leaf.innerHTML = leafSvg;
      const values = {
        '--left': `${Math.random() * 100}%`,
        '--size': `${14 + Math.random() * 12}px`,
        '--fall': `${18 + Math.random() * 16}s`,
        '--delay': `${-Math.random() * 34}s`,
        '--flutter': `${2.5 + Math.random() * 3}s`,
        '--drift': `${Math.random() * 140 - 70}px`,
        '--turn': `${Math.random() * 360 - 180}deg`,
        '--opacity': `${0.2 + Math.random() * 0.25}`,
        '--leaf-color': colors[i % colors.length]
      };
      for (const [name, value] of Object.entries(values)) leaf.style.setProperty(name, value);
      layer.append(leaf);
    }

    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ocean-leaves-toggle';
    toggle.innerHTML = leafSvg;
    toggle.addEventListener('click', () => {
      paused = !paused;
      try { localStorage.setItem(storageKey, String(paused)); } catch { /* Storage is optional. */ }
      update();
    });
    document.body.append(layer, toggle);
    update();
  }

  motion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', update);
  syncMotion();
})();
