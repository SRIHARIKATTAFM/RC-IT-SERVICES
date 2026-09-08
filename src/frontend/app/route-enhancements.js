function isCareersShell(pathName) {
  return pathName === '/careers' || pathName === '/careers/job-opportunities' || pathName === '/careers/upload-your-resume';
}

export async function bindRouteEnhancements(pathName) {
  const work = [];

  if (pathName.startsWith('/services/')) {
    work.push(import('./service-page-enhancements.js').then(({ applyServicePageEnhancements }) => applyServicePageEnhancements(pathName)));
  }

  if (isCareersShell(pathName)) {
    work.push(import('./interactions-careers.js').then(({ bindCareerRoleBrowser }) => bindCareerRoleBrowser()));
    work.push(import('./interactions-career-filters.js').then(({ bindCareerFilters }) => bindCareerFilters()));
  }

  if (document.querySelector('form[data-api-form], [data-request-demo]')) {
    work.push(import('./forms.js').then(({ bindForms }) => bindForms()));
  }

  if (pathName === '/contact' || pathName === '/consult-expert' || pathName === '/login') {
    work.push(import('./interactions-page.js').then(({ bindContactOptions, bindLogin }) => {
      if (pathName === '/contact' || pathName === '/consult-expert') bindContactOptions();
      if (pathName === '/login') bindLogin();
    }));
  }

  if (document.querySelector('[data-read-more], [data-accordion-item]')) {
    work.push(import('./ui.js').then(({ bindDialogTriggers, bindAccordions }) => {
      bindDialogTriggers();
      bindAccordions();
    }));
  }

  await Promise.all(work);
}
