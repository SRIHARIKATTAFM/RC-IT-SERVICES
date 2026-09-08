import { siteShell } from '../layouts/site-shell.js';
import { bindDesktopNav, bindMobileNav } from './interactions-nav.js';
import { bindRouteEnhancements } from './route-enhancements.js';
import { ensureRouteStyles } from './route-styles.js';

function normalisePath(path = '/') {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean === '/index.php' ? '/' : clean;
}

function bindShell() {
  bindDesktopNav();
  bindMobileNav();
}

function renderLoadFailure(root, pathName) {
  const content = `<main id="main-content"><section class="section"><div class="container"><div class="empty-state"><h1>Page temporarily unavailable</h1><p>The page could not be loaded. Refresh the page to try again.</p></div></div></section></main>`;
  root.innerHTML = siteShell(pathName, content);
  bindShell();
}

async function bootstrap() {
  const root = document.getElementById('site-root');
  if (!root) return;

  const pathName = normalisePath(location.pathname);
  try {
    if (root.dataset.prerenderedPath === pathName) {
      bindShell();
      await bindRouteEnhancements(pathName);
      return;
    }

    const [{ routeContent }] = await Promise.all([
      import('../router/router.js'),
      ensureRouteStyles(pathName)
    ]);
    const content = await routeContent(pathName);
    root.innerHTML = siteShell(pathName, content);
    bindShell();
    await bindRouteEnhancements(pathName);
  } catch (error) {
    console.error('RC IT Services page bootstrap failed.', error);
    renderLoadFailure(root, pathName);
  }
}

bootstrap();
