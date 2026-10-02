// Step 4 of 4. Network write. Publishes the two signed records to the
// emitter's repository, intent first, then reads each back and compares.
//
//   npm run publish-records -- --store <crossing folder> --yes
//
// Refuses unless the folder is from a live crossing, the offline check passes
// on the files as they are now, and nothing from the folder is already
// published. Sign-in uses the handle and App Password in the prototype's .env.

import * as dagCbor from '@ipld/dag-cbor';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMITTER_DID, RECORD_NSID, flag, prototypeDir, readEnvFile, readJson, requireStoreFolder, toDataModel, writeJson,
} from './lib.mjs';
import { printChecks, runChecks } from './checks.mjs';

const TAG = '[publish]';
const folder = requireStoreFolder();
const publishedFile = join(folder, 'published.json');

if (existsSync(publishedFile)) {
  console.error(`${TAG} ${publishedFile} exists. Records from this folder were already published, or a publish was started. Inspect that file before doing anything else.`);
  process.exit(1);
}

const report = await runChecks(folder);
if (!report.pass) {
  printChecks(report);
  console.error(`\n${TAG} the offline check fails. Nothing was published.`);
  process.exit(1);
}
if (!report.publishable) {
  console.error(`${TAG} this folder is a ${report.mode} folder. Only records from a live crossing are published.`);
  process.exit(1);
}
console.log(`${TAG} offline check passes: ${report.results.length} of ${report.results.length}.`);

const intent = readJson(join(folder, 'records', 'intent.json'));
const completion = readJson(join(folder, 'records', 'completion.json'));

if (!flag('yes')) {
  console.log(`${TAG} this will write two permanent public records to ${EMITTER_DID}, collection ${RECORD_NSID}:`);
  console.log(`${TAG}   intent     ${intent.recordId}`);
  console.log(`${TAG}   completion ${completion.recordId}`);
  console.log(`${TAG} run again with --yes to publish.`);
  process.exit(0);
}

const env = readEnvFile(join(prototypeDir(), 'substrate-crossing', '.env'));
if (!env.PDS_HANDLE || !env.PDS_APP_PASSWORD) {
  console.error(`${TAG} PDS_HANDLE or PDS_APP_PASSWORD is missing from the prototype's .env`);
  process.exit(1);
}
let service = (env.PDS_SERVICE || 'https://bsky.social').replace(/\/$/, '');

async function xrpc(method, name, { body, params, token } = {}) {
  const url = new URL(`${service}/xrpc/${name}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const session = await xrpc('POST', 'com.atproto.server.createSession', {
  body: { identifier: env.PDS_HANDLE, password: env.PDS_APP_PASSWORD },
});
if (session.did !== EMITTER_DID) {
  console.error(`${TAG} signed in as ${session.did}; records are emitted by ${EMITTER_DID}. Nothing was published.`);
  process.exit(1);
}

const host = session.didDoc?.service?.find((s) => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint;
if (typeof host === 'string' && host.startsWith('https://')) service = host.replace(/\/$/, '');
console.log(`${TAG} signed in; writing to ${service}`);

const localCid = async (record) =>
  CID.createV1(dagCbor.code, await sha256.digest(dagCbor.encode(toDataModel(record)))).toString();

const published = { startedAt: new Date().toISOString(), repository: EMITTER_DID, collection: RECORD_NSID, records: {} };

async function publishOne(name, record) {
  // No `validate` flag: the host does not know this lexicon, and the records were validated locally.
  const out = await xrpc('POST', 'com.atproto.repo.createRecord', {
    token: session.accessJwt,
    body: { repo: EMITTER_DID, collection: RECORD_NSID, record },
  });
  published.records[name] = {
    uri: out.uri, cid: out.cid, validationStatus: out.validationStatus ?? null, recordId: record.recordId,
  };
  writeJson(publishedFile, published, { overwrite: true });
  console.log(`${TAG} ${name} published: ${out.uri}`);

  const rkey = out.uri.split('/').at(-1);
  const got = await xrpc('GET', 'com.atproto.repo.getRecord', { params: { repo: EMITTER_DID, collection: RECORD_NSID, rkey } });
  const expected = await localCid(record);
  const readBack = await localCid(got.value);
  const same = expected === out.cid && readBack === out.cid;
  published.records[name].readBackMatches = same;
  published.records[name].localCid = expected;
  writeJson(publishedFile, published, { overwrite: true });
  console.log(`${TAG} ${name} read back: ${same ? 'identical to the local canonical copy' : 'DIFFERS from the local copy'}`);
  return same;
}

const okIntent = await publishOne('intent', intent);
const okCompletion = await publishOne('completion', completion);
published.finishedAt = new Date().toISOString();
writeJson(publishedFile, published, { overwrite: true });

console.log(`\n${TAG} AT-URIs:`);
console.log(`  ${published.records.intent.uri}`);
console.log(`  ${published.records.completion.uri}`);
if (!okIntent || !okCompletion) {
  console.error(`${TAG} a published record does not match its local copy. Report this before linking the records anywhere.`);
  process.exit(1);
}
