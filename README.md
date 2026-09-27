# Governed Crossing

A governed crossing record is evidence that data crossed from a person's own system into shared infrastructure: what was authorized to cross, by whom, when, under what exposure claim, and where it landed. This repository holds the ways that record is written down (bindings), the rules a record must meet beyond its schema (conformance), and, in time, test vectors and a reference verifier.

The record's meaning is defined by the [`seam:CrossingRecord` vocabulary](https://github.com/jediwright/seam-stack/blob/main/vocab/crossing-record/0.1/schema.md) in [Seam Stack](https://github.com/jediwright/seam-stack). This repository does not redefine it; each binding maps onto it.

## Status

Draft. The first binding is a set of AT Protocol lexicons in the `org.governedcrossing.temp.*` namespace. Anything under `temp` may change without notice. Stable `org.governedcrossing.*` names will be published separately and will not be implied by use of the drafts.

## Principles

- **The record lives with the person.** The canonical copy of a crossing record stays on the emitting party's own system. AT Protocol carries copies of it, never its home.
- **A public copy discloses no more than the crossing did.** When a crossing is itself public, the full record may be published. When it is private, only a small commitment is published (a fingerprint of the record, who issued it, and when); the full record travels privately to the other party.
- **Blocked crossings leave no public trace.** A blocked crossing disclosed nothing, so nothing about it is published. The record of the block stays with the party.
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
```

## Relation to the vocabulary

The lexicons list every value currently registered for the vocabulary's controlled fields. The published vocabulary page lists an earlier subset and is being updated.

## License

MIT. See [LICENSE](LICENSE).

---

MIT License · Built with AI-collaborative methods · Intellectual direction and authorial responsibility: Jedi Wright · [Systems of Thought](https://www.systemsofthought.com/) · UX Minds, LLC
