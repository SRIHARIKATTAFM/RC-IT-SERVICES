import { PRIMARY_NAV, UTILITY_NAV } from '../app/site-config.js';
import { brandTemplate } from './brand.js';
import { arrow, chevron, esc } from './core.js';

function isActive(href, pathName) {
  if (href === '/') return pathName === '/';
  return pathName === href || pathName.startsWith(href + '/');
}

function currentAttribute(active) {
  return active ? ' aria-current="page"' : '';
}

function menuVariant(item) {
  if (item.label === 'SERVICES') return 'mega-menu--services';
  if (item.label === 'Industry') return 'mega-menu--industry';
  return '';
}

function navItem(item, pathName, index) {
  if (item.label === 'Careers') {
    const active = isActive('/careers', pathName);
    return `<a class="nav-link ${active ? 'is-active' : ''}" href="/careers"${currentAttribute(active)}>Careers</a>`;
  }
  if (!item.groups) {
    const active = isActive(item.href, pathName);
    return `<a class="nav-link ${active ? 'is-active' : ''}" href="${esc(item.href)}"${currentAttribute(active)}>${esc(item.label)}</a>`;
  }
  const active = item.groups.some((group) => group.items.some((link) => isActive(link.href, pathName)));
  const groups = item.groups.map((group) => `
    <div class="mega-column">
      <span class="mega-title">${esc(group.label)}</span>
      ${group.items.map((link) => {
        const linkActive = isActive(link.href, pathName);
        return `<a class="mega-link ${linkActive ? 'is-active' : ''}" href="${esc(link.href)}"${currentAttribute(linkActive)}><span>${esc(link.label)}</span>${arrow()}</a>`;
      }).join('')}
    </div>`).join('');
  return `<div class="nav-item" data-nav-item>
    <button class="nav-trigger ${active ? 'is-active' : ''}" type="button" aria-expanded="false" aria-controls="mega-${index}">${esc(item.label)}${chevron()}</button>
    <div class="mega-menu ${menuVariant(item)}" id="mega-${index}" role="region" aria-label="${esc(item.label)} menu"><div class="mega-grid">${groups}</div></div>
  </div>`;
}

function mobileItem(item, pathName, index) {
  if (item.label === 'Careers') {
    const active = isActive('/careers', pathName);
    return `<a class="${active ? 'is-active' : ''}" href="/careers"${currentAttribute(active)}>Careers</a>`;
  }
  if (!item.groups) {
    const active = isActive(item.href, pathName);
    return `<a class="${active ? 'is-active' : ''}" href="${esc(item.href)}"${currentAttribute(active)}>${esc(item.label)}</a>`;
  }
  return `<div class="mobile-accordion" data-mobile-accordion>
    <button class="mobile-accordion__trigger" type="button" aria-expanded="false" aria-controls="mobile-panel-${index}">${esc(item.label)}${chevron()}</button>
    <div class="mobile-accordion__panel" id="mobile-panel-${index}">
      ${item.groups.map((group) => `<div class="mobile-subgroup"><strong>${esc(group.label)}</strong>${group.items.map((link) => {
        const active = isActive(link.href, pathName);
        return `<a class="${active ? 'is-active' : ''}" href="${esc(link.href)}"${currentAttribute(active)}>${esc(link.label)}</a>`;
      }).join('')}</div>`).join('')}
    </div>
  </div>`;
}

export function headerTemplate(pathName) {
  return `
    <div class="utility-bar"><div class="container utility-inner">${UTILITY_NAV.map((item) => `<a href="${esc(item.href)}">${esc(item.label)}</a>`).join('')}</div></div>
    <header class="site-header" id="site-header">
      <div class="container header-inner">
        ${brandTemplate()}
        <nav class="desktop-nav" aria-label="Primary navigation">${PRIMARY_NAV.map((item, index) => navItem(item, pathName, index)).join('')}</nav>
        <a class="btn btn--primary btn--small header-cta" href="/contact?intent=consultation#contact-form">Consult our Expert</a>
        <button class="mobile-menu-button" type="button" aria-expanded="false" aria-controls="mobile-panel" aria-label="Open navigation menu">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
    </header>
    <div class="mobile-panel" id="mobile-panel" aria-hidden="true">
      <div class="mobile-panel__sheet" role="dialog" aria-modal="true" aria-label="Mobile navigation">
        <div class="mobile-panel__head">
          ${brandTemplate()}
          <button class="mobile-close" type="button" aria-label="Close navigation menu">×</button>
        </div>
        <nav class="mobile-nav" aria-label="Mobile navigation">
          ${PRIMARY_NAV.map((item, index) => mobileItem(item, pathName, index)).join('')}
          <a href="/blog">Blog</a><a href="/faqs">FAQs</a><a href="/login">Login</a>
          <a href="/contact?intent=consultation#contact-form">Consult our Expert</a>
        </nav>
      </div>
    </div>`;
}
