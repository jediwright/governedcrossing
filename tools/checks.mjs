// The offline check: lexicon validation plus the CONFORMANCE.md rules that
// apply to a public crossing-intent / crossing-completion pair
// (sections 1 to 5, 7 and 9). Used by 3-check.mjs and again by 4-publish.mjs.

import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMITTER_DID, KEY_PUBLIC_DIDKEY, KEY_REF, RECORD_NSID, SIGNATURE_TYPE,
  linkCid, publicFromDidKey, readJson, signedCid, unb64, verifyCid,
} from './lib.mjs';
import { projectCompletion, projectIntent } from './projection.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LEXICON_DIR = join(here, '..', 'lexicons', 'org', 'governedcrossing', 'temp');
const LEXICON_FILES = ['defs.json', 'crossingRecord.json', 'commitment.json'];

const STRONG_REF = {
  lexicon: 1,
  id: 'com.atproto.repo.strongRef',
  defs: {
    main: {
      type: 'object',
      required: ['uri', 'cid'],
      properties: { uri: { type: 'string', format: 'at-uri' }, cid: { type: 'string', format: 'cid' } },
    },
  },
};

const sha8 = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);

function loadLexicons() {
  const lex = new Lexicons();
  const docs = {};
  const digests = {};
  for (const file of LEXICON_FILES) {
    const text = readFileSync(join(LEXICON_DIR, file), 'utf8');
    digests[file] = sha8(text);
    docs[file] = JSON.parse(text);
    lex.add(docs[file]);
  }
  lex.add(STRONG_REF);
  return { lex, docs, digests };
}

const known = (def, field) => def.properties[field].knownValues;

