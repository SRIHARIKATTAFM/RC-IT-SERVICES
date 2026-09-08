import { field, formActions, textareaField } from '../components/forms.js';
import { openDialog, showToast } from './ui.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE = /^[+()\d\s.-]{7,30}$/;
const TEXTAREA_MIN_HEIGHT = 145;
const TEXTAREA_MAX_HEIGHT = 520;

function setError(fieldElement, message = '') {
  const wrapper = fieldElement.closest('.form-field');
  const error = wrapper?.querySelector('.field-error');
  fieldElement.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (error) error.textContent = message;
}

function resizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const naturalHeight = textarea.scrollHeight;
  const nextHeight = Math.min(Math.max(naturalHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = naturalHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}

function validate(form) {
  let ok = true;
  const fields = [...form.querySelectorAll('input, textarea, select')];
  for (const fieldElement of fields) {
    if (fieldElement.disabled || fieldElement.type === 'hidden' || fieldElement.type === 'submit') continue;
    let message = '';
    if (fieldElement.required && fieldElement.type === 'checkbox' && !fieldElement.checked) message = 'This confirmation is required.';
    else if (fieldElement.required && !String(fieldElement.value || '').trim()) message = 'This field is required.';
    else if (fieldElement.type === 'email' && fieldElement.value && !EMAIL.test(fieldElement.value.trim())) message = 'Enter a valid email address.';
    else if (fieldElement.dataset.type === 'phone' && fieldElement.value && !PHONE.test(fieldElement.value.trim())) message = 'Enter a valid phone number.';
    else if (fieldElement.type === 'file' && fieldElement.files?.[0]) {
      const file = fieldElement.files[0];
      const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowed.includes(file.type)) message = 'Use PDF, DOC or DOCX.';
      else if (file.size > 5 * 1024 * 1024) message = 'File must be 5 MB or smaller.';
    }
    setError(fieldElement, message);
    if (message) ok = false;
  }
  const firstInvalid = form.querySelector('[aria-invalid="true"]');
  if (!ok && firstInvalid) firstInvalid.focus();
  return ok;
}

function formDataObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) data[checkbox.name] = checkbox.checked;
  return data;
}

function resetTextareas(form) {
  requestAnimationFrame(() => form.querySelectorAll('textarea').forEach(resizeTextarea));
}

async function submitJson(form, endpoint) {
  if (!validate(form)) return;
  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('button[type="submit"]');
  const original = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Submitting…'; }
  if (status) { status.textContent = ''; status.style.color = ''; }
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formDataObject(form))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Submission failed.');
    form.reset();
    resetTextareas(form);
    showToast(result.message || 'Submitted successfully.');
    if (status) { status.textContent = result.message || 'Submitted successfully.'; status.style.color = 'var(--color-success)'; }
  } catch (error) {
    const message = error?.message || 'Submission failed.';
    showToast(message, true);
    if (status) { status.textContent = message; status.style.color = 'var(--color-danger)'; }
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
  }
}

async function submitResume(form) {
  if (!validate(form)) return;
  const input = form.querySelector('input[type="file"]');
  const file = input?.files?.[0];
  if (!file) return;
  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('button[type="submit"]');
  const original = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Uploading…'; }
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const payload = formDataObject(form);
    payload.fileName = file.name;
    payload.mimeType = file.type;
    payload.fileBase64 = base64;
    const response = await fetch('/api/resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'CV upload failed.');
    form.reset();
    showToast(result.message);
    if (status) { status.textContent = result.message; status.style.color = 'var(--color-success)'; }
  } catch (error) {
    const message = error?.message || 'CV upload failed.';
    showToast(message, true);
    if (status) { status.textContent = message; status.style.color = 'var(--color-danger)'; }
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
  }
}

export function bindForms() {
  document.querySelectorAll('form[data-api-form]:not([data-form-bound])').forEach((form) => {
    form.dataset.formBound = 'true';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const endpoint = form.dataset.apiForm;
      if (endpoint === '/api/resume') submitResume(form);
      else submitJson(form, endpoint);
    });

    form.querySelectorAll('textarea').forEach((textarea) => {
      resizeTextarea(textarea);
      textarea.addEventListener('input', () => {
        setError(textarea, '');
        resizeTextarea(textarea);
      });
    });

    form.querySelectorAll('input,select').forEach((fieldElement) => fieldElement.addEventListener('input', () => setError(fieldElement, '')));
  });

  document.querySelectorAll('[data-request-demo]:not([data-demo-bound])').forEach((button) => {
    button.dataset.demoBound = 'true';
    button.addEventListener('click', () => {
      const product = button.dataset.requestDemo || 'Product';
      openDialog(`demo-${product.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, `Request a Demo · ${product}`, `
        <form data-api-form="/api/demo" novalidate>
          <div class="form-grid">
            ${field('name','Name','text',true)}${field('company','Company','text',true)}
            ${field('businessEmail','Business Email','email',true)}${field('phone','Phone Number','tel',false,'phone')}
            <input type="hidden" name="product" value="${product.replaceAll('"','&quot;')}">
            ${textareaField({ id: 'demo-notes', name: 'notes', label: 'What would you like to evaluate?' })}
          </div>
          ${formActions({ submitLabel: 'Submit' })}
        </form>`);
      bindForms();
    });
  });
}

export { field } from '../components/forms.js';
