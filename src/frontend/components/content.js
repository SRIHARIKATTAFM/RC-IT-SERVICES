import { responsiveImageMarkup } from '../app/image-utils.js';
import { arrow, esc } from './core.js';
import { linkButton } from './buttons.js';
import { container } from './layout.js';

export function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, i) => item.href ? `<a href="${esc(item.href)}">${esc(item.label)}</a><span aria-hidden="true">${i < items.length - 1 ? '/' : ''}</span>` : `<span aria-current="page">${esc(item.label)}</span>`).join('')}</nav>`;
}

export function pageHero({ category, title, lead, image, imageAlt, crumbs = [] }) {
  const heroImage = responsiveImageMarkup(image, imageAlt, {
    loading: 'eager',
    fetchPriority: 'high',
    sizes: '(max-width: 900px) calc(100vw - 2rem), 42vw',
    width: 1600,
    height: 1000
  });
  const inner = `<div>${breadcrumbs(crumbs)}<span class="eyebrow">${esc(category)}</span><h1>${esc(title)}</h1><p>${esc(lead)}</p></div>${heroImage}`;
  return `<section class="page-hero">${container(inner, { className: 'page-hero-grid' })}</section>`;
}

export function sectionHeading(eyebrowText, title, text = '') {
  return `<div class="section-heading"><span class="eyebrow">${esc(eyebrowText)}</span><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}

export function ctaPanel(title = 'Discuss your technology requirement', text = 'Tell us what you are trying to deliver. We will use the first conversation to clarify scope, constraints and the right engagement path.') {
  const panel = `<div class="cta-panel"><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>${linkButton({ href: '/contact', label: 'Contact Us', icon: arrow() })}</div>`;
  return `<section class="section">${container(panel)}</section>`;
}
