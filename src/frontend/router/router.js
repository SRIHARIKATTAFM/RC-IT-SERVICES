const STATIC_ROUTE_LOADERS = new Map([
  ['/', () => import('../pages/home.page.js').then(({ renderHomePage }) => renderHomePage())],
  ['/about-us', () => import('../pages/about.page.js').then(({ renderAboutPage }) => renderAboutPage())],
  ['/contact', () => import('../pages/contact.page.js').then(({ renderContactPage }) => renderContactPage())],
  ['/products', () => import('../pages/products.page.js').then(({ renderProductsPage }) => renderProductsPage())],
  ['/white-papers', () => import('../pages/white-papers.page.js').then(({ renderWhitePapersPage }) => renderWhitePapersPage())],
  ['/careers', () => import('../pages/careers.page.js').then(({ renderCareersPage }) => renderCareersPage('/careers'))],
  ['/blog', () => import('../pages/support/blog.page.js').then(({ renderBlogPage }) => renderBlogPage())],
  ['/faqs', () => import('../pages/support/faqs.page.js').then(({ renderFaqsPage }) => renderFaqsPage())],
  ['/login', () => import('../pages/support/login.page.js').then(({ renderLoginPage }) => renderLoginPage())],
  ['/privacy', () => import('../pages/support/privacy.page.js').then(({ renderPrivacyPage }) => renderPrivacyPage())],
  ['/cookies', () => import('../pages/support/cookies.page.js').then(({ renderCookiesPage }) => renderCookiesPage())],
  ['/terms', () => import('../pages/support/terms.page.js').then(({ renderTermsPage }) => renderTermsPage())],
  ['/services/it/consultancy-services', () => import('../pages/services/it/consultancy-services.page.js').then(({ renderConsultancyServicesPage }) => renderConsultancyServicesPage())],
  ['/services/it/cyber-security', () => import('../pages/services/it/cyber-security.page.js').then(({ renderCyberSecurityPage }) => renderCyberSecurityPage())],
  ['/services/it/artificial-intelligence', () => import('../pages/services/it/artificial-intelligence.page.js').then(({ renderArtificialIntelligencePage }) => renderArtificialIntelligencePage())],
  ['/services/it/cloud-computing', () => import('../pages/services/it/cloud-computing.page.js').then(({ renderCloudComputingPage }) => renderCloudComputingPage())],
  ['/services/it/big-data', () => import('../pages/services/it/big-data.page.js').then(({ renderBigDataPage }) => renderBigDataPage())],
  ['/services/it/it-support-services', () => import('../pages/services/it/it-support-services.page.js').then(({ renderItSupportServicesPage }) => renderItSupportServicesPage())],
  ['/services/management/risk', () => import('../pages/services/management/risk.page.js').then(({ renderRiskPage }) => renderRiskPage())],
  ['/services/management/strategy-and-implementation', () => import('../pages/services/management/strategy-and-implementation.page.js').then(({ renderStrategyAndImplementationPage }) => renderStrategyAndImplementationPage())],
  ['/services/management/sustainability', () => import('../pages/services/management/sustainability.page.js').then(({ renderSustainabilityPage }) => renderSustainabilityPage())],
  ['/services/education/consultancy', () => import('../pages/services/education/consultancy.page.js').then(({ renderEducationConsultancyPage }) => renderEducationConsultancyPage())],
  ['/industry/automotive-industry-it-services', () => import('../pages/industries/automotive.page.js').then(({ renderAutomotiveIndustryPage }) => renderAutomotiveIndustryPage())],
  ['/industry/banking-and-finance', () => import('../pages/industries/banking-and-finance.page.js').then(({ renderBankingAndFinancePage }) => renderBankingAndFinancePage())],
  ['/industry/media-and-communication', () => import('../pages/industries/media-and-communication.page.js').then(({ renderMediaAndCommunicationPage }) => renderMediaAndCommunicationPage())],
  ['/industry/education', () => import('../pages/industries/education.page.js').then(({ renderEducationIndustryPage }) => renderEducationIndustryPage())]
]);

const LEGACY_ROUTE_LOADERS = new Map([
  ['/careers/job-opportunities', () => import('../pages/careers.page.js').then(({ renderCareersPage }) => renderCareersPage('/careers'))],
  ['/careers/upload-your-resume', () => import('../pages/careers.page.js').then(({ renderCareersPage }) => renderCareersPage('/careers'))],
  ['/consult-expert', () => import('../pages/contact.page.js').then(({ renderContactPage }) => renderContactPage())]
]);

export function isServiceDetailRoute(pathName) {
  return /^\/services\/[^/]+\/[^/]+\/[^/]+$/.test(pathName);
}

async function renderServiceDetail(pathName) {
  const [{ findServiceDetail }, { renderServiceDetailPage }] = await Promise.all([
    import('../app/pages.js'),
    import('../pages/services/service.page.js')
  ]);
  const serviceDetail = findServiceDetail(pathName);
  return serviceDetail ? renderServiceDetailPage(serviceDetail) : null;
}

export async function routeContent(pathName) {
  const staticLoader = STATIC_ROUTE_LOADERS.get(pathName);
  if (staticLoader) return staticLoader();

  const legacyLoader = LEGACY_ROUTE_LOADERS.get(pathName);
  if (legacyLoader) return legacyLoader();

  if (isServiceDetailRoute(pathName)) {
    const detail = await renderServiceDetail(pathName);
    if (detail) return detail;
  }

  const applicationMatch = pathName.match(/^\/careers\/jobs\/([^/]+)\/apply$/);
  if (applicationMatch) {
    const { renderJobApplicationPage } = await import('../pages/careers/application.page.js');
    return renderJobApplicationPage(applicationMatch[1]);
  }

  if (/^\/careers\/jobs\/[^/]+$/.test(pathName)) {
    const { renderCareerJobDetailPage } = await import('../pages/careers/job-detail.page.js');
    return renderCareerJobDetailPage(pathName);
  }

  const { renderNotFoundPage } = await import('../pages/support/not-found.page.js');
  return renderNotFoundPage();
}
