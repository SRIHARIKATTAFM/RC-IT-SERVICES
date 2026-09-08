import { esc, joinClasses } from './core.js';

let fieldSequence = 0;

function nextFieldId(name) {
  fieldSequence += 1;
  const slug = String(name || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'field';
  return `field-${slug}-${fieldSequence}`;
}

function errorMarkup(id) {
  return `<span class="field-error" id="${esc(id)}-error"></span>`;
}

export function field(name, label, type = 'text', required = false, dataType = '') {
  const id = nextFieldId(name);
  return `<div class="form-field"><label for="${id}">${esc(label)}${required ? ' *' : ''}</label><input id="${id}" name="${esc(name)}" type="${esc(type)}" aria-describedby="${id}-error" ${required ? 'required' : ''} ${dataType ? `data-type="${esc(dataType)}"` : ''}>${errorMarkup(id)}</div>`;
}

export function selectField({ id = '', name, label, required = false, options = [], full = false }) {
  const controlId = id || nextFieldId(name);
  const optionMarkup = options.map((option) => {
    const value = typeof option === 'string' ? option : option.value;
    const text = typeof option === 'string' ? option : option.label;
    return `<option value="${esc(value)}">${esc(text)}</option>`;
  }).join('');
  return `<div class="${joinClasses('form-field', full && 'form-field--full')}"><label for="${esc(controlId)}">${esc(label)}${required ? ' *' : ''}</label><select id="${esc(controlId)}" name="${esc(name)}" aria-describedby="${esc(controlId)}-error" ${required ? 'required' : ''}>${optionMarkup}</select>${errorMarkup(controlId)}</div>`;
}

export function textareaField({ id = '', name, label, required = false, placeholder = '', full = true }) {
  const controlId = id || nextFieldId(name);
  return `<div class="${joinClasses('form-field', full && 'form-field--full')}"><label for="${esc(controlId)}">${esc(label)}${required ? ' *' : ''}</label><textarea id="${esc(controlId)}" name="${esc(name)}" aria-describedby="${esc(controlId)}-error" ${required ? 'required' : ''}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}></textarea>${errorMarkup(controlId)}</div>`;
}

export function consentField({ id, name, content, required = false, className = '' }) {
  return `<div class="${joinClasses('form-field form-field--full', className)}"><label class="consent-row" for="${esc(id)}"><input id="${esc(id)}" type="checkbox" name="${esc(name)}" aria-describedby="${esc(id)}-error" ${required ? 'required' : ''}><span>${content}</span></label>${errorMarkup(id)}</div>`;
}

export function formActions({ submitLabel = 'Submit', status = true }) {
  return `<div class="form-actions"><button class="btn btn--primary" type="submit">${esc(submitLabel)}</button>${status ? '<p class="form-status" data-form-status role="status" aria-live="polite"></p>' : ''}</div>`;
}
