import { ctaPanel, pageHero, sectionHeading } from '../../components/content.js';
import { deliveryStep, helpCard, topicCard } from '../../components/cards.js';
import { arrow, esc } from '../../components/core.js';
import { pageTitle, imageTag } from '../../app/render-helpers.js';

function editorialImage(page) {
  return {
    image: page.secondaryImage || page.image,
    alt: page.secondaryImageAlt || page.imageAlt
  };
}

export function renderServicePage(page, servicePath) {
  pageTitle(page.title);
  const secondary = editorialImage(page);
  const dimensions = page.dimensions ? `<section class="section section--blue"><div class="container">${sectionHeading('Big Data dimensions', 'The operating characteristics that shape the data architecture', 'Scale alone does not define a data platform. Variability, trust, security, change rate, usability and business value all influence architecture and operating decisions.')}<div class="topic-grid">${page.dimensions.map((dimension) => topicCard({ title: dimension })).join('')}</div></div></section>` : '';
  return `<main id="main-content">
    ${pageHero({ ...page, crumbs: [{label:'Home',href:'/'},{label:'Services',href:'/services/it/consultancy-services'},{label:page.title}] })}
    <section class="section"><div class="container split"><div>${imageTag(secondary.image, secondary.alt)}</div><div><span class="eyebrow">Service overview</span><h2>${esc(page.introTitle)}</h2><p>${esc(page.intro)}</p><ul class="list-check">${page.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join('')}</ul></div></div></section>
    ${dimensions}
    <section class="section section--soft"><div class="container">${sectionHeading('HOW WE HELP', `How RC approaches ${page.title}`, 'Explore the specialist capabilities within this service area. Each capability has its own page covering context, scope, delivery approach, controls, expected outcomes and the wider service environment around the work.')}
      <div class="help-grid">${page.howWeHelp.map((item) => helpCard({ item, servicePath })).join('')}</div>
    </div></section>
    ${ctaPanel(`Talk to us about ${page.title}`, `Share the business objective, current environment, known constraints and target timeline. We will use that context to identify the most relevant capability and delivery path.`)}
  </main>`;
}

function capabilityOutcome(item, page) {
  return `${item.title} is treated as part of the wider ${page.title} service, with decisions tied to business outcomes, ownership, security, data quality, operational readiness and measurable acceptance criteria.`;
}

export function renderServiceDetailPage({ page, item, servicePath }) {
  pageTitle(`${item.title} | ${page.title}`);
  const siblings = page.howWeHelp.filter((candidate) => candidate.slug !== item.slug);
  const secondary = editorialImage(page);
  const deliverySteps = [
    ['01','Discover','Clarify the business problem, users, current systems, constraints, risks, data and desired outcome.'],
    ['02','Design','Define responsibilities, architecture boundaries, controls, interfaces, measures and acceptance criteria.'],
    ['03','Implement','Deliver the agreed capability in controlled increments with engineering, quality and stakeholder feedback built in.'],
    ['04','Validate & operate','Verify the outcome, document ownership, monitor behaviour and establish the next improvement cycle.']
  ];

  return `<main id="main-content" class="service-detail-page">
    ${pageHero({
      category:`${page.title} · How We Help`,
      title:item.title,
      lead:item.summary,
      image:page.image,
      imageAlt:page.imageAlt,
      crumbs:[{label:'Home',href:'/'},{label:'Services',href:'/services/it/consultancy-services'},{label:page.title,href:servicePath},{label:item.title}]
    })}

    <section class="section"><div class="container detail-intro">
      <div class="detail-intro__media">${imageTag(secondary.image, secondary.alt)}</div>
      <div class="detail-intro__copy"><span class="eyebrow">Capability overview</span><h2>${esc(item.title)} in practice</h2><p class="detail-lead">${esc(item.detail)}</p><p>${esc(capabilityOutcome(item, page))}</p><a class="detail-back-link" href="${esc(servicePath)}">← Back to ${esc(page.title)}</a></div>
    </div></section>

    <section class="section section--soft"><div class="container detail-two-column">
      <div><span class="eyebrow">What the work covers</span><h2>Connected to the complete service context.</h2><p>${esc(page.intro)}</p></div>
      <ol class="detail-scope-list">${page.bullets.map((bullet, index) => `<li><span>${String(index + 1).padStart(2,'0')}</span><div><strong>${esc(bullet)}</strong><p>Considered as part of the scope, architecture, implementation and operating model for ${esc(item.title)}.</p></div></li>`).join('')}</ol>
    </div></section>

    <section class="section"><div class="container">${sectionHeading('Delivery approach', `How we structure ${item.title}`, 'The exact engagement changes by client context, but the work moves through explicit discovery, design, implementation and verification rather than ending with an isolated recommendation.')}
      <div class="delivery-steps">${deliverySteps.map(([number,title,text]) => deliveryStep({ number, title, text })).join('')}</div>
    </div></section>

    <section class="section section--soft"><div class="container detail-outcome">
      <div><span class="eyebrow">Expected result</span><h2>A capability that can be used, governed and improved.</h2></div>
      <p>${esc(item.summary)} The objective is a practical outcome that fits the organisation's wider technology and operating environment rather than a standalone deliverable with no ownership after launch.</p>
    </div></section>

    ${siblings.length ? `<section class="section"><div class="container">${sectionHeading('Related capabilities', `More within ${page.title}`, 'Continue into another capability without returning to the main navigation.')}
      <div class="related-capabilities">${siblings.map((candidate) => `<a href="${esc(servicePath)}/${esc(candidate.slug)}"><span>${esc(candidate.title)}</span>${arrow()}</a>`).join('')}</div>
    </div></section>` : ''}

    ${ctaPanel(`Discuss ${item.title}`, `Tell us what you need to achieve with ${item.title}, what systems or processes are involved and what constraints are already known.`)}
  </main>`;
}
