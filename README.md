# Governed Crossing

A governed crossing record is evidence that data crossed from a person's own system into shared infrastructure: what was authorized to cross, by whom, when, under what exposure claim, and where it landed. This repository holds the ways that record is written down (bindings), the rules a record must meet beyond its schema (conformance), and, in time, test vectors and a reference verifier.

The record's meaning is defined by the [`seam:CrossingRecord` vocabulary](https://github.com/jediwright/seam-stack/blob/main/vocab/crossing-record/0.1/schema.md) in [Seam Stack](https://github.com/jediwright/seam-stack). This repository does not redefine it; each binding maps onto it.

## Status

Draft. The first binding is a set of AT Protocol lexicons in the `org.governedcrossing.temp.*` namespace. Anything under `temp` may change without notice. Stable `org.governedcrossing.*` names will be published separately and will not be implied by use of the drafts.

Open for feedback: [`drafts/access-change.md`](drafts/access-change.md), a draft for recording access changes. Files in `drafts/` are not part of the specification.

## Live examples

One public crossing, recorded as an intent and a completion. Published 2 October 2026 (UTC) from a project test account.

| | AT-URI |
|---|---|
| The entry that crossed | `at://did:plc:4xoefmmbsulm4xns3kbb6mnk/com.whtwnd.blog.entry/3mwucfb56cu2n` |
| Intent | `at://did:plc:4xoefmmbsulm4xns3kbb6mnk/org.governedcrossing.temp.crossingRecord/3mwuctw3bov2g` |
| Completion | `at://did:plc:4xoefmmbsulm4xns3kbb6mnk/org.governedcrossing.temp.crossingRecord/3mwuctwkdx62t` |

The intent was written before the entry was published. The completion was written after the publish succeeded, and links back to the intent. The published records are copies; the signed originals stay on the emitter's own system.

**Check them yourself**

1. Open either record in any PDS browser, or fetch it with `com.atproto.repo.getRecord`.
2. In the completion, `chainReference.recordId` is the intent's `recordId`, and `chainReference.cid` is the intent's link CID ([`CONFORMANCE.md`](CONFORMANCE.md) section 7).
3. Run `npm ci` in [`tools/`](tools/), then `npm run verify -- <AT-URI>`. It verifies the emitter signature against the key in the DID document and checks the link.

**What has and has not been verified**

The signatures follow the ATProtocol Attestation Specification v1.0 and `CONFORMANCE.md` section 3. They verify with the code in `tools/`, which is this project's own code. The one independent tool we know of, `atproto-attestation-verify` 0.14.5, rejects them: it hashes a `bytes` field as JSON text where the specification and the AT Protocol data model use a CBOR byte string, and every record here carries a `bytes` salt. That tool is by the specification's author, and the difference is being reported to its author. No independent tool currently accepts these signatures.

The host accepted both records without validating them: it does not resolve published lexicons and reported the validation status as `unknown`. The records were validated against the lexicons in this repository before they were published.

**Notes**

- Made against the lexicons at commit `cef92b4`. The `temp` lexicons are drafts. When they change, a new pair will be added and this one marked superseded; it will not be deleted.
- The entry's title carries the emitter's local date, 1 October. Record timestamps are UTC.
- The crossing ran on prototype code from [`jediwright/employment-seam`](https://github.com/jediwright/employment-seam) at commit `fb05ea1`. The `keyhive:` and `automerge:` values in the intent name the software that held the source document.
- The account is hosted, so the intent declares `identityCustodyClass: provider-custodied`.

## Principles

- **The record lives with the person.** The canonical copy of a crossing record stays on the emitting party's own system. AT Protocol carries copies of it, never its home.
- **A public copy discloses no more than the crossing did.** When a crossing is itself public, the full record may be published. When it is private, at most a small commitment is published (a fingerprint of the record, who issued it, and when); the full record travels privately to the other party.
- **Crossings that did not go through leave no public trace.** Nothing is published about a blocked crossing, or about one whose act the emitter has not seen succeed. The record stays with the party.
- **Records are signed and non-repudiable.** Every record carries its emitter's signature, following the [ATProtocol Attestation Specification v1.0](https://tangled.org/strings/ngerakines.me/3m3fy2xuahc22). This is a deliberate difference from permissioned spaces, which are designed to be deniable.
- **Records describe what crossed; they never contain it.** A record carries digests and references only.
- **Exposure claims are upper bounds.** Once data crosses into a globally indexed system, nobody can promise it will not be copied. Records say so (`exposure-unbounded`) instead of claiming more control than exists.

## Layout

```
lexicons/org/governedcrossing/temp/
  crossingRecord.json   one record type for all crossing records; recordType tells them apart
  commitment.json       the public commitment to a privately held record
  defs.json             signature type, record references, crossing extensions
CONFORMANCE.md          rules a record must meet that a lexicon cannot express
tools/                  scripts that produced, checked and published the live examples
```

## Relation to the vocabulary

The lexicons list every value currently registered for the vocabulary's controlled fields. The published vocabulary page lists an earlier subset and is being updated.

## License

MIT. See [LICENSE](https://github.com/jediwright/governedcrossing/blob/main/LICENSE).

---

MIT License · Built with AI-collaborative methods · Intellectual direction and authorial responsibility: Jedi Wright · [Systems of Thought](https://www.systemsofthought.com/) · UX Minds, LLC
