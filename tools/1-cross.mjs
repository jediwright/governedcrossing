// Step 1 of 4. Drives one public crossing through the pinned prototype
// (jediwright/employment-seam, substrate-crossing) and captures the prototype's
// own intent and completion records in the local store.
//
// Modes:
//   (default)    live: publishes one com.whtwnd.blog.entry. This is permanent.
//   --dry-run    signs in and runs the whole path, but publishes to an invalid
//                collection so the write is rejected. Nothing is written.
//   --rehearse   no sign-in and no network. The publish is simulated. For
//                testing steps 2 and 3 with a throwaway key.
//
// The prototype is used in place. This file follows the single-input path of
// its scripts/run-crossing.ts and calls its src/ modules unmodified.

import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { AtpAgent } from '@atproto/api';
import WebSocket from 'ws';
import '@automerge/automerge-subduction';
import { Repo } from '@automerge/automerge-repo';
import { DummyStorageAdapter } from '@automerge/automerge-repo/helpers/DummyStorageAdapter.js';
import { initializeAutomergeRepoKeyhive, Access } from '@automerge/automerge-repo-keyhive';
import {
  EMITTER_DID, ENTRY_ACKNOWLEDGMENT, ENTRY_BODY, ENTRY_TITLE,
  assertOutsideGit, assertPrototypePinned, ensureDir, flag, option, readEnvFile,
  storeRoot, utcDate, writeJson,
} from './lib.mjs';

const TAG = '[cross]';
const DRY_RUN = flag('dry-run');
const REHEARSE = flag('rehearse');
const MODE = REHEARSE ? 'rehearsal' : DRY_RUN ? 'dry-run' : 'live';
const RUN_LABEL = option('label', 'run-9');
const HORIZON_S = Number(option('horizon-s', '120'));
const READ_WAIT_MS = 15_000;
const RELAY_TIMEOUT_MS = 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The entry title carries the emitter's local calendar date. Record timestamps and the store folder stay in UTC.
const localDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const { dir: protoRoot, head: protoHead } = assertPrototypePinned();
const proto = join(protoRoot, 'substrate-crossing');
const load = (rel) => import(pathToFileURL(join(proto, rel)).href);

const { initiateCrossing } = await load('src/crossing-intent.ts');
const { assembleCrossingContent } = await load('src/assembly.ts');
const { makeTimedPutRecord, emptyTimings, JetstreamWatcher, createCompletionHook, DEFAULT_JETSTREAM } =
  await load('src/crossing-fire.ts');
const { writeCrossingCompletion, deriveDocumentCrossingState } = await load('src/crossing-completion.ts');
const { PairNetworkAdapter } = await load('test/helpers/pair-network-adapter.ts');

// --- store folder -----------------------------------------------------------

const startedAt = new Date();
const suffix = MODE === 'live' ? '' : `-${MODE}-${startedAt.toISOString().slice(11, 19).replace(/:/g, '')}`;
const folder = join(storeRoot(), `${utcDate(startedAt)}-${RUN_LABEL}${suffix}`);
assertOutsideGit(storeRoot());
if (existsSync(folder)) {
  console.error(`${TAG} ${folder} already exists. A crossing has already been run under this label today.`);
  process.exit(1);
}
ensureDir(join(folder, 'old-shape'));
const runFile = join(folder, 'run.json');
const run = {
  mode: MODE,
  label: RUN_LABEL,
  startedAt: startedAt.toISOString(),
  prototype: { repository: 'jediwright/employment-seam', commit: protoHead },
  status: 'started',
};
const saveRun = () => writeJson(runFile, run, { overwrite: true });
saveRun();
console.log(`${TAG} mode: ${MODE}; store folder: ${folder}`);

// --- sign-in ----------------------------------------------------------------

