// Step 3 of 4. Offline. Validates the two signed records against the lexicons
// in this repository and against CONFORMANCE.md sections 1 to 5, 7 and 9.
//
//   npm run check -- --store <crossing folder>

import { join } from 'node:path';
import { requireStoreFolder, writeJson } from './lib.mjs';
import { printChecks, runChecks } from './checks.mjs';

const folder = requireStoreFolder();
const report = await runChecks(folder);
printChecks(report);
writeJson(join(folder, 'check-result.json'), report, { overwrite: true });

if (!report.pass) {
  console.log('\nRESULT: FAIL. Do not publish.');
  process.exit(1);
}
if (!report.publishable) {
  console.log(`\nRESULT: PASS (${report.mode}). This folder is not publishable.`);
  process.exit(0);
}
console.log('\nRESULT: PASS. The records are ready for the publish step.');
