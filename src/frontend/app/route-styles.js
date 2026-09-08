export function routeStyleKeys(pathName) {
  if (pathName.startsWith('/careers')) return ['careers'];
  if (pathName.startsWith('/services/')) return ['services'];
  if (pathName === '/privacy' || pathName === '/cookies' || pathName === '/terms') return ['legal'];
  return [];
}

function productionManifest() {
  const root = document.getElementById('site-root');
  const raw = root?.dataset?.routeStyles;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function hrefFor(key, manifest) {
  const value = manifest[key];
  if (!value) return '';
  return value.startsWith('/') ? value : `/assets/${value}`;
}

function loadStylesheet(href) {
  if (!href || typeof document === 'undefined') return Promise.resolve();
  const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find((link) => link.getAttribute('href') === href);
  if (existing) return Promise.resolve();

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.routeStyle = 'true';
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => {
      console.warn(`Route stylesheet failed to load: ${href}`);
      resolve();
    }, { once: true });

    const globalOverrides = document.querySelector('link[data-global-overrides]');
    if (globalOverrides?.parentNode) globalOverrides.parentNode.insertBefore(link, globalOverrides);
    else document.head.appendChild(link);
  });
}

export async function ensureRouteStyles(pathName) {
  if (typeof document === 'undefined') return;
  const manifest = productionManifest();
  if (!Object.keys(manifest).length) return;
  await Promise.all(routeStyleKeys(pathName).map((key) => loadStylesheet(hrefFor(key, manifest))));
}
