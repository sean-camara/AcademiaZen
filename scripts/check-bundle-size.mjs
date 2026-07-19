import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const budgets = {
  '.js': 350 * 1024,
  '.css': 125 * 1024,
};

const assetsDirectory = path.resolve('dist/assets');
const files = await readdir(assetsDirectory);
const failures = [];

for (const file of files) {
  const extension = path.extname(file);
  const budget = budgets[extension];
  if (!budget) continue;
  const { size } = await stat(path.join(assetsDirectory, file));
  if (size > budget) failures.push(`${file}: ${size} bytes exceeds ${budget}`);
}

if (failures.length > 0) {
  console.error(`Bundle budget failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Bundle budget passed.');
}
