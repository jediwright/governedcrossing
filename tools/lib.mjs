// Shared helpers for the governed crossing tools.
//
// Signing form: records are hashed in the AT Protocol data-model form. A bytes
// field is encoded as a CBOR byte string, as CONFORMANCE.md section 3 and the
// Attestation Specification describe. See tools/README.md for what this means
// for third-party verifiers.

import * as dagCbor from '@ipld/dag-cbor';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { base58btc } from 'multiformats/bases/base58';
import { p256 } from '@noble/curves/p256';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Fixed values
// ---------------------------------------------------------------------------

export const EMITTER_DID = 'did:plc:4xoefmmbsulm4xns3kbb6mnk';
export const KEY_REF = `${EMITTER_DID}#governedcrossing`;
export const KEY_PUBLIC_DIDKEY = 'did:key:zDnaesduRugYFLWk27M4eLDQTPvtXkR2LPvZYGAdKp9iDwHHk';
export const RECORD_NSID = 'org.governedcrossing.temp.crossingRecord';
export const SIGNATURE_TYPE = 'org.governedcrossing.temp.defs#signature';
export const PROTOTYPE_PIN = 'fb05ea1936e6b16b2d7e6519ccc6f9143895f982';
export const SALT_BYTES = 32;

export const ENTRY_TITLE = (utcDate) => `A governed crossing, recorded — ${utcDate}`;
export const ENTRY_BODY =
  'This entry was published on purpose from an access-controlled document to the public network, as a worked example. ' +
  'The document was created for this example. ' +
  'An intent record was written before publication, and a completion record is written only once publication succeeds. ' +
  'The record format and the rules for checking it are at https://governedcrossing.org. ' +
  'The format is a draft and may change.';
export const ENTRY_ACKNOWLEDGMENT =
  'I acknowledge that publishing this entry places it outside the access controls of the source document. ' +
  'A later request to remove it is a request, not a guarantee.';

// ---------------------------------------------------------------------------
// Arguments, paths, files
// ---------------------------------------------------------------------------

export function flag(name) {
  return process.argv.includes(`--${name}`);
}

export function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export function storeRoot() {
  return resolve(process.env.GC_STORE_DIR ?? join(homedir(), 'governedcrossing-store'));
}

