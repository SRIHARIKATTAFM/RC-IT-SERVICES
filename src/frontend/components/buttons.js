import { esc, joinClasses } from './core.js';

export function buttonClasses({ variant = 'primary', size = '', className = '' } = {}) {
  const variantClass = variant ? `btn--${variant}` : '';
  const sizeClass = size ? `btn--${size}` : '';
  return joinClasses('btn', variantClass, sizeClass, className);
}

export function linkButton({ href, label, variant = 'primary', size = '', className = '', icon = '' }) {
  return `<a class="${buttonClasses({ variant, size, className })}" href="${esc(href)}">${esc(label)}${icon ? ` ${icon}` : ''}</a>`;
}
