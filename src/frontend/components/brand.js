import { esc } from './core.js';

export function brandTemplate({ inverse = false, label = 'RC IT Services home' } = {}) {
  return `<a class="brand" href="/" aria-label="${esc(label)}">
    <span class="brand-mark" aria-hidden="true">RC</span>
    <span class="brand-copy"><strong${inverse ? ' style="color:white"' : ''}>RC IT Services</strong><span>Technology & Consulting</span></span>
  </a>`;
}
