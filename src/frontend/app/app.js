import { routeContent } from '../router/router.js';
import { siteShell } from '../layouts/site-shell.js';
import { bindDesktopNav, bindMobileNav } from './interactions-nav.js';
import { bindContactOptions, bindLogin } from './interactions-page.js';
import { bindCareerRoleBrowser } from './interactions-careers.js';
import { bindCareerFilters } from './interactions-career-filters.js';
import { bindForms } from './forms.js';
import { bindDialogTriggers, bindAccordions } from './ui.js';
import { applyServicePageEnhancements } from './service-page-enhancements.js';

function normalisePath(path = '/') {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean === '/index.php' ? '/' : clean;
}

const root = document.getElementById('site-root');
const pathName = normalisePath(location.pathname);
root.innerHTML = siteShell(pathName, routeContent(pathName));

applyServicePageEnhancements(pathName);
bindDesktopNav();
bindMobileNav();
bindDialogTriggers();
bindAccordions();
bindForms();
bindContactOptions();
bindCareerRoleBrowser();
bindCareerFilters();
bindLogin();
