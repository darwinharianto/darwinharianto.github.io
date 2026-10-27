/**
 * Automated UI & Static Integrity Test Suite for Darwin's Portfolio
 * Tests link integrity, script syntax, canvas elements, modal bindings, and category filters.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function getHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'scripts') {
      getHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

console.log('\n========================================');
console.log('  Portfolio UI & Integrity Test Suite');
console.log('========================================\n');

// 1. Scan and parse all HTML files
const htmlFiles = getHtmlFiles(ROOT_DIR);
console.log(`Discovered ${htmlFiles.length} HTML pages:\n`);
htmlFiles.forEach(f => console.log(`  • ${path.relative(ROOT_DIR, f)}`));

console.log('\n--- Test Suite 1: JavaScript Syntax & Script Compilation ---');
htmlFiles.forEach(file => {
  const relPath = path.relative(ROOT_DIR, file);
  const content = fs.readFileSync(file, 'utf8');
  const scriptRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIndex = 0;

  while ((match = scriptRegex.exec(content)) !== null) {
    scriptIndex++;
    const code = match[1].trim();
    if (!code) continue;

    try {
      // Test compilation in a sandbox VM
      new vm.Script(code, { filename: `${relPath}[script-${scriptIndex}]` });
      assert(true, `${relPath} script #${scriptIndex} compiled without syntax errors`);
    } catch (err) {
      assert(false, `${relPath} script #${scriptIndex} compilation error: ${err.message}`);
    }
  }
});

console.log('\n--- Test Suite 2: Internal Links & Page Existence ---');
htmlFiles.forEach(file => {
  const relPath = path.relative(ROOT_DIR, file);
  const content = fs.readFileSync(file, 'utf8');
  const fileDir = path.dirname(file);

  // Strip <script> and <style> tags so dynamic template strings aren't parsed as static page links
  const contentForLinks = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  // Match href="path" (excluding mailto, https, #anchor, tel)
  const linkRegex = /href=["']([^"']+)["']/g;
  let match;

  while ((match = linkRegex.exec(contentForLinks)) !== null) {
    const href = match[1];
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:') || href.includes('$')) {
      continue;
    }

    if (href.startsWith('#')) {
      // In-page anchor link
      const anchorId = href.substring(1);
      if (anchorId) {
        const idRegex = new RegExp(`id=["']${anchorId}["']`, 'i');
        assert(idRegex.test(content), `${relPath} anchor link '${href}' matches element with id='${anchorId}'`);
      }
      continue;
    }

    // Relative path link
    const cleanPath = href.split('#')[0];
    const targetAnchor = href.includes('#') ? href.split('#')[1] : null;

    if (cleanPath) {
      const resolvedPath = path.resolve(fileDir, cleanPath);
      const exists = fs.existsSync(resolvedPath);
      assert(exists, `${relPath} link '${href}' resolves to existing file on disk`);

      if (exists && targetAnchor) {
        const targetContent = fs.readFileSync(resolvedPath, 'utf8');
        const idRegex = new RegExp(`id=["']${targetAnchor}["']`, 'i');
        assert(idRegex.test(targetContent), `${relPath} anchor '#${targetAnchor}' exists in ${cleanPath}`);
      }
    }
  }
});

console.log('\n--- Test Suite 3: Interactive Canvas & DOM IDs ---');
htmlFiles.forEach(file => {
  const relPath = path.relative(ROOT_DIR, file);
  const content = fs.readFileSync(file, 'utf8');

  // Find all document.getElementById calls in scripts
  const idRegex = /document\.getElementById\(["']([^"']+)["']\)/g;
  let match;
  const queriedIds = new Set();

  while ((match = idRegex.exec(content)) !== null) {
    queriedIds.add(match[1]);
  }

  queriedIds.forEach(id => {
    const elemRegex = new RegExp(`id=["']${id}["']`, 'i');
    assert(elemRegex.test(content), `${relPath} queried DOM ID '${id}' exists in HTML markup`);
  });
});

console.log('\n--- Test Suite 4: index.html Project Modals & Filter Integrity ---');
const indexPath = path.join(ROOT_DIR, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// 1. Verify all modal keys used in onclick="openProjectModal('key')" exist in modalData
const modalCallRegex = /openProjectModal\(["']([^"']+)["']\)/g;
const calledModalKeys = new Set();
let modalMatch;
while ((modalMatch = modalCallRegex.exec(indexContent)) !== null) {
  calledModalKeys.add(modalMatch[1]);
}

// Extract modalData keys
const modalDataKeyRegex = /\b([a-zA-Z0-9_]+):\s*\{\s*category:/g;
const definedModalKeys = new Set();
let keyMatch;
while ((keyMatch = modalDataKeyRegex.exec(indexContent)) !== null) {
  definedModalKeys.add(keyMatch[1]);
}

calledModalKeys.forEach(key => {
  assert(definedModalKeys.has(key), `openProjectModal('${key}') has matching definition in modalData`);
});

// 2. Verify all filter pills match project card categories
const filterPillRegex = /data-filter=["']([^"']+)["']/g;
const filterPills = new Set();
let pillMatch;
while ((pillMatch = filterPillRegex.exec(indexContent)) !== null) {
  filterPills.add(pillMatch[1]);
}

const cardCategoryRegex = /class=["'][^"']*project-card[^"']*["'][^>]*data-category=["']([^"']+)["']/g;
const cardCategories = new Set();
let catMatch;
let cardCount = 0;
while ((catMatch = cardCategoryRegex.exec(indexContent)) !== null) {
  cardCategories.add(catMatch[1]);
  cardCount++;
}

assert(cardCount === 9, `Exactly 9 featured project cards exist in index.html (found ${cardCount})`);
cardCategories.forEach(cat => {
  assert(filterPills.has(cat), `Project card category '${cat}' has a corresponding filter pill`);
});

// --- Test Suite 5: Tech Stack Radar & Developer Command Palette Integrity ---
console.log('--- Test Suite 5: Tech Stack Radar & Developer Command Palette ---');
assert(indexContent.includes('id="commandPaletteModal"'), '#commandPaletteModal exists in index.html');
assert(indexContent.includes('id="paletteSearchInput"'), '#paletteSearchInput exists in index.html');
assert(indexContent.includes('id="paletteResults"'), '#paletteResults exists in index.html');
assert(indexContent.includes('id="radarSpotlightBar"'), '#radarSpotlightBar exists in index.html');
assert(indexContent.includes('id="radarActiveTechName"'), '#radarActiveTechName exists in index.html');
assert(indexContent.includes('id="radarMatchCount"'), '#radarMatchCount exists in index.html');

// Verify all 9 project cards have data-tech attributes
const cardTechRegex = /class=["'][^"']*project-card[^"']*["'][^>]*data-tech=["']([^"']+)["']/g;
let cardTechCount = 0;
while (cardTechRegex.exec(indexContent) !== null) {
  cardTechCount++;
}
assert(cardTechCount === 9, `All 9 project cards have data-tech attributes for radar cross-linking (found ${cardTechCount})`);

// Verify tech radar buttons exist
const radarBtnRegex = /class=["'][^"']*tech-radar-btn[^"']*["']/g;
let radarBtnCount = 0;
while (radarBtnRegex.exec(indexContent) !== null) {
  radarBtnCount++;
}
assert(radarBtnCount >= 18, `At least 18 clickable tech radar badges exist across 6 pillars (found ${radarBtnCount})`);

// Summary
console.log('\n========================================');
console.log(`  Tests Completed: ${totalTests}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);
console.log('========================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('✨ All UI integrity, script syntax, and DOM binding tests passed successfully!\n');
  process.exit(0);
}
