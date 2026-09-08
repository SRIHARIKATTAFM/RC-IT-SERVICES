import { COMPANY, FOOTER_GROUPS } from '../app/site-config.js';
import { brandTemplate } from './brand.js';
import { esc } from './core.js';

function footerHref(item) {
  return item.label === 'Careers' ? '/careers' : item.href;
}

export function footerTemplate() {
  return `<footer class="site-footer">
    <div class="container footer-main">
      <div class="footer-top">
        <div class="footer-brand">
          ${brandTemplate({ inverse: true })}
          <p>Technology consulting, engineering and management services presented through a clean, accountable delivery model.</p>
        </div>
        ${FOOTER_GROUPS.map((group) => `<div class="footer-column"><h2>${esc(group.label)}</h2>${group.items.map((item) => `<a href="${esc(footerHref(item))}">${esc(item.label)}</a>`).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="footer-bottom"><div class="container footer-bottom-inner">
      <div>${esc(COMPANY.legalName)} · Registered in England and Wales · Company No. ${esc(COMPANY.companyNumber)}<br>${esc(COMPANY.registeredOffice)}</div>
      <div class="footer-legal"><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/terms">Terms</a></div>
    </div></div>
  </footer>`;
}
