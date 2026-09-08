import { readFile } from 'node:fs/promises';
import {
  actionCard,
  breadcrumbs,
  buttonClasses,
  dialogTemplate,
  field,
  footerTemplate,
  headerTemplate,
  linkButton,
  productCard,
  sectionHeading,
  selectField,
  statusMessage,
  textareaField
} from '../src/frontend/components/index.js';
import { siteShell } from '../src/frontend/layouts/site-shell.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const header = headerTemplate('/careers');
assert(header.includes('aria-label="Primary navigation"'), 'Shared header lost primary navigation semantics');
assert(header.includes('aria-label="Mobile navigation"'), 'Shared header lost mobile navigation semantics');
assert(header.includes('aria-current="page"'), 'Active shared navigation does not expose aria-current');
assert(header.includes('aria-controls="mobile-panel"'), 'Mobile menu control relationship is missing');

const footer = footerTemplate();
assert(footer.includes('Registered in England and Wales'), 'Shared footer lost legal registration context');
assert(footer.includes('/privacy') && footer.includes('/cookies') && footer.includes('/terms'), 'Shared footer lost legal links');

const crumbs = breadcrumbs([{ label: 'Home', href: '/' }, { label: 'Current' }]);
assert(crumbs.includes('aria-label="Breadcrumb"'), 'Breadcrumb landmark is missing');
assert(crumbs.includes('aria-current="page"'), 'Breadcrumb current-page semantics are missing');

const heading = sectionHeading('Eyebrow', 'Heading');
assert(!heading.includes('<p>'), 'Section heading should not emit an empty paragraph');

assert(buttonClasses({ variant: 'secondary', size: 'small' }) === 'btn btn--secondary btn--small', 'Button class composition changed');
assert(linkButton({ href: '/contact', label: 'Contact' }).includes('class="btn btn--primary"'), 'Link button did not use the primary button contract');

const action = actionCard({ number: '01', title: '<Unsafe>', text: 'Text & more', href: '/products' });
assert(action.includes('&lt;Unsafe&gt;') && action.includes('Text &amp; more'), 'Card component failed to escape content');

const product = productCard({ tag: 'Platform', title: 'Product', text: 'Description', bullets: ['One'], demoProduct: 'Demo' });
assert(product.includes('data-request-demo="Demo"'), 'Product card lost demo trigger contract');

const input = field('email', 'Email', 'email', true);
assert(input.includes('required') && input.includes('aria-describedby='), 'Shared input field lost required/error semantics');
const select = selectField({ name: 'topic', label: 'Topic', required: true, options: [{ value: '', label: 'Choose' }, 'Cloud'], full: true });
assert(select.includes('form-field--full') && select.includes('<option value="Cloud">Cloud</option>'), 'Shared select field contract is invalid');
const textarea = textareaField({ name: 'notes', label: 'Notes', placeholder: 'Context' });
assert(textarea.includes('aria-describedby=') && textarea.includes('placeholder="Context"'), 'Shared textarea field contract is invalid');

const dialog = dialogTemplate({ id: 'test-dialog', title: 'Dialog', body: '<p>Body</p>' });
assert(dialog.includes('role="dialog"') && dialog.includes('aria-modal="true"') && dialog.includes('aria-labelledby="test-dialog-title"'), 'Dialog accessibility contract regressed');
assert(statusMessage('Saved').includes('role="status"'), 'Status-message primitive lost live-region semantics');

const shell = siteShell('/products', '<main id="main-content">Page</main>');
assert(shell.indexOf('site-header') < shell.indexOf('main-content') && shell.indexOf('main-content') < shell.indexOf('site-footer'), 'Site shell composition order is invalid');

const tokens = await readFile(new URL('../src/frontend/styles/tokens.css', import.meta.url), 'utf8');
for (const token of ['--space-4', '--container-narrow', '--control-height', '--field-height', '--z-dialog', '--focus-outline']) {
  assert(tokens.includes(token), `Design-system token missing: ${token}`);
}

console.log('PASS: shared navigation, footer, content, button, card, form, feedback, layout and token contracts verified.');
