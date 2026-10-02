// Read-only. Fetches a published crossing record and checks it from the network:
// the emitter signature, against the key in the signer's DID document, and, for
// a completion, the link back to its intent.
//
//   npm run verify -- at://<did>/org.governedcrossing.temp.crossingRecord/<rkey>
//
// No sign-in. Uses the same encoding code as the other tools in this folder, so
// it is a way to reproduce the check, not an independent implementation.

import { base58btc } from 'multiformats/bases/base58';
import { p256 } from '@noble/curves/p256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { RECORD_NSID, SIGNATURE_TYPE, linkCid, signedCid, unb64 } from './lib.mjs';

const uri = process.argv[2];
const m = uri?.match(/^at:\/\/(did:[a-z]+:[^/]+)\/([^/]+)\/([^/]+)$/);
if (!m) {
  console.error('Usage: npm run verify -- at://<did>/<collection>/<record key>');
  process.exit(2);
}
const [, did, collection, rkey] = m;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function didDocument(id) {
  if (id.startsWith('did:plc:')) return getJson(`https://plc.directory/${id}`);
  if (id.startsWith('did:web:')) return getJson(`https://${id.slice(8).replace(/:/g, '/')}/.well-known/did.json`);
  throw new Error(`unsupported DID method: ${id}`);
}

function pdsOf(doc) {
  const svc = (doc.service ?? []).find((s) => s.type === 'AtprotoPersonalDataServer');
  if (!svc) throw new Error('the DID document names no PDS');
  return svc.serviceEndpoint.replace(/\/$/, '');
}

function keyFromDocument(doc, keyRef) {
  const fragment = `#${keyRef.split('#')[1]}`;
  const method = (doc.verificationMethod ?? []).find((v) => v.id === keyRef || v.id === fragment);
  if (!method) throw new Error(`verification method ${keyRef} is not in the DID document`);
  const bytes = base58btc.decode(method.publicKeyMultibase.replace(/^did:key:/, ''));
  if (bytes[0] === 0x80 && bytes[1] === 0x24) return { curve: p256, name: 'P-256', key: bytes.slice(2) };
  if (bytes[0] === 0xe7 && bytes[1] === 0x01) return { curve: secp256k1, name: 'K-256', key: bytes.slice(2) };
  throw new Error('unsupported key type');
}

let failed = false;
const say = (ok, text) => {
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${text}`);
};

const repoDoc = await didDocument(did);
const pds = pdsOf(repoDoc);
const got = await getJson(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=${collection}&rkey=${rkey}`);
const record = got.value;
console.log(`${uri}\n  record ${record.recordId}, ${record.recordType}, emitted by ${record.emittedBy}`);

say(collection === RECORD_NSID && record.$type === RECORD_NSID, `record type is ${RECORD_NSID}`);

const inline = (record.signatures ?? []).filter((s) => s.$type === SIGNATURE_TYPE);
say(inline.some((s) => s.role === 'emitter'), 'carries an emitter signature');
for (const sig of inline) {
  try {
    const signerDid = sig.key.split('#')[0];
    const { curve, name, key } = keyFromDocument(signerDid === did ? repoDoc : await didDocument(signerDid), sig.key);
    const cid = await signedCid(record, sig);
    const bytes = unb64(sig.signature.$bytes);
    const ok = bytes.length === 64 && curve.verify(bytes, cid.bytes, key, { lowS: true, prehash: true });
    say(ok, `${sig.role ?? 'unlabelled'} signature by ${sig.key} verifies (${name}; $sig.repository = ${record.emittedBy})`);
    if (sig.role === 'emitter') say(signerDid === record.emittedBy, 'the emitter signature is made by the emittedBy DID');
  } catch (e) {
    say(false, `signature by ${sig.key}: ${e.message}`);
  }
}

if (record.chainReference) {
  const list = await getJson(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=${collection}&limit=100`);
  const upstream = (list.records ?? []).find((r) => r.value?.recordId === record.chainReference.recordId);
  if (!upstream) {
    say(false, `upstream record ${record.chainReference.recordId} was not found in the same repository (first 100 records)`);
  } else {
    const cid = (await linkCid(upstream.value)).toString();
    say(cid === record.chainReference.cid, `chainReference matches ${upstream.uri} (${upstream.value.recordType})`);
  }
}

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
