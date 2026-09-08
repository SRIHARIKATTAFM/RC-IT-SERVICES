import { COMPANY, IMAGES } from '../app/site-config.js';
import { pageHero, sectionHeading } from '../components/content.js';
import { esc } from '../components/core.js';
import { consentField, field, formActions, selectField, textareaField } from '../components/forms.js';
import { pageTitle } from '../app/render-helpers.js';

const CONSULTATION_TOPICS = [
  { value: '', label: 'Choose a topic' },
  'IT Consultancy',
  'Cyber Security',
  'Artificial Intelligence',
  'Cloud Computing',
  'Big Data / Data Engineering',
  'IT Support Services',
  'Risk & Management Consulting',
  'Strategy and Implementation',
  'Sustainability',
  'Education Consultancy',
  'Products / Demonstration',
  'Partnership',
  'General Business Enquiry'
];

export function renderContactPage() {
  pageTitle('Contact');
  return `<main id="main-content" class="contact-page">
    ${pageHero({
      category:'Contact',
      title:'Let’s discuss what your business needs next',
      lead:'Use one enquiry route for technology consulting, project delivery, specialist capability, managed support, products, partnerships and general business questions. Give us the context and we will route the conversation to the right service area.',
      image:IMAGES.contact,
      imageAlt:'Professional business consultation and client discussion in a real office environment',
      crumbs:[{label:'Home',href:'/'},{label:'Contact'}]
    })}

    <section class="section contact-enquiry-section"><div class="container"><div class="row g-5 align-items-start contact-enquiry-layout">
      <div class="col-lg-5 contact-enquiry-copy">
        <span class="eyebrow">Business enquiries</span>
        <h2>Start with the outcome, not the org chart.</h2>
        <p>You do not need to know which RC team should receive your enquiry before you contact us. Tell us what you are trying to achieve, what is getting in the way and what timing or constraints matter.</p>
        <p>For consulting and delivery conversations, useful context includes the current environment, affected users or systems, target outcome, known dependencies and any decision that needs to be made.</p>
        <div class="contact-principles" aria-label="What to include in your enquiry">
          <div><strong>Business context</strong><span>What needs to change, improve or be decided?</span></div>
          <div><strong>Technology context</strong><span>Which systems, data, platforms or teams are involved?</span></div>
          <div><strong>Timing</strong><span>Is there a deadline, dependency, procurement window or urgent issue?</span></div>
          <div><strong>Success measure</strong><span>What would a useful outcome look like for the organisation?</span></div>
        </div>
      </div>

      <div class="col-lg-7">
        <div id="contact-form" class="contact-form-panel">
          <div class="contact-form-heading">
            <span class="eyebrow">Get in touch</span>
            <h2>Tell us how we can help.</h2>
            <p>Select the consultation topic and provide enough context for the team to understand the requirement and determine the appropriate next step.</p>
          </div>
          <form data-api-form="/api/contact" novalidate>
            <input type="hidden" name="intent" id="contact-intent" value="General enquiry">
            <div class="form-grid">
              ${field('firstName','First Name','text',true)}
              ${field('lastName','Last Name','text',true)}
              ${field('company','Company / Organisation')}
              ${field('jobTitle','Job Title')}
              ${field('email','Email','email',true)}
              ${field('phone','Phone Number','tel',true,'phone')}
              ${selectField({ id: 'consultation-topic', name: 'consultationTopic', label: 'Consultation topic', required: true, options: CONSULTATION_TOPICS, full: true })}
              ${textareaField({ id: 'message', name: 'message', label: 'How can we help?', required: true, placeholder: 'Describe the requirement, target outcome, current environment, known constraints and preferred timeline.' })}
              ${consentField({ id: 'privacy-consent', name: 'privacyConsent', required: true, className: 'contact-consent', content: 'I understand that RC IT Services will use the information I provide to respond to this enquiry. See the <a href="/privacy">Privacy Policy</a>.' })}
            </div>
            ${formActions({ submitLabel: 'Send Enquiry' })}
          </form>
        </div>
      </div>
    </div></div></section>

    <section class="section section--soft contact-context-section"><div class="container">
      ${sectionHeading('How we can help','One contact point, several types of conversation','These are informational routes only. Every enquiry uses the same contact form so visitors do not have to choose between competing contact experiences.')}
      <div class="contact-context-strip">
        <article><span>01</span><h3>Expert consultation</h3><p>For technology decisions, transformation planning, architecture questions, delivery constraints or specialist capability requirements.</p></article>
        <article><span>02</span><h3>Business enquiry</h3><p>For project discussions, partnerships, product questions, commercial conversations and general company enquiries.</p></article>
        <article><span>03</span><h3>Phone follow-up</h3><p>If a conversation is more useful than email, include a phone number and the subject you want to discuss so the right person can follow up.</p></article>
        <article><span>04</span><h3>Digital message</h3><p>Use the enquiry form for a structured written message. There is no separate chat journey competing with the main contact route.</p></article>
      </div>
    </div></section>

    <section class="section"><div class="container">
      ${sectionHeading('What happens next','Clear routing, ownership and follow-up','A professional contact experience should make the next step predictable without overpromising response times or routing visitors through unnecessary forms.')}
      <div class="contact-next-steps">
        <article><span>01</span><div><h3>Review</h3><p>The enquiry is reviewed against the selected topic, business context and requested outcome.</p></div></article>
        <article><span>02</span><div><h3>Route</h3><p>The request is directed to the most relevant service, product or business contact rather than asking the visitor to resubmit it elsewhere.</p></div></article>
        <article><span>03</span><div><h3>Respond</h3><p>Where follow-up is appropriate, the next step may be clarification, a focused consultation, product demonstration or scoped delivery discussion.</p></div></article>
      </div>
    </div></section>

    <section class="section section--soft"><div class="container"><div class="row g-4 align-items-stretch contact-location-layout">
      <div class="col-lg-5"><div class="contact-office-card h-100">
        <span class="eyebrow">Registered office</span>
        <h2>${esc(COMPANY.legalName)}</h2>
        <p>${esc(COMPANY.registeredOffice)}</p>
        <p class="contact-company-number">Registered in England and Wales · Company No. ${esc(COMPANY.companyNumber)}</p>
        <p class="contact-privacy-note">Please do not include passwords, secret keys, payment-card information or other unnecessary sensitive data in a public website enquiry.</p>
      </div></div>
      <div class="col-lg-7"><div class="contact-map-shell h-100"><iframe title="Map showing the registered office of R C OVERSEAS LTD" src="https://www.google.com/maps?q=93%20Metcalfe%20Court%20John%20Harrison%20Way%20London%20SE10%200BZ&output=embed" width="100%" height="440" style="display:block;border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div>
    </div></div></section>
  </main>`;
}
