import assert from "node:assert/strict";
import fs from "node:fs";

const phase18 = fs.readFileSync("tests/phase18-responsive-contract.mjs","utf8");
const publicSpec = fs.readFileSync("tests/phase18-public-responsive.spec.mjs","utf8");
const adminSpec = fs.readFileSync("tests/phase18-admin-responsive.spec.mjs","utf8");
const accessibility = fs.readFileSync("tests/phase19-accessibility.spec.mjs","utf8");
const responsiveCss = fs.readFileSync("src/frontend/styles/responsive.css","utf8");
const phase18Css = fs.readFileSync("src/frontend/styles/phase18-responsive.css","utf8");
const phase18Config = fs.readFileSync("playwright.config.mjs","utf8");
const phase20Config = fs.readFileSync("playwright.phase20-16.config.mjs","utf8");

for (const browser of ["chromium","firefox","webkit"]) {
  assert.ok(phase18Config.includes(browser), `Phase 18 matrix lost browser: ${browser}`);
  assert.ok(phase20Config.includes(browser), `Phase 20.16 accessibility matrix missing browser: ${browser}`);
}

for (const width of ["320","390","768","1024","1280"]) {
  assert.ok(phase18Config.includes(width), `Phase 18 viewport matrix lost width: ${width}`);
}

for (const marker of [
  "wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa",
  "Skip to main content","visible keyboard focus"
]) assert.ok(accessibility.includes(marker), `Accessibility contract missing: ${marker}`);

assert.match(publicSpec,/document overflow/i);
assert.match(publicSpec,/mobile menu remains operable/i);
assert.match(publicSpec,/orientation-like resizing/i);
assert.match(publicSpec,/official breakpoint boundaries/i);
assert.match(adminSpec,/admin navigation/i);
assert.match(adminSpec,/touch actions/i);
assert.match(adminSpec,/authentication surface/i);
assert.match(adminSpec,/applications register/i);
assert.match(adminSpec,/dialog remains bounded/i);

assert.match(phase18,/safe-area-inset-right/);
assert.match(phase18,/min-height:44px/);
assert.match(responsiveCss,/prefers-reduced-motion:\s*reduce/);
assert.match(phase18Css,/overflow-wrap:\s*anywhere/);
assert.doesNotMatch(phase18Css,/html\s*\{\s*overflow-x:/i);

console.log("Phase 20.16 responsive/accessibility/cross-browser source certification: PASS");
