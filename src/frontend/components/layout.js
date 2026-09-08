import { esc, joinClasses } from './core.js';

const CONTAINER_SIZES = new Set(['default', 'narrow', 'wide']);

export function containerClass(size = 'default', className = '') {
  const safeSize = CONTAINER_SIZES.has(size) ? size : 'default';
  return joinClasses('container', safeSize === 'default' ? '' : `container--${safeSize}`, className);
}

export function container(content, { size = 'default', className = '' } = {}) {
  return `<div class="${containerClass(size, className)}">${content}</div>`;
}

export function section(content, { tone = '', className = '', labelledBy = '' } = {}) {
  const toneClass = tone ? `section--${tone}` : '';
  const aria = labelledBy ? ` aria-labelledby="${esc(labelledBy)}"` : '';
  return `<section class="${joinClasses('section', toneClass, className)}"${aria}>${content}</section>`;
}
