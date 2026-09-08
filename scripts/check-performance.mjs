import { brotliCompressSync, gzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assetsDir = path.join(dist, 'assets');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sizeStats(buffer) {
  return {
    raw: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer).length
  };
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const jsMatch = html.match(/<script type="module" src="\/assets\/(app-[^"]+\.js)"><\/script>/);
const cssMatch = html.match(/<link rel="stylesheet" href="\/assets\/(app-[^"]+\.css)"/);
const routeMatch = html.match(/data-route-styles='([^']+)'/);
assert(jsMatch, 'Built HTML is missing the hashed application JavaScript entry.');
assert(cssMatch, 'Built HTML is missing the hashed core stylesheet.');
assert(routeMatch, 'Built HTML is missing the route stylesheet manifest.');

const routeStyles = JSON.parse(routeMatch[1]);
assert(Object.keys(routeStyles).sort().join(',') === 'careers,legal,services', 'Route stylesheet manifest changed unexpectedly.');
for (const [key, file] of Object.entries(routeStyles)) {
  assert(new RegExp(`^route-${key}-[A-Z0-9]+\\.css$`, 'i').test(file), `Route stylesheet is not content-hashed: ${key} -> ${file}`);
}

const assetFiles = await readdir(assetsDir);
const jsChunks = assetFiles.filter((file) => /^chunk-[A-Z0-9]+\.js$/i.test(file));
assert(jsChunks.length >= 4, `Expected route-level JavaScript splitting; only ${jsChunks.length} chunks were emitted.`);

const mainJs = await readFile(path.join(assetsDir, jsMatch[1]));
const coreCss = await readFile(path.join(assetsDir, cssMatch[1]));
const jsStats = sizeStats(mainJs);
const cssStats = sizeStats(coreCss);

const MAX_MAIN_JS_GZIP = 45 * 1024;
const MAX_CORE_CSS_GZIP = 24 * 1024;
const MAX_INITIAL_GZIP = 64 * 1024;
assert(jsStats.gzip <= MAX_MAIN_JS_GZIP, `Main JS gzip budget exceeded: ${kb(jsStats.gzip)} > ${kb(MAX_MAIN_JS_GZIP)}`);
assert(cssStats.gzip <= MAX_CORE_CSS_GZIP, `Core CSS gzip budget exceeded: ${kb(cssStats.gzip)} > ${kb(MAX_CORE_CSS_GZIP)}`);
assert(jsStats.gzip + cssStats.gzip <= MAX_INITIAL_GZIP, `Initial JS+CSS gzip budget exceeded: ${kb(jsStats.gzip + cssStats.gzip)} > ${kb(MAX_INITIAL_GZIP)}`);

let largestChunk = { file: '', gzip: 0 };
for (const file of jsChunks) {
  const stats = sizeStats(await readFile(path.join(assetsDir, file)));
  if (stats.gzip > largestChunk.gzip) largestChunk = { file, gzip: stats.gzip };
}
assert(largestChunk.gzip <= 80 * 1024, `Largest lazy JS chunk exceeds 80 KiB gzip: ${largestChunk.file} (${kb(largestChunk.gzip)})`);

for (const file of Object.values(routeStyles)) {
  const stats = sizeStats(await readFile(path.join(assetsDir, file)));
  assert(stats.gzip <= 16 * 1024, `Route CSS chunk exceeds 16 KiB gzip: ${file} (${kb(stats.gzip)})`);
}

const headers = await readFile(path.join(root, 'public', '_headers'), 'utf8');
assert(headers.includes('max-age=31536000, immutable'), 'Hashed asset immutable-cache policy is missing.');
assert(headers.includes('/index.html') && headers.includes('must-revalidate'), 'HTML revalidation policy is missing.');

console.log(`PASS: performance budgets. Initial JS ${kb(jsStats.gzip)} gzip, core CSS ${kb(cssStats.gzip)} gzip, combined ${kb(jsStats.gzip + cssStats.gzip)}; ${jsChunks.length} lazy JS chunks; largest ${largestChunk.file} ${kb(largestChunk.gzip)} gzip.`);