/** The store must sit outside any git working tree. */
export function assertOutsideGit(dir) {
  let inside = false;
  try {
    const parent = existsSync(dir) ? dir : resolve(dir, '..');
    if (existsSync(parent)) {
      execFileSync('git', ['-C', parent, 'rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
      inside = true;
    }
  } catch {
    inside = false;
  }
  if (inside) throw new Error(`The store folder ${dir} is inside a git repository. Choose a folder outside any repository.`);
}

export function requireStoreFolder() {
  const dir = option('store', null);
  if (!dir) throw new Error('Pass --store <folder>, the crossing folder printed by the cross step.');
  const abs = resolve(dir);
  if (!existsSync(abs)) throw new Error(`Store folder not found: ${abs}`);
  return abs;
}

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function writeJson(path, value, { overwrite = false } = {}) {
  if (!overwrite && existsSync(path)) throw new Error(`Refusing to overwrite ${path}`);
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Minimal KEY=VALUE reader. Values are returned to the caller and never printed. */
export function readEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prototype pin
// ---------------------------------------------------------------------------

export function prototypeDir() {
  const dir = process.env.EMPLOYMENT_SEAM_DIR;
  if (!dir) throw new Error('Set EMPLOYMENT_SEAM_DIR to a clone of jediwright/employment-seam.');
  return resolve(dir);
}

/** Refuses unless the clone is at the pinned commit with a clean working tree. */
export function assertPrototypePinned() {
  const dir = prototypeDir();
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
  const head = git('rev-parse', 'HEAD');
  if (head !== PROTOTYPE_PIN) {
    throw new Error(`employment-seam is at ${head.slice(0, 7)}; this tool requires ${PROTOTYPE_PIN.slice(0, 7)}.`);
  }
  const dirty = git('status', '--porcelain');
  if (dirty !== '') {
    throw new Error(`employment-seam has uncommitted or untracked files:\n${dirty}\nClean the working tree and run again.`);
  }
  return { dir, head };
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

export const b64 = (bytes) => Buffer.from(bytes).toString('base64').replace(/=+$/, '');
export const unb64 = (text) => Uint8Array.from(Buffer.from(text, 'base64'));

/** JSON form to data-model form: {$bytes} becomes bytes, {$link} becomes a CID link. */
export function toDataModel(value) {
  if (Array.isArray(value)) return value.map(toDataModel);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '$bytes' && typeof value.$bytes === 'string') return unb64(value.$bytes);
    if (keys.length === 1 && keys[0] === '$link' && typeof value.$link === 'string') return CID.parse(value.$link);
    return Object.fromEntries(keys.map((k) => [k, toDataModel(value[k])]));
  }
  return value;
}

async function cidOfDataModel(obj) {
  return CID.createV1(dagCbor.code, await sha256.digest(dagCbor.encode(obj)));
}

/**
 * The CID an emitter signs (CONFORMANCE.md section 3): the record with
 * `signatures` removed and `$sig` inserted, where `$sig` is the signature
 * object without `signature` and `cid`, plus `repository` = the record's
 * `emittedBy`.
 */
export async function signedCid(recordJson, signatureObject) {
  const record = { ...recordJson };
  delete record.signatures;
  const sig = { ...signatureObject };
  delete sig.signature;
  delete sig.cid;
  sig.repository = recordJson.emittedBy;
  record.$sig = sig;
  return cidOfDataModel(toDataModel(record));
}

const LINK_CID_DROPPED = new Set(['signatures', 'provenanceStatus', 'provenanceStatusBasis', 'supersededBy']);

function stripTypeKeys(value) {
  if (Array.isArray(value)) return value.map(stripTypeKeys);
  if (value && typeof value === 'object' && !(value instanceof Uint8Array) && !CID.asCID(value)) {
    return Object.fromEntries(
      Object.entries(value).filter(([k]) => k !== '$type').map(([k, v]) => [k, stripTypeKeys(v)]),
    );
  }
  return value;
}

/**
 * The link CID used by chainReference (CONFORMANCE.md section 7): the record
 * with `signatures`, every `$type` key, and the three status fields removed,
 * and no `$sig`.
 */
export async function linkCid(recordJson) {
  const kept = Object.fromEntries(Object.entries(recordJson).filter(([k]) => !LINK_CID_DROPPED.has(k)));
  return cidOfDataModel(stripTypeKeys(toDataModel(kept)));
}

// ---------------------------------------------------------------------------
// Keys and signatures
// ---------------------------------------------------------------------------

const P256_PUB_PREFIX = [0x80, 0x24];
const P256_PRIV_PREFIX = [0x86, 0x26];

export function didKeyFromPublic(compressed) {
  return 'did:key:' + base58btc.encode(Uint8Array.from([...P256_PUB_PREFIX, ...compressed]));
}

export function publicFromDidKey(didKey) {
  const bytes = base58btc.decode(didKey.replace(/^did:key:/, ''));
  if (bytes[0] !== P256_PUB_PREFIX[0] || bytes[1] !== P256_PUB_PREFIX[1]) throw new Error('Not a P-256 did:key.');
  return bytes.slice(2);
}

/** Parses a multibase P-256 secret key (a string starting with z). */
export function parseSecretKey(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('z')) throw new Error('Expected a multibase secret key starting with z.');
  const bytes = base58btc.decode(trimmed);
  if (bytes.length === 34 && bytes[0] === P256_PRIV_PREFIX[0] && bytes[1] === P256_PRIV_PREFIX[1]) return bytes.slice(2);
  if (bytes.length === 32) return bytes;
  throw new Error('The value is not a P-256 secret key in multibase form.');
}

export function signCid(cid, secretKey) {
  return p256.sign(cid.bytes, secretKey, { lowS: true, prehash: true }).toCompactRawBytes();
}

export function verifyCid(cid, signatureBytes, publicKeyCompressed) {
  if (signatureBytes.length !== 64) return false;
  return p256.verify(signatureBytes, cid.bytes, publicKeyCompressed, { lowS: true, prehash: true });
}

/** Reads one line from the terminal without echoing it. Refuses when not a terminal. */
export function promptHidden(label) {
  return new Promise((resolvePrompt, rejectPrompt) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      rejectPrompt(new Error('The signing key is read from a terminal prompt only. Run this command in a terminal.'));
      return;
    }
    process.stderr.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const finish = (err) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stderr.write('\n');
      if (err) rejectPrompt(err);
      else resolvePrompt(value);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') return finish(new Error('Cancelled.'));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

export const utcDate = (d = new Date()) => d.toISOString().slice(0, 10);