export async function runChecks(folder) {
  const results = [];
  const add = (section, rule, ok, detail = '') => results.push({ section, rule, ok: Boolean(ok), detail });

  const run = readJson(join(folder, 'run.json'));
  const intent = readJson(join(folder, 'records', 'intent.json'));
  const completion = readJson(join(folder, 'records', 'completion.json'));
  const entry = readJson(join(folder, 'entry.json'));
  const oldIntent = readJson(join(folder, 'old-shape', 'intent.json'));
  const oldCompletion = readJson(join(folder, 'old-shape', 'completion.json'));
  const rehearsal = run.mode === 'rehearsal';
  const publicKey = rehearsal && existsSync(join(folder, 'rehearsal-key.json'))
    ? readJson(join(folder, 'rehearsal-key.json')).publicKey
    : KEY_PUBLIC_DIDKEY;
  const { lex, docs, digests } = loadLexicons();
  const recordDef = docs['crossingRecord.json'].defs.main.record;
  const defs = docs['defs.json'].defs;
  const pair = [['intent', intent], ['completion', completion]];

  // Lexicon validation
  for (const [name, rec] of pair) {
    try {
      lex.assertValidRecord(RECORD_NSID, jsonToLex(rec));
      add('Lexicon', `${name} validates against ${RECORD_NSID}`, true);
    } catch (e) {
      add('Lexicon', `${name} validates against ${RECORD_NSID}`, false, String(e?.message ?? e));
    }
  }

  // Section 1: values
  for (const [name, rec] of pair) {
    for (const field of ['recordType', 'governanceEvent', 'boundType', 'provenanceStatus']) {
      add('1 Values', `${name}.${field} is a registered value`, known(recordDef, field).includes(rec[field]), rec[field]);
    }
    if (rec.lineageAnchorType !== undefined) {
      add('1 Values', `${name}.lineageAnchorType is author-declared`, rec.lineageAnchorType === 'author-declared', rec.lineageAnchorType);
    }
    add('1 Values', `${name}.boundType is exposure-unbounded (a public AT Protocol write)`, rec.boundType === 'exposure-unbounded', rec.boundType);
  }
  const ci = intent.crossingIntent ?? {};
  for (const field of ['identityCustodyClass', 'crossingType', 'declaredBoundType', 'recallSemantics', 'gateResult']) {
    add('1 Values', `intent.crossingIntent.${field} is a registered value`, known(defs.crossingIntent, field).includes(ci[field]), ci[field]);
  }
  add('1 Values', 'completion.crossingCompletion.crossingOutcome is a registered value',
    known(defs.crossingCompletion, 'crossingOutcome').includes(completion.crossingCompletion?.crossingOutcome));
  add('1 Values', 'declaredBoundType equals boundType', ci.declaredBoundType === intent.boundType);

  // Section 2: required-when
  add('2 Required-when', 'intent carries crossingIntent and not crossingCompletion',
    intent.recordType === 'crossing-intent' && !!intent.crossingIntent && intent.crossingCompletion === undefined);
  add('2 Required-when', 'completion carries crossingCompletion and not crossingIntent',
    completion.recordType === 'crossing-completion' && !!completion.crossingCompletion && completion.crossingIntent === undefined);
  add('2 Required-when', 'completion carries chainReference', !!completion.chainReference);
  add('2 Required-when', 'chainDepth and lineageAnchorType accompany chainReference',
    Number.isInteger(completion.chainDepth) && typeof completion.lineageAnchorType === 'string');
  for (const [name, rec] of pair) {
    add('2 Required-when', `${name}: provenanceStatus is asserted, so no basis or supersededBy is required`,
      rec.provenanceStatus === 'asserted' && rec.provenanceStatusBasis === undefined && rec.supersededBy === undefined);
  }

  // Section 3: signatures
  for (const [name, rec] of pair) {
    const sigs = Array.isArray(rec.signatures) ? rec.signatures : [];
    const emitter = sigs.filter((s) => s.$type === SIGNATURE_TYPE && s.role === 'emitter');
    add('3 Signatures', `${name} carries exactly one emitter inline signature`, emitter.length === 1 && sigs.length === 1);
    const sig = emitter[0];
    if (!sig) continue;
    add('3 Signatures', `${name} signature key is ${KEY_REF}`, sig.key === KEY_REF, sig.key);
    add('3 Signatures', `${name}.emittedBy is ${EMITTER_DID} (the $sig.repository value)`, rec.emittedBy === EMITTER_DID, rec.emittedBy);
    let verified = false;
    let detail = '';
    try {
      const cid = await signedCid(rec, sig);
      verified = verifyCid(cid, unb64(sig.signature.$bytes), publicFromDidKey(publicKey));
      detail = `signed CID ${cid.toString()}`;
    } catch (e) {
      detail = String(e?.message ?? e);
    }
    add('3 Signatures', `${name} signature verifies (P-256, low-S)${rehearsal ? ' against the rehearsal key' : ''}`, verified, detail);
  }

  // Section 4: salt
  const salts = pair.map(([, rec]) => (rec.salt?.$bytes ? unb64(rec.salt.$bytes) : new Uint8Array()));
  pair.forEach(([name], i) => add('4 Salt', `${name} salt is at least 16 bytes`, salts[i].length >= 16, `${salts[i].length} bytes`));
  add('4 Salt', 'the two salts differ', Buffer.compare(Buffer.from(salts[0]), Buffer.from(salts[1])) !== 0);

  // Section 5: completion, and what is never published
  add('5 Completion', 'the crossing completed (run status)', run.status === 'completed', run.status);
  add('5 Completion', 'gate result is pass', ci.gateResult === 'pass');
  add('5 Completion', 'completion outcome is completed', completion.crossingCompletion?.crossingOutcome === 'completed');
  add('5 Completion', 'completion names the published entry',
    completion.crossingCompletion?.crossingTargetURI === entry.uri && completion.crossingCompletion?.crossingTargetCID === entry.cid);

  // Section 7: references
  const expectedLink = (await linkCid(intent)).toString();
  add('7 References', 'chainReference.recordId is the intent recordId', completion.chainReference?.recordId === intent.recordId);
  add('7 References', 'chainReference.cid is the intent link CID', completion.chainReference?.cid === expectedLink, expectedLink);
  add('7 References', 'recordIds are urn:uuid and distinct',
    /^urn:uuid:/.test(intent.recordId) && /^urn:uuid:/.test(completion.recordId) && intent.recordId !== completion.recordId);

  // Section 9: content
  const text = JSON.stringify([intent, completion]);
  const payload = entry.payload ?? {};
  add('9 Content', 'neither record contains the entry title or body',
    !!payload.title && !!payload.content && !text.includes(payload.title) && !text.includes(payload.content));

  // Projection: the signed records carry exactly what the prototype recorded
  const strip = ({ signatures, ...rest }) => rest;
  const reIntent = projectIntent(oldIntent, { recordId: intent.recordId, emittedBy: intent.emittedBy, salt: intent.salt?.$bytes });
  const reCompletion = await projectCompletion(oldCompletion, intent, {
    recordId: completion.recordId, emittedBy: completion.emittedBy, salt: completion.salt?.$bytes,
  });
  add('Projection', 'intent equals the projection of the stored old-shape intent', JSON.stringify(strip(intent)) === JSON.stringify(reIntent));
  add('Projection', 'completion equals the projection of the stored old-shape completion', JSON.stringify(strip(completion)) === JSON.stringify(reCompletion));

  const recordDigests = {
    intent: sha8(readFileSync(join(folder, 'records', 'intent.json'), 'utf8')),
    completion: sha8(readFileSync(join(folder, 'records', 'completion.json'), 'utf8')),
  };
  return {
    checkedAt: new Date().toISOString(),
    mode: run.mode,
    publishable: run.mode === 'live',
    pass: results.every((r) => r.ok),
    lexicons: digests,
    records: recordDigests,
    results,
  };
}

export function printChecks(report) {
  let section = '';
  for (const r of report.results) {
    if (r.section !== section) {
      section = r.section;
      console.log(`\n${section}`);
    }
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.rule}${!r.ok && r.detail ? `  [${r.detail}]` : ''}`);
  }
  const failed = report.results.filter((r) => !r.ok).length;
  console.log(`\n${report.results.length - failed} of ${report.results.length} checks passed.`);
  console.log(`Lexicons: ${Object.entries(report.lexicons).map(([f, d]) => `${f} ${d}`).join(', ')}`);
  console.log(`Records:  intent.json ${report.records.intent}, completion.json ${report.records.completion}`);
}
