import { arrow, esc } from './core.js';
import { linkButton } from './buttons.js';

export function actionCard({ number, title, text, href }) {
  return `<a class="action-card" href="${esc(href)}"><span class="action-card__number">${esc(number)}</span><span class="action-card__arrow">${arrow()}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></a>`;
}

export function capabilityCard({ title, text, imageMarkup = '' }) {
  return `<article class="capability-card">${imageMarkup}<h3>${esc(title)}</h3><p>${esc(text)}</p></article>`;
}

export function industryCard({ title, text, href, imageMarkup = '' }) {
  return `<a class="industry-card" href="${esc(href)}">${imageMarkup}<div class="industry-card__content"><h3>${esc(title)}</h3><p>${esc(text)}</p></div></a>`;
}

export function trustItem({ title, text }) {
  return `<div class="trust-item"><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
}

export function topicCard({ title, text = 'Considered explicitly in data design, quality, governance and operating decisions.' }) {
  return `<article class="topic-card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`;
}

export function helpCard({ item, servicePath }) {
  return `<article class="help-card"><h3>${esc(item.title)}</h3><p class="help-card__summary">${esc(item.summary)}</p><p class="help-card__detail">${esc(item.detail)}</p>${linkButton({ href: `${servicePath}/${item.slug}`, label: 'Read More', variant: 'text', icon: arrow() })}</article>`;
}

export function productCard({ tag, title, text, bullets = [], demoProduct }) {
  return `<article class="product-card product-card--expanded"><span class="product-card__tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><ul class="list-check">${bullets.map((item) => `<li>${esc(item)}</li>`).join('')}</ul><button class="btn btn--primary" type="button" data-request-demo="${esc(demoProduct)}">Request a Demo</button></article>`;
}

export function deliveryStep({ number, title, text }) {
  return `<article><span>${esc(number)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`;
}
