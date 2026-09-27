# Conformance

AT Protocol lexicons check shape. These rules cover what a shape cannot express. A record that passes lexicon validation but breaks one of these rules is valid AT Protocol and is **not** a conformant governed crossing record.

Status: draft, applying to the `org.governedcrossing.temp.*` lexicons.

## 1. Values

Controlled fields (`recordType`, `governanceEvent`, `boundType`, `provenanceStatus`, `lineageAnchorType`) are open lists in the lexicons. A conformant record uses only values registered for the `seam:CrossingRecord` vocabulary. `lineageAnchorType` values `witness-signed` and `timestamp-signed` are defined but not yet usable; `author-declared` is the current value.

`boundType` must match what the architecture can actually enforce. Claiming more control than exists is not permitted; claiming less is also an error.

## 2. Required-when rules

- `crossingIntent` is present if and only if `recordType` is `crossing-intent`; `crossingCompletion` if and only if it is `crossing-completion`.
- A `crossing-completion` carries `chainReference` naming its `crossing-intent`.
- `provenanceStatusBasis` is present when `provenanceStatus` is not `asserted`.
- `supersededBy` is present when `provenanceStatus` is `superseded`.
- `chainDepth` and `lineageAnchorType` are present when `chainReference` is present.

## 3. Signatures

- Every conformant record carries its emitter's inline signature (`org.governedcrossing.temp.defs#signature`, `role: emitter`). The lexicon leaves `signatures` optional only because the Attestation Specification requires records to validate with or without signatures.
- Signatures follow the ATProtocol Attestation Specification v1.0: sign the CIDv1 (DAG-CBOR, sha2-256) of the record with `signatures` removed and a `$sig` object inserted. `$sig` is the signature object without its `signature` field, plus `repository`.
- This profile fixes `$sig.repository` to the record's `emittedBy` DID for every signature and proof, wherever the copy is housed. The specification uses the DID of the repository housing the record; the two are the same only for signatures on a public copy held in the emitter's own repository. Commitments, and signatures on the emitter's own copy or on a delivered copy, verify only when the verifier is given `emittedBy` as the repository DID. A standard verifier that takes the repository from where a copy is housed will reject them.
- This binds every signature to the emitter, not to a location. A copy housed anywhere verifies as emitted by `emittedBy`, and no copy can be passed off as another party's record. The profile does not prevent copying: a counterparty that publishes a privately delivered record publishes a verifiable record, because crossing records are deliberately non-repudiable. Others should reference records, not copy them.
- Other parties may countersign with a `role` (`counterparty`, `institution`). Every signer signs the same record content under its own `$sig`. For inline countersignatures, `key` and `role` enter the signed CID, so each inline signer's CID is different. Remote countersignatures whose proof records have the same type and fields share a CID and are told apart by their reference URI.
- On private crossings, countersignatures are inline only. A remote proof in a countersigner's public repository would reveal that the crossing happened. Remote (`com.atproto.repo.strongRef`) countersignatures are for public crossings only.
- No lexicon here yet defines a remote countersignature proof record. Until one does, a remote countersignature on a public crossing is a specification-conformant proof of another type, and its `role` is outside this vocabulary.
- Countersignatures do not make a record witness-signed.
- Emitters are advised to sign with a dedicated verification method, so that rotating other keys does not orphan signatures.

## 4. Salt

Every conformant record carries `salt`: at least 16 bytes, generated fresh at random for each record at emission and never reused. The salt keeps a predictable record, or a reference to one, from being confirmed by guessing. Reuse cannot be detected by third parties; a reused salt lets any counterparty that received one record confirm guesses about the emitter's other records.

## 5. Completion, and what is never published

- A `crossing-completion` must be emitted whenever the emitter observes that the crossing act succeeded, including after `crossingTimeoutHorizon` or after recovering from a failure.
- A substrate crossing did not complete if its act had not been observed to succeed by its `crossingTimeoutHorizon`. A later completion changes that: the crossing is then complete.
- No record of a substrate crossing that did not complete is published in any form: no commitment and no projection, on private or public crossings.
- No record of a blocked gate check is published in any form, whatever its record type. It stays on the emitter's own system and may be delivered privately to the counterparty.

## 6. Commitments

- For a completed private substrate crossing, the emitter may publish a commitment (`org.governedcrossing.temp.commitment`) to the `crossing-completion` in its own repository, after the completion is emitted. Commitments are optional and make no claim that every crossing is committed. No commitment is made to a `crossing-intent`, and none yet for other record types.
- A commitment is a remote proof under the Attestation Specification with this profile's repository rule (§3): its `cid` is computed over the committed record with `signatures` removed and `$sig` set to the commitment record without `cid`, plus `repository` = the committed record's `emittedBy`. It is a different CID from the emitter's inline-signature CID.
- `commitment.emittedBy` equals the DID of the repository housing the commitment.

## 7. References between records

`chainReference` names the upstream record by `recordId` (the canonical record's own identifier, not an AT-URI of a copy) and by its link CID: the CIDv1 (DAG-CBOR, sha2-256) of the record with `signatures`, every `$type` key at any depth, `provenanceStatus`, `provenanceStatusBasis` and `supersededBy` removed, and no `$sig` inserted. The link CID is a content address, not a signature or proof, and is never verified as one. Re-signing, key rotation, additional signatures, namespace changes and status changes leave it unchanged.

## 8. Access changes

A change in who can see data, where the data itself does not move, is not yet covered by these lexicons. A design for recording it is in progress. Until it is published, an access change is not recorded with `crossing-intent` and `crossing-completion` records, which describe data that moves.

## 9. Content

A record never contains the content that crossed; only digests and references.

## Known limits

- Records of crossings that did not complete, and of blocked gate checks, can be shown only to parties the emitter gives them to. Their existence, their timing (author-declared) and whether the emitter's set of them is complete cannot be checked by anyone else. The public record shows only the completed crossings the emitter chose to publish or commit, so a gate that blocks and a gate that never blocks look the same from outside.
- Without a public anchor, the timing of those records, and of completed private crossings that were not committed, rests on author-declared time alone.
- An act can succeed without the emitter observing it, for example a write that landed after a timeout. A missing completion is not evidence that nothing crossed. Third parties cannot tell from an emitter's public records whether it failed to emit a completion it owed.
- Signatures and commitments cover a record including its status fields, so they verify against the version that was signed or committed. Holders keep that version.
- Where a crossing attempt is public by other means, the absence of a record reads as no response.
- Private governed crossings of record types other than substrate crossings have no public commitment yet.
- Access changes are not yet recordable (§8).
