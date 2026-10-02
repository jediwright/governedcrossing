// Registers a resolve hook so that 1-cross.mjs can import the prototype's
// dependencies (Automerge, Keyhive, @atproto/api, ws) from the prototype's own
// node_modules. The prototype is used in place and never copied or modified.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const dir = process.env.EMPLOYMENT_SEAM_DIR;
if (!dir) {
  console.error('Set EMPLOYMENT_SEAM_DIR to a clone of jediwright/employment-seam.');
  process.exit(1);
}
const parent = pathToFileURL(resolve(dir, 'substrate-crossing', 'scripts', 'anchor.ts')).href;
register('./proto-hooks.mjs', import.meta.url, {
  data: { parent, tools: new URL('./', import.meta.url).href },
});
