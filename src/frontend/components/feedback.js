import { esc, joinClasses } from './core.js';

export function dialogTemplate({ id, title, body, label = 'Close' }) {
  return `<div class="dialog-backdrop" data-dialog-backdrop data-dialog-id="${esc(id)}"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="${esc(id)}-title"><div class="dialog-head"><h2 id="${esc(id)}-title">${esc(title)}</h2><button class="dialog-close" type="button" data-dialog-close aria-label="${esc(label)}">×</button></div><div class="dialog-body">${body}</div></section></div>`;
}

export function statusMessage(message = '', { tone = 'neutral', className = '' } = {}) {
  const toneClass = tone === 'neutral' ? '' : `status-message--${tone}`;
  return `<p class="${joinClasses('form-status status-message', toneClass, className)}" role="status" aria-live="polite">${esc(message)}</p>`;
}

export function toastClass(error = false) {
  return joinClasses('toast', error && 'is-error');
}
