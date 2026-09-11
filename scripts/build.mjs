import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteShell } from '../src/frontend/layouts/site-shell.js';
import { routeContent } from '../src/frontend/router/router.js';
import { routeStyleKeys } from '../src/frontend/app/route-styles.js';
import {
  getPrerenderRoutes,
  renderNotFoundSeoHead,
  renderRedirectsFile,
  renderRobotsTxt,
  renderSeoHead,
  renderSitemapXml,
  SITE_ORIGIN
} from '../src/frontend/seo/seo-model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const frontendRoot = path.join(root, 'src', 'frontend');
const stylesRoot = path.join(frontendRoot, 'styles');
const out = path.join(root, 'dist');
const assets = path.join(out, 'assets');
const jsEntry = path.join(frontendRoot, 'app', 'app.js');
const deploymentSha = String(process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'development').trim();

const cssEntries = {
  app: path.join(stylesRoot, 'app.css'),
  'global-overrides': path.join(stylesRoot, 'global-overrides.css'),
  'route-careers': path.join(stylesRoot, 'route-careers.css'),
  'route-services': path.join(stylesRoot, 'route-services.css'),
  'route-legal': path.join(stylesRoot, 'route-legal.css')
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(publicRoot, out, { recursive: true });
await mkdir(assets, { recursive: true });

const cssBuild = await build({
  entryPoints: cssEntries,
  bundle: true,
  minify: true,
  target: ['es2020'],
  outdir: assets,
  entryNames: '[name]-[hash]',
  metafile: true,
  legalComments: 'none',
  charset: 'utf8'
});

const jsBuild = await build({
  entryPoints: [jsEntry],
  bundle: true,
  minify: true,
  treeShaking: true,
  splitting: true,
  format: 'esm',
  target: ['es2020'],
  outdir: assets,
  entryNames: 'app-[hash]',
  chunkNames: 'chunk-[hash]',
  metafile: true,
  legalComments: 'none',
  charset: 'utf8'
});

function outputByPrefix(meta, prefix, extension) {
  const output = Object.keys(meta.outputs).find((file) => {
    const name = path.basename(file);
    return name.startsWith(`${prefix}-`) && name.endsWith(extension);
  });
  if (!output) throw new Error(`Missing ${prefix} ${extension} build output.`);
  return path.basename(output);
}

const jsFile = outputByPrefix(jsBuild.metafile, 'app', '.js');
const cssFile = outputByPrefix(cssBuild.metafile, 'app', '.css');
const overridesFile = outputByPrefix(cssBuild.metafile, 'global-overrides', '.css');
const routeStyles = {
  careers: outputByPrefix(cssBuild.metafile, 'route-careers', '.css'),
  services: outputByPrefix(cssBuild.metafile, 'route-services', '.css'),
  legal: outputByPrefix(cssBuild.metafile, 'route-legal', '.css')
};

const sourceTemplate = await readFile(path.join(publicRoot, 'index.html'), 'utf8');
const devStyles = /\s*<link rel="stylesheet" href="\/(?:css\/[^\"]+|vendor\/bootstrap-grid\.css)" \/>/g;

function htmlAttr(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#039;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function routeCssLinks(pathName) {
  const routeLinks = routeStyleKeys(pathName)
    .map((key) => routeStyles[key])
    .filter(Boolean)
    .map((file) => `<link rel="stylesheet" href="/assets/${file}" data-route-style="true" />`);
  return [
    `<link rel="stylesheet" href="/assets/${cssFile}" />`,
    ...routeLinks,
    `<link rel="stylesheet" href="/assets/${overridesFile}" data-global-overrides />`
  ].join('\n  ');
}

function renderDocument(pathName, shellMarkup, seoHead, prerenderMarker = pathName) {
  const deploymentMeta = `<meta name="rc-deployment-sha" content="${htmlAttr(deploymentSha)}" />`;
  return sourceTemplate
    .replace(/\s*<meta name="description"[^>]*\/>/i, '')
    .replace(/\s*<title>[^<]*<\/title>/i, '')
    .replace(devStyles, '')
    .replace('</head>', `  ${deploymentMeta}\n  ${seoHead}\n  ${routeCssLinks(pathName)}\n</head>`)
    .replace('<div id="site-root"></div>', `<div id="site-root" data-route-styles='${JSON.stringify(routeStyles)}' data-prerendered-path="${htmlAttr(prerenderMarker)}">${shellMarkup}</div>`)
    .replace('<script type="module" src="/js/app.js"></script>', `<script type="module" src="/assets/${jsFile}"></script>`);
}

function outputPathForRoute(pathName) {
  if (pathName === '/') return path.join(out, 'index.html');
  return path.join(out, `${pathName.replace(/^\//, '')}.html`);
}

async function writeRoute(pathName) {
  globalThis.document.title = '';
  const pageMarkup = await routeContent(pathName);
  const html = renderDocument(pathName, siteShell(pathName, pageMarkup), renderSeoHead(pathName));
  const outputPath = outputPathForRoute(pathName);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf8');
}

globalThis.document = { title: '' };
globalThis.location = { origin: SITE_ORIGIN };

const prerenderRoutes = getPrerenderRoutes();
for (const route of prerenderRoutes) await writeRoute(route);

const notFoundMarkup = await routeContent('/__phase-6-not-found__');
const notFoundHtml = renderDocument('/', siteShell('/__phase-6-not-found__', notFoundMarkup), renderNotFoundSeoHead(), '__404__');
await writeFile(path.join(out, '404.html'), notFoundHtml, 'utf8');
await writeFile(path.join(out, 'sitemap.xml'), renderSitemapXml(), 'utf8');
await writeFile(path.join(out, 'robots.txt'), renderRobotsTxt(), 'utf8');
await writeFile(path.join(out, '_redirects'), renderRedirectsFile(), 'utf8');

console.log(`Built prerendered SEO site: ${prerenderRoutes.length} route HTML files, sitemap.xml, robots.txt and 404.html; ${cssFile}, ${overridesFile}, ${jsFile}; route CSS ${Object.values(routeStyles).join(', ')}; deployment SHA ${deploymentSha}`);
