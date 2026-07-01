const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const roots = ['server.js', 'controllers', 'routes', 'models', 'middleware', 'utils', 'scripts'];
const files = [];

function walk(target) {
  if (!fs.existsSync(target)) return;

  const stat = fs.statSync(target);

  if (stat.isFile() && target.endsWith('.js')) {
    files.push(target);
    return;
  }

  if (!stat.isDirectory()) return;

  for (const entry of fs.readdirSync(target)) {
    walk(path.join(target, entry));
  }
}

for (const root of roots) {
  walk(root);
}

let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
