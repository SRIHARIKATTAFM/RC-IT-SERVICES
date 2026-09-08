import { IMAGES } from '../app/site-config.js';
import { ctaPanel, pageHero, sectionHeading } from '../components/content.js';
import { deliveryStep, productCard } from '../components/cards.js';
import { pageTitle, imageTag } from '../app/render-helpers.js';

export function renderProductsPage() {
  pageTitle('Our Products');
  const products = [
    {
      tag: 'Education platform', title: 'Ed+ Cloud', demoProduct: 'Ed+ Cloud',
      text: 'Designed to support connected education-service workflows across learner information, enquiries or admissions, staff activity, communications, approvals and operational reporting.',
      bullets: ['Student and service workflow coordination','Role-based access and task ownership','Communication and document touchpoints','Operational reporting and status visibility']
    },
    {
      tag: 'Recruitment platform', title: 'Recruit+ Cloud', demoProduct: 'Recruit+ Cloud',
      text: 'Designed to support structured recruitment workflows across vacancies, candidate information, review stages, collaboration, documents, interview activity and hiring status.',
      bullets: ['Vacancy and candidate workflow management','Recruiter and reviewer collaboration','Documents, notes and stage visibility','Reporting and role-based access']
    }
  ];
  const steps = [
    ['01','Understand','Review users, workflow, systems, data, pain points and desired improvements.'],
    ['02','Demonstrate','Show the capabilities most relevant to the operating scenario rather than a generic feature tour.'],
    ['03','Assess fit','Identify configuration, integration, security, reporting and process-change requirements.'],
    ['04','Plan','Define the next technical and commercial steps only after the implementation context is understood.']
  ];

  return `<main id="main-content">${pageHero({category:'Our Products',title:'Products designed around operational workflows',lead:'Explore product capabilities that support structured education and recruitment processes. Product discussions focus on users, workflow fit, integration requirements, security boundaries and the outcomes the organisation needs to improve.',image:IMAGES.products,imageAlt:'Professional team reviewing a digital product on a laptop in a real office',crumbs:[{label:'Home',href:'/'},{label:'Our Products'}]})}
    <section class="section"><div class="container split"><div>${imageTag(IMAGES.productsDetail,'Professional team reviewing a digital workflow on a laptop in a real office')}</div><div><span class="eyebrow">Product approach</span><h2>Evaluate fit before committing to implementation.</h2><p>Product selection should start with the process, users, information and integration landscape rather than with a feature checklist alone. We use demonstrations to understand the organisation's current workflow, show the relevant capability and identify where configuration, integration or process change may be required.</p><ul class="list-check"><li>Role-aware workflows and permissions</li><li>Structured process and status visibility</li><li>Integration and data considerations</li><li>Reporting, governance and operational support</li></ul></div></div></section>
    <section class="section section--soft"><div class="container">${sectionHeading('Product portfolio','Two focused cloud product areas','The product portfolio reflects the existing RC service structure. Capability is presented around business workflows rather than generic software claims.')}
      <div class="product-grid">${products.map(productCard).join('')}</div>
    </div></section>
    <section class="section"><div class="container">${sectionHeading('Evaluation process','A product conversation built around your operating context','A useful demonstration should answer whether the product fits the process, where integrations are needed and what implementation work is required.')}
      <div class="delivery-steps">${steps.map(([number,title,text]) => deliveryStep({ number, title, text })).join('')}</div>
    </div></section>${ctaPanel('Need a product walkthrough?','Request a demonstration and tell us which workflow, user group or operational problem you want to evaluate.')}</main>`;
}
