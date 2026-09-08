import { IMAGES } from '../app/site-config.js';

const configuredOrigin = typeof process !== 'undefined' ? process.env?.PUBLIC_ORIGIN : '';

export const SITE_NAME = 'RC IT Services';
export const SITE_ORIGIN = String(configuredOrigin || 'https://rcitcservices.frsmkgit.workers.dev').replace(/\/+$/, '');

// Keep individual vacancy URLs crawlable but out of search results until the real
// application workflow is enabled. Google JobPosting markup requires an open job
// with a working application path; Phase 12 owns that production capability.
export const JOB_SEARCH_INDEXING_ENABLED = false;

export const STATIC_PAGE_SEO = {
  '/': {
    label: 'Home',
    title: 'RC IT Services | Technology Consulting & Engineering',
    description: 'Technology consulting, engineering and managed delivery across software, cloud, data, cyber security and business transformation.',
    image: IMAGES.hero,
    index: true
  },
  '/about-us': {
    label: 'About Us',
    title: 'About RC IT Services | Technology Consulting & Delivery',
    description: 'Learn how RC IT Services approaches technology consulting, engineering delivery, operational ownership and long-term client capability.',
    image: IMAGES.about,
    index: true
  },
  '/contact': {
    label: 'Contact',
    title: 'Contact RC IT Services | Technology Consulting Enquiries',
    description: 'Contact RC IT Services to discuss a technology decision, delivery requirement, specialist capability need, product evaluation or consulting engagement.',
    image: IMAGES.contact,
    index: true
  },
  '/products': {
    label: 'Products',
    title: 'Technology Products | RC IT Services',
    description: 'Explore RC IT Services product areas and request a focused demonstration based on your organisation, workflow and evaluation requirements.',
    image: IMAGES.products,
    index: true
  },
  '/white-papers': {
    label: 'White Papers',
    title: 'Technology White Papers | RC IT Services',
    description: 'Read RC IT Services perspectives on cloud modernisation, data engineering, responsible AI, architecture decisions and technology operations.',
    image: IMAGES.whitePapers,
    index: true
  },
  '/careers': {
    label: 'Careers',
    title: 'Technology Careers in the UK | RC IT Services',
    description: 'Learn about careers at RC IT Services, technology role profiles, working arrangements and the recruitment process.',
    image: IMAGES.careers,
    index: true
  },
  '/blog': {
    label: 'Blog',
    title: 'Technology Insights & Perspectives | RC IT Services',
    description: 'Read RC IT Services perspectives on cloud, data, artificial intelligence, cyber security, engineering quality and technology delivery.',
    image: IMAGES.consultingDetail,
    index: true
  },
  '/faqs': {
    label: 'FAQs',
    title: 'Frequently Asked Questions | RC IT Services',
    description: 'Answers to common questions about RC IT Services, technology consulting, product demonstrations, careers, applications and authorised workspace access.',
    image: IMAGES.consulting,
    index: true
  },
  '/login': {
    label: 'Login',
    title: 'Authorised Workspace Login | RC IT Services',
    description: 'Authorised RC IT Services client and staff workspace access.',
    image: IMAGES.consultingDetail,
    index: false
  },
  '/privacy': {
    label: 'Privacy',
    title: 'Privacy Notice | RC IT Services',
    description: 'Read the RC IT Services privacy notice covering personal information, website enquiries, recruitment information and data protection rights.',
    image: IMAGES.legal,
    index: true
  },
  '/cookies': {
    label: 'Cookies',
    title: 'Cookie Notice | RC IT Services',
    description: 'Read the RC IT Services cookie notice and information about website storage, browser controls and analytics-related cookie use.',
    image: IMAGES.legal,
    index: true
  },
  '/terms': {
    label: 'Terms',
    title: 'Website Terms | RC IT Services',
    description: 'Read the terms governing use of the RC IT Services website, its public information, links, intellectual property and service enquiries.',
    image: IMAGES.legal,
    index: true
  }
};

export const LEGACY_REDIRECTS = [
  { source: '/consult-expert', destination: '/contact?intent=consultation', status: 301 },
  { source: '/careers/job-opportunities', destination: '/careers', status: 301 },
  { source: '/careers/upload-your-resume', destination: '/careers', status: 301 },
  { source: '/index.php', destination: '/', status: 301 }
];
