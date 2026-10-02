// Field mapping from the prototype's record shapes (employment-seam at the
// pinned commit) to org.governedcrossing.temp.crossingRecord.

import { RECORD_NSID, linkCid } from './lib.mjs';

const INTENT_FIELDS = [
  ['grantorDID', 'grantorDID'],
  ['targetDID', 'targetDID'],
  ['identityCustodyClass', 'identityCustodyClass'],
  ['sourceDocumentURI', 'sourceDocumentURI'],
  ['sourceDocumentCID', 'sourceDocumentCID'],
  ['authorizedContentDigest', 'authorizedContentDigest'],
  ['sourceLineage', 'sourceLineage'],
  ['targetLexicon', 'targetLexicon'],
  ['targetPDS', 'targetService'],
  ['crossingType', 'crossingType'],
  ['regimeAcknowledgment', 'regimeAcknowledgment'],
  ['declaredBoundType', 'declaredBoundType'],
  ['recallSemantics', 'recallSemantics'],
  ['crossingTimeoutHorizon', 'crossingTimeoutHorizon'],
  ['crossingGrantHorizon', 'crossingGrantHorizon'],
  ['grantReference', 'grantReference'],
  ['gateResult', 'gateResult'],
  ['gateCheckedAt', 'gateCheckedAt'],
];
const INTENT_TOP = ['recordType', 'governanceEvent', 'boundType', 'emittedAt', 'lineageAnchorType'];

const COMPLETION_FIELDS = [
  ['crossingTargetURI', 'crossingTargetURI'],
  ['crossingTargetCID', 'crossingTargetCID'],
  ['completedAt', 'completedAt'],
  ['pdsAcceptedAt', 'targetAcceptedAt'],
  ['relayIngestedAt', 'relayIngestedAt'],
  ['crossingOutcome', 'crossingOutcome'],
];
// crossingIntentRef is replaced by chainReference; the old value stays in the store.
const COMPLETION_TOP = ['recordType', 'governanceEvent', 'boundType', 'chainDepth', 'lineageAnchorType', 'crossingIntentRef'];

function unmapped(old, mapped, top) {
  const known = new Set([...mapped.map(([from]) => from), ...top]);
  return Object.keys(old).filter((k) => !known.has(k));
}

function pick(old, mapping) {
  const out = {};
  for (const [from, to] of mapping) {
    if (old[from] !== undefined && old[from] !== null) out[to] = old[from];
  }
  return out;
}

export function projectIntent(old, { recordId, emittedBy, salt }) {
  const extra = unmapped(old, INTENT_FIELDS, INTENT_TOP);
  if (extra.length) throw new Error(`old-shape intent has fields this tool does not map: ${extra.join(', ')}`);
  return {
    $type: RECORD_NSID,
    recordId,
    recordType: old.recordType,
    emittedAt: old.emittedAt,
    emittedBy,
    provenanceStatus: 'asserted',
    governanceEvent: old.governanceEvent,
    boundType: old.boundType,
    lineageAnchorType: old.lineageAnchorType,
    crossingIntent: pick(old, INTENT_FIELDS),
    salt: { $bytes: salt },
  };
}

export async function projectCompletion(old, intentRecord, { recordId, emittedBy, salt }) {
  const extra = unmapped(old, COMPLETION_FIELDS, COMPLETION_TOP);
  if (extra.length) throw new Error(`old-shape completion has fields this tool does not map: ${extra.join(', ')}`);
  return {
    $type: RECORD_NSID,
    recordId,
    recordType: old.recordType,
    // The prototype's completion has no emittedAt; its completedAt is the moment the record was written.
    emittedAt: old.completedAt,
    emittedBy,
    provenanceStatus: 'asserted',
    chainReference: { recordId: intentRecord.recordId, cid: (await linkCid(intentRecord)).toString() },
    chainDepth: old.chainDepth,
    lineageAnchorType: old.lineageAnchorType,
    governanceEvent: old.governanceEvent,
    boundType: old.boundType,
    crossingCompletion: pick(old, COMPLETION_FIELDS),
    salt: { $bytes: salt },
  };
}
