import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'src/frontend/app/app.js',
  'src/frontend/router/router.js',
  'src/frontend/styles/app.css',
  'src/frontend/styles/tokens.css',
  'src/frontend/components/index.js',
  'src/frontend/components/core.js',
  'src/frontend/components/brand.js',
  'src/frontend/components/buttons.js',
  'src/frontend/components/navigation.js',
  'src/frontend/components/footer.js',
  'src/frontend/components/layout.js',
  'src/frontend/components/content.js',
  'src/frontend/components/cards.js',
  'src/frontend/components/forms.js',
  'src/frontend/components/feedback.js',
  'src/frontend/layouts/site-shell.js',
  'src/frontend/pages/home.page.js',
  'src/frontend/pages/about.page.js',
  'src/frontend/pages/contact.page.js',
  'src/frontend/pages/products.page.js',
  'src/frontend/pages/white-papers.page.js',
  'src/frontend/pages/careers.page.js',
  'src/frontend/pages/careers/job-detail.page.js',
  'src/frontend/pages/careers/application.page.js',
  'src/frontend/pages/services/service.page.js',
  'src/frontend/pages/services/it/consultancy-services.page.js',
  'src/frontend/pages/services/it/cyber-security.page.js',
  'src/frontend/pages/services/it/artificial-intelligence.page.js',
  'src/frontend/pages/services/it/cloud-computing.page.js',
  'src/frontend/pages/services/it/big-data.page.js',
  'src/frontend/pages/services/it/it-support-services.page.js',
  'src/frontend/pages/services/management/risk.page.js',
  'src/frontend/pages/services/management/strategy-and-implementation.page.js',
  'src/frontend/pages/services/management/sustainability.page.js',
  'src/frontend/pages/services/education/consultancy.page.js',
  'src/frontend/pages/industries/industry.page.js',
  'src/frontend/pages/industries/automotive.page.js',
  'src/frontend/pages/industries/banking-and-finance.page.js',
  'src/frontend/pages/industries/media-and-communication.page.js',
  'src/frontend/pages/industries/education.page.js',
  'src/frontend/pages/support/faqs.page.js',
  'src/frontend/pages/support/faq-content.js',
  'src/frontend/pages/support/blog.page.js',
  'src/frontend/pages/support/login.page.js',
  'src/frontend/pages/support/legal.page.js',
  'src/frontend/pages/support/privacy.page.js',
  'src/frontend/pages/support/cookies.page.js',
  'src/frontend/pages/support/terms.page.js',
  'src/frontend/pages/support/not-found.page.js',
  'tests/design-system.mjs',
  'src/backend/runtime/worker.js',
  'src/backend/admin/README.md',
  'src/backend/api/README.md',
  'src/backend/services/README.md',
  'src/backend/database/README.md',
  'src/backend/security/README.md'
];

for (const relative of required) {
  await access(path.join(root, relative));
}

const forbidden = [
  'src/frontend/app/router.js',
  'src/frontend/app/render-home.js',
  'src/frontend/app/render-contact.js',
  'src/frontend/app/render-careers.js',
  'src/frontend/app/render-main.js',
  'src/frontend/app/render-support.js'
];

for (const relative of forbidden) {
  try {
    await access(path.join(root, relative));
    throw new Error(`Legacy renderer still owns page output: ${relative}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const routerSource = await readFile(path.join(root, 'src/frontend/router/router.js'), 'utf8');
const explicitPageImports = [
  'home.page.js',
  'about.page.js',
  'contact.page.js',
  'products.page.js',
  'white-papers.page.js',
  'careers.page.js',
  'careers/job-detail.page.js',
  'careers/application.page.js',
  'support/privacy.page.js',
  'support/cookies.page.js',
  'support/terms.page.js'
];
for (const moduleName of explicitPageImports) {
  if (!routerSource.includes(moduleName)) {
    throw new Error(`Router is not using explicit page module: ${moduleName}`);
  }
}

const componentFacade = await readFile(path.join(root, 'src/frontend/app/components.js'), 'utf8');
if (!componentFacade.includes("export * from '../components/index.js'")) {
  throw new Error('Legacy component facade must delegate to the Phase 4 shared component index.');
}
if (componentFacade.includes('function headerTemplate') || componentFacade.includes('function footerTemplate')) {
  throw new Error('Header/footer markup must be owned by shared Phase 4 component modules.');
}

const appSource = await readFile(path.join(root, 'src/frontend/app/app.js'), 'utf8');
if (!appSource.includes("../layouts/site-shell.js") || !appSource.includes('siteShell(')) {
  throw new Error('Public app shell must be composed by the shared site layout.');
}

const tokenSource = await readFile(path.join(root, 'src/frontend/styles/tokens.css'), 'utf8');
for (const token of ['--space-4', '--container-narrow', '--control-height', '--field-height', '--z-dialog', '--focus-outline']) {
  if (!tokenSource.includes(token)) throw new Error(`Required design-system token is missing: ${token}`);
}

const publicEntries = await readdir(path.join(root, 'public'));
if (publicEntries.includes('js') || publicEntries.includes('css')) {
  throw new Error('Frontend source must not live under public/js or public/css after the structured-source migration.');
}

console.log(`PASS: structured page architecture + Phase 4 shared component/design-system ownership verified (${required.length} required paths).`);
