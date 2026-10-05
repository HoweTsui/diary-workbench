import { readFileSync, readdirSync, writeFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins/diary-workbench');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const ignored = new Set(['node_modules', 'dist', '__pycache__', '.git']);
const forbidden = new Set(['.local', 'workspace.json', 'reference-inputs-private', 'originals', 'character-library', '.env']);
function walk(folder) {
  return readdirSync(folder, { withFileTypes:true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    assert.ok(!forbidden.has(entry.name), `Private file/directory: ${entry.name}`);
    const file = path.join(folder, entry.name);
    assert.ok(!lstatSync(file).isSymbolicLink(), `Symlink: ${file}`);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const manifest = read(path.join(plugin, 'plugin.json'));
const compatibility = read(path.join(plugin, '.codex-plugin/plugin.json'));
assert.equal(manifest.name, 'diary-workbench');
assert.equal(compatibility.name, manifest.name);
assert.equal(compatibility.version, manifest.version);
const catalog = read(path.join(plugin, 'workbench/app/default-library/diary-book-data.json'));
for (const field of ['entries','characters','relationships','periods']) assert.deepEqual(catalog[field], []);
const graph = readFileSync(path.join(plugin, 'workbench/app/default-library/character-graph.html'), 'utf8');
const graphData = JSON.parse(graph.match(/<script\b[^>]*id=["']graph-data["'][^>]*>([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(graphData.nodes, []); assert.deepEqual(graphData.edges, []);
const files = Object.fromEntries(walk(plugin).sort().map(file => [path.relative(plugin, file).split(path.sep).join('/'), hash(file)]));
for (const file of walk(plugin)) {
  if (!/\.(json|js|mjs|jsx|html|md|txt|py|yaml|yml|svg|toml)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  assert.ok(!/\/Users\/[^/\s]+\/|\/private\/var\/folders\//.test(text), `Absolute personal path: ${file}`);
  assert.ok(!/gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/.test(text), `Credential pattern: ${file}`);
}
const skill = path.join(plugin, 'skills/cartoon-diary-journal');
for (const relative of ['assets/style-reference/style-lock-v1/library.json', 'assets/style-reference/character-extension-v1/library.json']) {
  const file = path.join(skill, relative);
  function check(value) {
    if (!value || typeof value !== 'object') return;
    if (value.path && value.sha256) {
      const asset = path.resolve(path.dirname(file), value.path);
      assert.ok(asset.startsWith(skill + path.sep));
      assert.equal(hash(asset), value.sha256, value.path);
    }
    Object.values(value).forEach(check);
  }
  check(read(file));
}
const reportFile = path.join(root, 'package-report.json');
if (process.argv.includes('--refresh-report')) {
  writeFileSync(reportFile, JSON.stringify({ version:manifest.version, skillVersion:readFileSync(path.join(skill, 'VERSION'),'utf8').trim(), checks:{manifest:'passed',mandatoryStyleHashes:'passed',emptyDefaultLibrary:'passed',privateDataScan:'passed'}, files, distribution:'github-prerelease', notVerified:['Windows/Linux first-run', 'new-user real image generation and approved archive', 'OpenAI public directory submission'] }, null, 2) + '\n');
}
const report = read(reportFile);
assert.equal(report.version, manifest.version);
assert.deepEqual(files, report.files, 'Package content differs from package-report.json');
console.log(JSON.stringify({ version:manifest.version, files:Object.keys(files).length, emptyDefault:true, manifestParity:true, styleHashes:true, packageHashes:true, privatePathScan:true }));
