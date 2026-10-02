// Step 2 of 4. Offline. Maps the prototype's old-shape records onto the
// org.governedcrossing.temp.crossingRecord lexicon, then signs each as emitter.
//
// The signing key is read from a terminal prompt. It is never echoed, never
// written to disk and never taken from a file, an argument or the environment.
//
//   npm run sign -- --store <crossing folder>
//   npm run sign -- --store <crossing folder> --redo      (new record ids and salts; only before publishing)
//   npm run sign -- --store <rehearsal folder> --throwaway-key

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { p256 } from '@noble/curves/p256';
import {
  EMITTER_DID, KEY_PUBLIC_DIDKEY, KEY_REF, SALT_BYTES, SIGNATURE_TYPE,
  b64, didKeyFromPublic, ensureDir, flag, parseSecretKey, promptHidden, publicFromDidKey,
  readJson, requireStoreFolder, signCid, signedCid, verifyCid, writeJson,
} from './lib.mjs';
import { projectCompletion, projectIntent } from './projection.mjs';

const TAG = '[sign]';
const folder = requireStoreFolder();
const run = readJson(join(folder, 'run.json'));
const recordsDir = join(folder, 'records');

if (run.status !== 'completed') {
  console.error(`${TAG} this crossing did not complete (status: ${run.status}). Nothing is signed or published for it.`);
  process.exit(1);
}
if (existsSync(join(folder, 'published.json'))) {
  console.error(`${TAG} records from this folder have already been published. They are not re-signed.`);
  process.exit(1);
}
if (existsSync(recordsDir)) {
  if (!flag('redo')) {
    console.error(`${TAG} ${recordsDir} already exists. Pass --redo to replace the unpublished records.`);
    process.exit(1);
  }
  rmSync(recordsDir, { recursive: true });
  rmSync(join(folder, 'check-result.json'), { force: true });
}

const rehearsal = run.mode === 'rehearsal';
if (flag('throwaway-key') && !rehearsal) {
  console.error(`${TAG} --throwaway-key is for rehearsal folders only.`);
  process.exit(1);
}

let secret;
let publicDidKey;
if (rehearsal) {
  if (!flag('throwaway-key')) {
    console.error(`${TAG} this is a rehearsal folder. Pass --throwaway-key; the real key is not used for rehearsals.`);
    process.exit(1);
  }
  secret = p256.utils.randomPrivateKey();
  publicDidKey = didKeyFromPublic(p256.getPublicKey(secret, true));
  writeJson(join(folder, 'rehearsal-key.json'), { publicKey: publicDidKey }, { overwrite: true });
} else {
  secret = parseSecretKey(await promptHidden('Signing key (input is hidden): '));
  publicDidKey = didKeyFromPublic(p256.getPublicKey(secret, true));
  if (publicDidKey !== KEY_PUBLIC_DIDKEY) {
    console.error(`${TAG} that key does not match ${KEY_REF}. Nothing was signed.`);
    process.exit(1);
  }
}

const oldIntent = readJson(join(folder, 'old-shape', 'intent.json'));
const oldCompletion = readJson(join(folder, 'old-shape', 'completion.json'));

const intent = projectIntent(oldIntent, {
  recordId: `urn:uuid:${randomUUID()}`,
  emittedBy: EMITTER_DID,
  salt: b64(randomBytes(SALT_BYTES)),
});
const completion = await projectCompletion(oldCompletion, intent, {
  recordId: `urn:uuid:${randomUUID()}`,
  emittedBy: EMITTER_DID,
  salt: b64(randomBytes(SALT_BYTES)),
});

async function sign(record) {
  const meta = { $type: SIGNATURE_TYPE, key: KEY_REF, role: 'emitter' };
  const cid = await signedCid(record, meta);
  const signature = signCid(cid, secret);
  if (!verifyCid(cid, signature, publicFromDidKey(publicDidKey))) throw new Error('self-check failed: signature does not verify');
  return { record: { ...record, signatures: [{ ...meta, signature: { $bytes: b64(signature) } }] }, signedCid: cid.toString() };
}

const signedIntent = await sign(intent);
const signedCompletion = await sign(completion);
secret.fill(0);

ensureDir(recordsDir);
writeJson(join(recordsDir, 'intent.json'), signedIntent.record);
writeJson(join(recordsDir, 'completion.json'), signedCompletion.record);
writeJson(join(recordsDir, 'signing.json'), {
  signedAt: new Date().toISOString(),
  key: KEY_REF,
  publicKey: publicDidKey,
  form: 'data-model (bytes as CBOR byte strings)',
  intentSignedCid: signedIntent.signedCid,
  completionSignedCid: signedCompletion.signedCid,
});

console.log(`${TAG} signed records written to ${recordsDir}`);
console.log(`${TAG} next: npm run check -- --store ${folder}`);
