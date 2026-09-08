import { dialogTemplate, toastClass } from '../components/feedback.js';

let lastFocused = null;

export function showToast(message, error = false) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = toastClass(error);
  toast.setAttribute('role', error ? 'alert' : 'status');
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

export function closeDialog() {
  const root = document.getElementById('dialog-root');
  if (!root) return;
  root.innerHTML = '';
  document.body.classList.remove('dialog-open');
  lastFocused?.focus?.();
  lastFocused = null;
}

export function openDialog(id, title, body) {
  lastFocused = document.activeElement;
  const root = document.getElementById('dialog-root');
  if (!root) return;
  root.innerHTML = dialogTemplate({ id, title, body });
  document.body.classList.add('dialog-open');
  const backdrop = root.querySelector('[data-dialog-backdrop]');
  const dialog = root.querySelector('.dialog');
  const close = root.querySelector('[data-dialog-close]');
  close?.focus();
  close?.addEventListener('click', closeDialog);
  backdrop?.addEventListener('mousedown', (event) => { if (event.target === backdrop) closeDialog(); });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDialog();
    if (event.key === 'Tab' && dialog) {
      const focusable = [...dialog.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, { once: true });
}

export function bindDialogTriggers() {
  document.querySelectorAll('[data-read-more]').forEach((button) => button.addEventListener('click', () => {
    openDialog(button.dataset.dialogId, button.dataset.title, `<p>${button.dataset.detail}</p><div class="form-actions"><button class="btn btn--secondary" type="button" data-dialog-close-secondary>Close</button></div>`);
    document.querySelector('[data-dialog-close-secondary]')?.addEventListener('click', closeDialog);
  }));
}

export function bindAccordions() {
  document.querySelectorAll('[data-accordion-item]').forEach((item) => {
    const trigger = item.querySelector('[data-accordion-trigger]');
    trigger?.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(open));
    });
  });
}
