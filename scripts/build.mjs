import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const frontendRoot = path.join(root, 'src', 'frontend');
const stylesRoot = path.join(frontendRoot, 'styles');
const out = path.join(root, 'dist');
const assets = path.join(out, 'assets');
const jsEntry = path.join(frontendRoot, 'app', 'app.js');

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

const htmlPath = path.join(out, 'index.html');
let html = await readFile(htmlPath, 'utf8');
html = html
  .replace(/\s*<link rel="stylesheet" href="\/(?:css\/[^\"]+|vendor\/bootstrap-grid\.css)" \/>/g, '')
  .replace('</head>', `  <link rel="stylesheet" href="/assets/${cssFile}" />\n  <link rel="stylesheet" href="/assets/${overridesFile}" data-global-overrides />\n</head>`)
  .replace('<div id="site-root"></div>', `<div id="site-root" data-route-styles='${JSON.stringify(routeStyles)}'></div>`)
  .replace('<script type="module" src="/js/app.js"></script>', `<script type="module" src="/assets/${jsFile}"></script>`);
await writeFile(htmlPath, html);

console.log(`Built performance-split static site: ${cssFile}, ${overridesFile}, ${jsFile}; route CSS ${Object.values(routeStyles).join(', ')}`);
