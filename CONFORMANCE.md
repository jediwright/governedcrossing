# Conformance

AT Protocol lexicons check shape. These rules cover what a shape cannot express. A record that passes lexicon validation but breaks one of these rules is valid AT Protocol and is **not** a conformant governed crossing record.

Status: draft, applying to the `org.governedcrossing.temp.*` lexicons.

## 1. Values

Controlled fields (`recordType`, `governanceEvent`, `boundType`, `provenanceStatus`, `lineageAnchorType`) are open lists in the lexicons. A conformant record uses only values registered for the `seam:CrossingRecord` vocabulary. `lineageAnchorType` values `witness-signed` and `timestamp-signed` are defined but not yet usable; `author-declared` is the current value.

`boundType` must match what the architecture can actually enforce. Claiming more control than exists is not permitted; claiming less is also an error.

## 2. Required-when rules

- `crossingIntent` is present if and only if `recordType` is `crossing-intent`; `crossingCompletion` if and only if it is `crossing-completion`.
- `provenanceStatusBasis` is present when `provenanceStatus` is not `asserted`.
- `supersededBy` is present when `provenanceStatus` is `superseded`.
- `chainDepth` and `lineageAnchorType` are present when `chainReference` is present.

## 3. Signatures

- Every conformant record carries its emitter's inline signature (`org.governedcrossing.temp.defs#signature`, `role: emitter`). The lexicon leaves `signatures` optional only because the Attestation Specification requires records to validate with or without signatures.
- Signatures follow the ATProtocol Attestation Specification v1.0: sign the CIDv1 (DAG-CBOR, sha2-256) of the record with `signatures` removed and a `$sig` object inserted. `$sig` is the signature object without its `signature` field, plus `repository`.
- `$sig.repository` is always the record's `emittedBy` DID, wherever the copy is housed. A full record re-hosted by someone else therefore fails verification by design; others should reference it, not copy it.
- Other parties may countersign with a `role` (`counterparty`, `institution`). Each signer signs the same record content under its own `$sig`, so each signer's CID is different.
- On private crossings, countersignatures are inline only. A remote proof in a countersigner's public repository would reveal that the crossing happened. Remote (`com.atproto.repo.strongRef`) countersignatures are for public crossings only.
- Countersignatures do not make a record witness-signed.
- Emitters are advised to sign with a dedicated verification method, so that rotating other keys does not orphan signatures.

## 4. Commitments

- A commitment (`org.governedcrossing.temp.commitment`) is published in the emitter's own repository for a private crossing that passed. It is a remote proof under the Attestation Specification: its `cid` is computed over the committed record with `$sig` set to the commitment record without `cid`, plus `repository` = the committed record's `emittedBy`. It is a different CID from the emitter's inline-signature CID.
- `commitment.emittedBy` equals the DID of the repository housing the commitment.
- Any record with a published commitment carries a random `salt` of at least 16 bytes, so that a predictable record cannot be confirmed by guessing.
- No commitment is published for a blocked crossing.

## 5. References between records

`chainReference` names the upstream record by `recordId` (the canonical record's own identifier, not an AT-URI of a copy) and by the CID of that record's emitter inline signature.

## 6. Access changes

A change in who can see data counts as a crossing only when it moves data into a different regime (for example, a permissioned space made public). Sharing inside the party's own system is not a crossing. Access-change crossings use `crossingMode: access-change`; the digest and target name the record that stayed in place.

## 7. Content

A record never contains the content that crossed; only digests and references.