let agent = null;
let did = EMITTER_DID;
let service = 'https://rehearsal.invalid';
let jetstream = DEFAULT_JETSTREAM;
if (!REHEARSE) {
  const env = readEnvFile(join(proto, '.env'));
  if (!env.PDS_HANDLE || !env.PDS_APP_PASSWORD) {
    console.error(`${TAG} PDS_HANDLE or PDS_APP_PASSWORD is missing from the prototype's .env`);
    process.exit(1);
  }
  const entry = env.PDS_SERVICE || 'https://bsky.social';
  jetstream = env.JETSTREAM_ENDPOINT || DEFAULT_JETSTREAM;
  agent = new AtpAgent({ service: entry });
  await agent.login({ identifier: env.PDS_HANDLE, password: env.PDS_APP_PASSWORD });
  did = agent.session.did;
  if (did !== EMITTER_DID) {
    console.error(`${TAG} signed in as ${did}; this tool emits records only for ${EMITTER_DID}.`);
    process.exit(1);
  }
  service = (agent.pdsUrl ? agent.pdsUrl.toString() : entry).replace(/\/$/, '');
  console.log(`${TAG} signed in as ${did}; writes go to ${service}`);
}
run.did = did;
run.targetService = service;
saveRun();

// --- two Keyhive parties, paired in process (as in the prototype runner) ------

const edPair = () => crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const wireId = async (kp) => Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))).toString('base64');
const hexId = (id) => Buffer.from(id.toBytes()).toString('hex');

async function makeHivePair() {
  const [authorNet, actorNet] = PairNetworkAdapter.createConnectedPair();
  const [kpAuthor, kpActor] = await Promise.all([edPair(), edPair()]);
  const [pidAuthor, pidActor] = await Promise.all([wireId(kpAuthor), wireId(kpActor)]);
  const mk = (kp, remote, adapter, label, role) =>
    initializeAutomergeRepoKeyhive({
      storage: new DummyStorageAdapter(),
      peerIdSuffix: label,
      keyPair: kp,
      syncServer: 'none',
      remotePeerId: remote,
      shareConfigDebounceMs: 0,
      createRepo: (cfg) => new Repo(cfg),
      repo: {
        storage: new DummyStorageAdapter(),
        subductionAdapters: [{ adapter, serviceName: 'governedcrossing-example', role }],
      },
    });
  const [author, actor] = await Promise.all([
    mk(kpAuthor, pidActor, authorNet, 'example-author', 'accept'),
    mk(kpActor, pidAuthor, actorNet, 'example-actor', 'connect'),
  ]);
  authorNet.peerCandidate(actorNet.peerId);
  actorNet.peerCandidate(authorNet.peerId);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (author.repo.isSubductionConnected() && actor.repo.isSubductionConnected()) return { author, actor };
    await sleep(100);
  }
  throw new Error('the two parties did not connect within 10 seconds');
}

async function grantWithPoll(hive, url, card, access) {
  for (let i = 0; i < 20; i++) {
    try {
      await hive.hive.addMemberToDoc(url, card, access);
      return;
    } catch (e) {
      if (e?.name === 'UnprotectedDocError' || /unprotected/i.test(String(e))) await sleep(250);
      else throw e;
    }
  }
  throw new Error(`document never became access-controlled: ${url}`);
}

