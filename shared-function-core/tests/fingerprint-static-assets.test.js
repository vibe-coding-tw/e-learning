import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  processHtmlFile,
  stripQueryAndHash,
  dehashAssetPath,
} = require('../../scripts/fingerprint-static-assets.js');

const rootDir = path.resolve(process.cwd(), '..');
const publicDir = path.join(rootDir, 'public');
const testDir = path.join(publicDir, '__fingerprint_test__');

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('fingerprint-static-assets smoke test', () => {
  it('rewrites local js and css asset references with hashed filenames', () => {
    fs.mkdirSync(testDir, { recursive: true });

    const htmlPath = path.join(testDir, 'index.html');
    const jsPath = path.join(testDir, 'widget.js');
    const cssPath = path.join(testDir, 'widget.css');

    fs.writeFileSync(jsPath, 'console.log("widget");\n', 'utf8');
    fs.writeFileSync(cssPath, '.widget { color: red; }\n', 'utf8');
    fs.writeFileSync(
      htmlPath,
      [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<script src="/__fingerprint_test__/widget.js?v=1"></script>',
        '<link rel="stylesheet" href="./widget.css#v=2">',
        '</head>',
        '<body>ok</body>',
        '</html>',
      ].join('\n'),
      'utf8'
    );

    processHtmlFile(htmlPath);

    const rewritten = fs.readFileSync(htmlPath, 'utf8');
    expect(rewritten).toMatch(/__fingerprint_test__\/widget\.[0-9a-f]{12}\.js/);
    expect(rewritten).toMatch(/\.\/widget\.[0-9a-f]{12}\.css/);
    expect(rewritten).not.toContain('?v=1');
    expect(rewritten).not.toContain('#v=2');
    expect(fs.readdirSync(testDir).some((name) => /^widget\.[0-9a-f]{12}\.js$/i.test(name))).toBe(true);
    expect(fs.readdirSync(testDir).some((name) => /^widget\.[0-9a-f]{12}\.css$/i.test(name))).toBe(true);
  });
});

describe('fingerprint helper utilities', () => {
  it('strips query and hash fragments from asset refs', () => {
    expect(stripQueryAndHash('widget.js?v=1#hash')).toBe('widget.js');
  });

  it('dehashes existing hashed asset paths', () => {
    expect(dehashAssetPath('widget.123456789abc.js')).toBe('widget.js');
  });
});