const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout:${label}`)), ms))]);

async function loadOnActor(actor, url, waitMs) {
  const self = actor.hive.active.individual.id;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const seen = await actor.hive.accessForDoc(self, url);
    if (seen !== undefined && seen !== null) break;
    await sleep(200);
  }
  let last = 'membership not visible';
  while (Date.now() < deadline) {
    const roundMs = Math.max(500, Math.min(3_000, deadline - Date.now()));
    try {
      const h = await withTimeout(actor.repo.find(url), roundMs, 'find');
      const d = await withTimeout(h.doc(), roundMs, 'doc');
      if (d && typeof d.title === 'string' && typeof d.content === 'string') return h;
      last = 'content not readable';
    } catch (e) {
      last = String(e?.message ?? e);
      try { actor.repo.resyncSubduction(url.replace(/^automerge:/, '')); } catch { /* best effort */ }
    }
    await sleep(300);
  }
  throw new Error(`the crossing actor could not read the granted document within ${waitMs}ms (${last})`);
}

function makeGate(author, actorIndividualId) {
  const actorHex = hexId(actorIndividualId);
  return async ({ documentURI }) => {
    const access = await author.hive.accessForDoc(actorIndividualId, documentURI);
    const at = new Date().toISOString();
    if (access !== undefined && access !== null && access.isReader) {
      const level = access.toString();
      return { result: 'pass', grantReference: `keyhive:${actorHex}:${level.toLowerCase()}`, gateCheckedAt: at, access: level, documentURI };
    }
    return {
      result: 'blocked', grantReference: null, gateCheckedAt: at, documentURI,
      access: access ? access.toString() : undefined,
      reason: access ? `access level ${access.toString()} is below read` : 'no authorizing grant present',
    };
  };
}

// --- the crossing -----------------------------------------------------------

async function main() {
  const { author, actor } = await makeHivePair();
  const actorCard = actor.hive.active.contactCard;
  const actorIndividual = await author.hive.receiveContactCard(actorCard);
  if (!actorIndividual) throw new Error('the author could not resolve the crossing actor');
  const gate = makeGate(author, actorIndividual.id);

  // The source document: created here, for this example, by the author party.
  const source = await author.repo.create2({
    title: ENTRY_TITLE(localDate(startedAt)),
    content: ENTRY_BODY,
    createdAt: startedAt.toISOString(),
  });
  await grantWithPoll(author, source.url, actorCard, Access.read());
  console.log(`${TAG} source document created and read access granted: ${source.url}`);

  const actorSource = await loadOnActor(actor, source.url, READ_WAIT_MS);
  const input = {
    url: actorSource.url,
    doc: () => actorSource.doc(),
    heads: () => { try { return actorSource.heads?.(); } catch { return undefined; } },
  };
  const d = await input.doc();
  const assembled = assembleCrossingContent([{ title: d.title, content: d.content, createdAt: d.createdAt }]);
  if (assembled.createdAt === null) throw new Error('assembled content has no createdAt');
  const presented = { title: assembled.title, content: assembled.content, createdAt: assembled.createdAt };

  // The assembly document: owned by the crossing actor; the author can read it.
  const asm = await actor.repo.create2({ title: '', content: '', createdAt: null });
  await grantWithPoll(actor, asm.url, author.hive.active.contactCard, Access.read());

  let watcher = null;
  if (MODE === 'live') {
    watcher = new JetstreamWatcher({
      endpoint: jetstream, did, collection: 'com.whtwnd.blog.entry',
      timeoutMs: RELAY_TIMEOUT_MS, wsFactory: (url) => new WebSocket(url),
    });
    await watcher.start();
  }

  const record = {
    $type: 'com.whtwnd.blog.entry',
    title: presented.title,
    content: presented.content,
    createdAt: presented.createdAt,
    visibility: 'public',
  };
  const collection = DRY_RUN ? 'com.whtwnd.invalid.collection!' : 'com.whtwnd.blog.entry';
  const timings = emptyTimings();
  let publishedPayload = null;

  const put = makeTimedPutRecord({
    publish: async (rec) => {
      // The intent goes to disk before anything is published.
      const before = await asm.doc();
      const minted = (before.crossingRecords ?? []).at(-1);
      if (!minted || minted.recordType !== 'crossing-intent') throw new Error('no intent record in the assembly document at publish time');
      writeJson(join(folder, 'old-shape', 'intent.json'), JSON.parse(JSON.stringify(minted)));
      run.status = 'intent-stored';
      saveRun();
      publishedPayload = rec;
      if (REHEARSE) {
        return {
          uri: `at://${did}/com.whtwnd.blog.entry/rehearsal${randomBytes(4).toString('hex')}`,
          cid: 'bafyreibb3v2xdvbun3nszerwyazneil3f7brruxqhb2yt2g4x35uf5y4lq',
        };
      }
      const res = await agent.com.atproto.repo.createRecord({ repo: did, collection, record: { ...rec } });
      return { uri: res.data.uri, cid: res.data.cid };
    },
    record,
    timings,
    attachSeamCrossingRef: true,
  });

  const log = [];
  const hook = createCompletionHook();
  let outcome;
  try {
    outcome = await initiateCrossing({
      inputs: [input],
      handle: asm,
      presentedContent: presented,
      gateCheck: gate,
      putRecord: put,
      identity: { grantorDID: did, targetDID: did, identityCustodyClass: 'provider-custodied' },
      targetPDS: service,
      regimeAcknowledgment: ENTRY_ACKNOWLEDGMENT,
      crossingTimeoutHorizon: new Date(Date.now() + HORIZON_S * 1000).toISOString(),
      log,
    });
  } catch (e) {
    watcher?.close();
    writeJson(join(folder, 'crossing-log.json'), log);
    run.status = 'publish-failed';
    run.error = String(e?.message ?? e);
    saveRun();
    if (DRY_RUN) {
      console.log(`${TAG} dry run: the publish was rejected as intended (${run.error}). Nothing was written to the network.`);
      console.log(`${TAG} the intent is in ${join(folder, 'old-shape', 'intent.json')}; there is no completion, so steps 2 to 4 do not apply.`);
      return 0;
    }
    console.error(`${TAG} publish failed: ${run.error}`);
    console.error(`${TAG} no completion exists. Nothing is published about a crossing that did not complete.`);
    return 1;
  }

  if (outcome.status !== 'fired') {
    watcher?.close();
    writeJson(join(folder, 'crossing-log.json'), log);
    run.status = `blocked:${outcome.status}`;
    run.reason = outcome.reason ?? null;
    saveRun();
    console.error(`${TAG} the crossing did not fire: ${outcome.status} ${outcome.reason ?? ''}`);
    return 1;
  }

  console.log(`${TAG} entry ${REHEARSE ? "publish simulated" : "published"}: ${outcome.put.uri}`);
  writeJson(join(folder, 'entry.json'), { uri: outcome.put.uri, cid: outcome.put.cid, payload: publishedPayload });
  run.status = 'published-entry';
  run.entry = { uri: outcome.put.uri, cid: outcome.put.cid };
  saveRun();

  let relayIngestedAt = null;
  if (watcher) {
    const relay = await watcher.observed();
    relayIngestedAt = relay.relayIngestedAt;
    console.log(relay.timedOut ? `${TAG} relay event not seen within ${RELAY_TIMEOUT_MS}ms` : `${TAG} relay saw the entry`);
    watcher.close();
  }

  try {
    const completion = await writeCrossingCompletion({
      handle: asm,
      intent: outcome.intent,
      put: { uri: timings.uri, cid: timings.cid },
      pdsAcceptedAt: timings.pdsAcceptedAt,
      relayIngestedAt,
      hook,
      log,
    });
    writeJson(join(folder, 'old-shape', 'completion.json'), JSON.parse(JSON.stringify(completion)));
    const state = deriveDocumentCrossingState(await asm.doc());
    run.status = 'completed';
    run.documentState = state;
  } catch (e) {
    run.status = 'completion-not-written';
    run.error = String(e?.message ?? e);
    saveRun();
    writeJson(join(folder, 'crossing-log.json'), log);
    console.error(`${TAG} the entry was published but the completion could not be written: ${run.error}`);
    console.error(`${TAG} stop here and report this. Do not run this step again.`);
    return 1;
  }

  writeJson(join(folder, 'crossing-log.json'), log);
  run.finishedAt = new Date().toISOString();
  saveRun();
  console.log(`${TAG} completion written. Old-shape records are in ${join(folder, 'old-shape')}`);
  console.log(`${TAG} next: npm run sign -- --store ${folder}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    run.status = 'error';
    run.error = String(e?.message ?? e);
    try { saveRun(); } catch { /* keep the original error */ }
    console.error(`${TAG} failed:`, e);
    process.exit(1);
  });
