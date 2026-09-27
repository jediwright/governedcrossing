# Governed Crossing — Recording Access Changes: Draft for Feedback

> **Draft for feedback. This is not the specification.** The live lexicons ([`crossingRecord.json`](../lexicons/org/governedcrossing/temp/crossingRecord.json), [`commitment.json`](../lexicons/org/governedcrossing/temp/commitment.json), [`defs.json`](../lexicons/org/governedcrossing/temp/defs.json)) and [`CONFORMANCE.md`](../CONFORMANCE.md) are the only normative text. Nothing in this file is part of them. This draft may change, or be withdrawn, as a result of feedback.

**Design status**

- **What this is.** A proposed design for recording a change in who can see or act on data where the data itself does not move (an access change): new lexicon definitions and properties (Appendix A) and new conformance wording (Appendix B). It is written against the repository as of [`b5723e3`](https://github.com/jediwright/governedcrossing/tree/b5723e3dcf9940bd9ff6b352870e1ce934aa7bac).
- **Review so far.** Internal review only; no independent review. Four points have had no review at all: Q1 to Q4 below. Q5 rests on a reading of another project's source code that has not been tested at runtime.
- **Before adoption it waits on** two things: this feedback window, and registration of its new values in the vocabulary (see the [README](../README.md#relation-to-the-vocabulary)). After that, this file is either replaced by adopted text in the lexicons and `CONFORMANCE.md`, or marked withdrawn here. It will not be deleted without notice.
- **Feedback window.** Open until **Monday 26 October 2026, end of day US Eastern**. The window may be extended if people ask for more time; it will not be shortened. Prepared 2026-09-27.
- **Changed after posting.** 2026-09-27: Q5's first point was narrowed. It now says the person giving access must already hold the group on their own system, and that the document's key reaches only the group's members whose prekeys they hold, not necessarily every member. No other text changed.

**Open questions**

Respond in the repository's [Discussions](https://github.com/jediwright/governedcrossing/discussions), in the thread "Feedback: recording access changes (draft)". Refer to questions by number. Each is set out in full in §4.

1. **Q1.** Is the emitter's own agent grant, taken alone, the right test of who counts as its agent?
2. **Q2.** Should one value, `access-change-observed`, carry two meanings, told apart by `actorRelation`, or should a gated change that diverged get its own value?
3. **Q3.** Should a gated change that produced something other than what the gate authorized be allowed a public commitment?
4. **Q4.** Is the last sentence of live `CONFORMANCE.md` line 66 accurate and clear?
5. **Q5 (optional).** Does a grantee giving a whole group access to a document read as an access change, and to what?

---

## 1. What this is

A governed crossing record is evidence that data crossed from a person's own system into shared infrastructure. The live conformance rules ([`CONFORMANCE.md`](../CONFORMANCE.md)) say, in §8, that a change in **who can see data, where the data itself does not move**, is not yet covered, and that a design for recording it is in progress.

This file is that design, in draft:

- five new definitions in `org.governedcrossing.temp.defs` and two new properties in `org.governedcrossing.temp.crossingRecord` (Appendix A);
- three edits to existing lexicon descriptions (Appendix A);
- new and replacement wording for `CONFORMANCE.md` (Appendix B).

At the lexicon level the change is additive: no existing field or value changes. At the conformance level one existing rule changes: `gateCheck` becomes required on the existing `gate-check` record type. The new values (`access-change` as a `recordType`; `access-change` and `access-change-observed` as a `governanceEvent`) validate today, because the value lists are open, but they will not conform until they are registered in the vocabulary.

## 2. How to respond

- **Written:** the repository's [Discussions](https://github.com/jediwright/governedcrossing/discussions), thread "Feedback: recording access changes (draft)". This is the record of responses.
- **Forum:** a short post in the Lexicon Community category of the AT Protocol community forum points here. Replies there are just as welcome, and are kept together with the responses in the Discussion.
- **Live:** the Lexicon Community call, **Thursday 1 October 2026, 1 PM ET**. If the draft comes up on the call, a summary will be posted in the Discussion thread afterward, so it is on record. If the summary gets you wrong, correct it there.
- Refer to questions by number (Q1 to Q5). Answer any subset. One-line answers are welcome, and so is "this is fine as written".
- Comments on anything else in the appendices are welcome too. Please say which section they concern.

**What happens to responses.** Every response is logged with its date, channel, your public handle, and the response verbatim or linked. Nothing is decided during the window, and questions are not settled one by one in the thread. After the window closes, the responses are weighed before any of this text is adopted. Responses may be quoted with attribution to your public handle. If you would rather not be quoted, say so in your response.

## 3. The model in brief

- **`gate-check` record.** One per gate invocation outside a substrate crossing, pass or block. It records who invoked the gate, under which grant, for which capability, when, and with what result. For an access change it also binds the change the gate authorized and a time by which the emitter expects to see it in effect, and it must be emitted before the change is made. A `gate-check` record is never published or committed.
- **`access-change` record.** The emitter's own observation of a change in effect: the subject (which keeps its address), the regime before and after as observed, when it was observed, and who made it (`actorRelation`: `emitter-gated`, `emitter-ungated` or `other-party`).
- **Regime.** Four properties: who can read (`readers`), whether it is pushed to services that serve anyone (`indexing`), what removing access can do (`revocation`), and who can verify authorship (`integrity`). Every access change is recorded, whether or not the regime changes.
- **`governanceEvent`.** `access-change` for a change that went through the emitter's gate with the regimes the gate authorized; `access-change-observed` otherwise (Q2).
- **Publication.** An access change is public when either regime has `readers: unbounded`. For a public change the emitter may publish the `access-change` record, without identity or grant fields. For a private change the emitter may publish at most a commitment, and only to an `emitter-gated` record whose `governanceEvent` is `access-change` (Q3).

## 4. Questions

### Q1 · Who counts as the emitter's agent

An emitter must record a change made around its own gate by itself or by its agent. A change made by anyone else may be recorded, but need not be. The draft wording:

> - An emitter that observes a change made without going through its gate, by itself or by its agent, must record it as an `access-change` record with `actorRelation: emitter-ungated`. An agent is a non-human actor (for example an AI model or automated system) to which the emitter issued a grant to act as its agent. It stays the emitter's agent while it holds any grant from the emitter, counting a revoked grant until the revocation takes effect on the path the actor used. A change counts if it was made while the actor was the emitter's agent; the time the emitter observes the change is used only where the time of the change is unknown. The emitter answers for its agent's changes whether or not a grant permitted them. A person or organization holding a grant from the emitter, including one who represents it, is not its agent.

In the draft, **the emitter's own grant is the only test.** An actor is the emitter's agent only if the emitter itself issued it a grant to act as its agent. It follows that:

- an automated system acting under a grant from someone who represents the emitter, rather than from the emitter, is not the emitter's agent, so a change it makes around the gate is `other-party` and its recording is optional;
- a person or organization is never the emitter's agent, whatever grant it holds, including a representative;
- once an actor is an agent, it stays one while it holds any grant from the emitter, so revoking only its agent grant does not end the duty.

The draft does not follow responsibility through a representative to the systems the representative appoints. It also discloses that none of this can be checked from outside:

> - Whether a party is the emitter's agent, and whether it was one when the change was made, is the emitter's own statement. For an emitter that is an organization, which changes its people make count as its own is also its statement. No record shows any of these, so the scope of the emitter's duty to record changes made without its gate cannot be checked from outside.

**Asked:** Is the emitter's own agent grant the right test, taken alone? In systems you know, do automated actors act for a party without a grant from that party, for example under a grant from an administrator or a service, and should the duty to record reach them?

### Q2 · One value, `access-change-observed`, with two meanings

The draft rule:

> - On an `access-change` record, `governanceEvent` is `access-change` when `actorRelation` is `emitter-gated` and the regimes observed are those the gate authorized, and `access-change-observed` otherwise.

So `access-change-observed` covers two different situations:

1. a change the emitter's own gate did not pass, made around the gate by the emitter or its agent (`emitter-ungated`) or by someone else (`other-party`);
2. a change that did go through the emitter's gate, where the regimes observed differ from those the gate authorized. Here the record stays `emitter-gated`: the act was gated, but the difference was not.

A reader tells them apart by `actorRelation`. The draft discloses what the second case does not show:

> - A published record with `actorRelation: emitter-gated` and `governanceEvent: access-change-observed` went through the gate, but the regimes observed differ from those the gate authorized. It does not show which regimes were authorized.

**Asked:** Is one value with two meanings workable for people and services reading these records, with `actorRelation` doing the disambiguation? Or should the second case have its own value?

### Q3 · Gated changes that diverge, and the public record

For a private access change, a commitment may be made only to an `emitter-gated` record whose `governanceEvent` is `access-change`. The ground is that a commitment attests the emitter's record of its own governed act. A gated change whose observed regimes differ from those authorized is therefore never committed, since the difference was not governed. The draft adds this to the last Known limit:

> - The public record shows only the access-change records the emitter chose to publish and the commitments it chose to make, and a private access change can be committed only if it went through the emitter's gate with the regimes it authorized. Changes made without the gate, by the emitter or its agent, gated changes whose regimes differ from those authorized, and changes the emitter observed others make, can always be kept out of the public record: when private they are never committed, and when public their publication is optional. An emitter with such changes and one without look the same.

**Asked:** Is it right that a gated change which produced something other than what the gate authorized can never be committed? Would you rather an emitter be able to commit to it, so that divergence can appear in the public record? Is the Known limit clear about the consequence?

### Q4 · Live text: `CONFORMANCE.md` line 66

This wording is **already published** in the Known limits ([line 66 at `b5723e3`](https://github.com/jediwright/governedcrossing/blob/b5723e3dcf9940bd9ff6b352870e1ce934aa7bac/CONFORMANCE.md#L66)). It has not been reviewed:

> An act can succeed without the emitter observing it, for example a write that landed after a timeout. A missing completion is not evidence that nothing crossed. Third parties cannot tell from an emitter's public records whether it failed to emit a completion it owed.

**Asked:** Is the last sentence accurate and clear as you read it? It is meant to say that nothing in an emitter's public records lets anyone else detect a completion record that the emitter should have emitted and did not. If it reads otherwise to you, or you can suggest better wording, please say so.

### Q5 · Optional: a grantee giving a whole group access to a document

This concerns **Keyhive core at revision [`9a8c1d56`](https://github.com/inkandswitch/keyhive/tree/9a8c1d5623753565175bd51f63efd55b7c7aa431)** (`inkandswitch/keyhive`, `keyhive_core` 0.6.0, 2026-09-26). On our reading of the source at that revision, not yet tested at runtime:

- someone with access to a document at a given level can give a whole group up to that level on the document, without being a member of the group, provided their own system already holds the group (knowing its identifier is not enough). At Read or above, the document's key then goes to those of the group's members whose prekeys (published key-exchange keys) that system holds, which need not be every member;
- similarly, a member of a group can add another member at up to its own level.

Under the draft, the first is an access change on the document (`granularity: document`). The set of readers widens but stays bounded, so the regimes do not differ, as when a member is added to a group. The change is still recorded. If it was done by a person holding a grant from the document's owner, the owner's record would be `other-party`, and recording it is optional.

**Asked:** Does a grantee pushing a document into a group read to you as an access change? If so, is it the document's access that changed, the group's, or both? And is optional recording by the document's owner the right place to leave it?

---

## Appendix A · Draft lexicon additions

These additions sit on top of the live `defs.json` and `crossingRecord.json` at [`b5723e3`](https://github.com/jediwright/governedcrossing/tree/b5723e3dcf9940bd9ff6b352870e1ce934aa7bac/lexicons/org/governedcrossing/temp). No existing field or value changes.

### A.1 `org.governedcrossing.temp.defs`: five new definitions

Entries to add under `defs`:

```json
"gateCheck": {
    "type": "object",
    "description": "Instance extension for recordType gate-check (governanceEvent gate-check). One record per gate invocation outside a substrate crossing, pass or block; a substrate crossing's gate is recorded in its crossing-intent. Records what the gate checked; says nothing about whether any act that followed took effect. A gate-check record is not published or committed.",
    "required": [
      "actorDID",
      "grantReference",
      "capability",
      "gateCheckedAt",
      "gateResult"
    ],
    "properties": {
      "actorDID": {
        "type": "string",
        "format": "did",
        "description": "Party whose invocation was checked. May differ from emittedBy (for example an agent acting under a grant)."
      },
      "grantReference": {
        "type": "string",
        "maxLength": 1024,
        "description": "Grant the invocation was checked against. Required so the responsible grantor is resolvable from the record."
      },
      "capability": {
        "type": "string",
        "maxLength": 256,
        "description": "Capability checked."
      },
      "gateCheckedAt": {
        "type": "string",
        "format": "datetime"
      },
      "gateResult": {
        "type": "string",
        "knownValues": [
          "pass",
          "blocked"
        ],
        "maxLength": 32,
        "description": "A record of a blocked gate check is never published in any form."
      },
      "blockBasis": {
        "type": "string",
        "maxLength": 1000,
        "maxGraphemes": 300,
        "description": "Required when gateResult is blocked: the condition that caused the block (for example a revocation state reference)."
      },
      "subject": {
        "type": "ref",
        "ref": "#subjectRef",
        "description": "What the invocation applies to. Required when authorizedChange is present."
      },
      "authorizedChange": {
        "type": "ref",
        "ref": "#regimeChange",
        "description": "Present when the invocation is an access change: the change the gate authorized."
      },
      "actTimeoutHorizon": {
        "type": "string",
        "format": "datetime",
        "description": "Required when authorizedChange is present: the time by which the emitter expects to observe the change in effect."
      }
    }
  },
  "accessChange": {
    "type": "object",
    "description": "Instance extension for recordType access-change. Records an observed change in who can read a subject, or who holds a capability over it, where the subject stays at the same address. Nothing is written to a new location. governanceEvent is access-change when actorRelation is emitter-gated and the regimes observed are those the gate authorized, and access-change-observed otherwise.",
    "required": [
      "subject",
      "regimeBefore",
      "regimeAfter",
      "observedAt",
      "actorRelation"
    ],
    "properties": {
      "subject": {
        "type": "ref",
        "ref": "#subjectRef"
      },
      "regimeBefore": {
        "type": "ref",
        "ref": "#regime"
      },
      "regimeAfter": {
        "type": "ref",
        "ref": "#regime",
        "description": "The regime observed in effect, which may differ from the one authorized."
      },
      "observedAt": {
        "type": "string",
        "format": "datetime",
        "description": "When the emitter observed the change in effect."
      },
      "actorRelation": {
        "type": "string",
        "knownValues": [
          "emitter-gated",
          "emitter-ungated",
          "other-party"
        ],
        "maxLength": 32,
        "description": "emitter-gated: the act went through the emitter's own gate, and chainReference names that gate-check record, including when the regimes observed differ from those authorized. emitter-ungated: the emitter, or its agent, made the change without going through the emitter's gate. An agent is a non-human actor (for example an AI model or automated system) to which the emitter issued a grant to act as its agent. It stays the emitter's agent while it holds any grant from the emitter, counting a revoked grant until the revocation takes effect on the path the actor used. A change counts if it was made while the actor was the emitter's agent; the time the emitter observes the change is used only where the time of the change is unknown. The emitter answers for its agent's changes whether or not a grant permitted them. A person or organization holding a grant from the emitter, including one who represents it, is not its agent. other-party: someone other than the emitter and its agents made the change, and the emitter observed it."
      },
      "actorDID": {
        "type": "string",
        "format": "did",
        "description": "Who made the change, when known. Absent when either regime has readers unbounded."
      },
      "capability": {
        "type": "string",
        "maxLength": 256,
        "description": "The capability whose holders changed, when the change is to a capability other than reading (for example writing)."
      },
      "grantAction": {
        "type": "string",
        "knownValues": [
          "issued",
          "amended",
          "revoked"
        ],
        "maxLength": 32,
        "description": "When the change is a grant change. Absent when either regime has readers unbounded."
      },
      "affectedGrant": {
        "type": "string",
        "maxLength": 1024,
        "description": "Absent when either regime has readers unbounded."
      },
      "affectedPartyDID": {
        "type": "string",
        "format": "did",
        "description": "Absent when either regime has readers unbounded."
      }
    }
  },
  "subjectRef": {
    "type": "object",
    "description": "What an access change or gate check applies to. The subject stays where it is; only who can see or act on it changes.",
    "required": [
      "uri",
      "granularity"
    ],
    "properties": {
      "uri": {
        "type": "string",
        "format": "uri",
        "maxLength": 2048,
        "description": "The subject's address, the same under both regimes (an at:// URI, a space URI, or a local document or group URI). A change that gives the subject a new address is not an access change."
      },
      "cid": {
        "type": "string",
        "maxLength": 4096,
        "description": "Content address or heads of the subject when this record is emitted (at the gate check, or at observation). Required when granularity is record or document."
      },
      "granularity": {
        "type": "string",
        "knownValues": [
          "record",
          "collection",
          "space",
          "document",
          "group"
        ],
        "maxLength": 32
      }
    }
  },
  "regime": {
    "type": "object",
    "description": "An access regime, described by four properties. Two regimes differ when any of the four differs. The service that enforces the regime is not one of the four: moving to another host under the same properties is not a regime change.",
    "required": [
      "readers",
      "indexing",
      "revocation",
      "integrity"
    ],
    "properties": {
      "readers": {
        "type": "string",
        "knownValues": [
          "bounded",
          "unbounded"
        ],
        "maxLength": 32,
        "description": "bounded: an enumerable set of parties can read. unbounded: anyone can read."
      },
      "indexing": {
        "type": "string",
        "knownValues": [
          "none",
          "global"
        ],
        "maxLength": 32,
        "description": "none: not pushed without a request to relays, indexers or other services that serve anyone. A regime that delivers only to its own bounded set of readers, requested or not, is none. global: pushed without a request to relays, indexers or other services that serve anyone (for example through a firehose); allowed only with readers unbounded."
      },
      "revocation": {
        "type": "string",
        "knownValues": [
          "enforced-stream-close",
          "propagated-request",
          "none"
        ],
        "maxLength": 64,
        "description": "What removing access can do under this regime, including to copies made while it applied. The values share their names with recallSemantics on a crossing intent; their meaning for this field is its own and is registered separately."
      },
      "integrity": {
        "type": "string",
        "knownValues": [
          "signed",
          "deniable",
          "local"
        ],
        "maxLength": 32,
        "description": "Who can verify the subject's authorship. signed: anyone holding a copy. deniable: authorized readers, but not other holders of a copy. local: no reader; only the substrate holding it."
      },
      "service": {
        "type": "string",
        "format": "uri",
        "maxLength": 2048,
        "description": "Service that enforces the regime, if any. Informational."
      }
    }
  },
  "regimeChange": {
    "type": "object",
    "description": "The access change a gate check authorizes, bound at the gate.",
    "required": [
      "regimeBefore",
      "regimeAfter"
    ],
    "properties": {
      "regimeBefore": {
        "type": "ref",
        "ref": "#regime"
      },
      "regimeAfter": {
        "type": "ref",
        "ref": "#regime"
      },
      "regimeAcknowledgment": {
        "type": "string",
        "maxLength": 3000,
        "maxGraphemes": 1000,
        "description": "Declared acknowledgment of the regime change. Required when the two regimes differ; the gate checks presence, not authorship."
      }
    }
  }
```

### A.2 `org.governedcrossing.temp.crossingRecord`: two new properties (after `crossingCompletion`)

```json
"gateCheck": {
  "type": "ref",
  "ref": "org.governedcrossing.temp.defs#gateCheck",
  "description": "Required when recordType is gate-check."
},
"accessChange": {
  "type": "ref",
  "ref": "org.governedcrossing.temp.defs#accessChange",
  "description": "Required when recordType is access-change."
}
```

### A.3 Description edits (applied only when the text is adopted)

- **`crossingRecord` main.** Replace "Published publicly only when the crossing itself was public and, for a substrate crossing, only once it completed; records of blocked gate checks are never published." with:
  > "Published publicly only when the crossing itself was public and, for a substrate crossing, only once it completed, or for an access change, only once the change was observed in effect; records of blocked gate checks, and gate-check records, are never published."
- **`commitment` main.** Keep the first sentence ("DRAFT in the temp namespace; may change without notice."). Replace "Optional public commitment to the crossing-completion of a completed private substrate crossing, published in the emitter's own repository." with:
  > "Optional public commitment, published in the emitter's own repository, to the crossing-completion of a completed private substrate crossing or to an emitter-gated access-change record, with governanceEvent access-change, of a private access change."

  Replace its last sentence with:
  > "Never published for a crossing that did not complete, for a crossing-intent, for a gate-check record, for an access change not observed in effect, or for a blocked gate check."
- **`defs` main.** Add "gate checks, access changes," after "record references,".

### A.4 Values held until registration

- `recordType` `knownValues` gains `access-change`.
- `governanceEvent` `knownValues` gains `access-change` and `access-change-observed`.
- Until these are registered in the vocabulary, the values validate (the lists are open) but do not conform (`CONFORMANCE.md` §1).

## Appendix B · Draft conformance wording

Drafts against the live [`CONFORMANCE.md`](https://github.com/jediwright/governedcrossing/blob/b5723e3dcf9940bd9ff6b352870e1ce934aa7bac/CONFORMANCE.md). Section numbers refer to that file.

**§1 Values: add at the end.**
> Fields inside `gateCheck` and `accessChange` that list values (`granularity`, `readers`, `indexing`, `revocation`, `integrity`, `actorRelation`, `grantAction`, `gateResult`) are drafts. They may change before the lexicons leave `temp`.

**§2 Required-when rules: add.**
> - `gateCheck` is present if and only if `recordType` is `gate-check`; `accessChange` if and only if it is `access-change`.
> - `blockBasis` is present when `gateResult` is `blocked`.
> - `subject` and `actTimeoutHorizon` are present when `authorizedChange` is present. `regimeAcknowledgment` is present when the authorized change's two regimes differ.
> - `subject.cid` is present when `granularity` is `record` or `document`.
> - `subject.uri` is the subject's address under both regimes. A change that gives the subject a new address is not an access change.
> - A regime with `indexing: global` has `readers: unbounded`.
> - On an `access-change` record, `governanceEvent` is `access-change` when `actorRelation` is `emitter-gated` and the regimes observed are those the gate authorized, and `access-change-observed` otherwise.
> - An `access-change` record with `actorRelation: emitter-gated` carries `chainReference` naming the `gate-check` record that authorized it, with `chainDepth` 1 and `lineageAnchorType` `author-declared`. The `gate-check` record carries no `chainReference`. Its `subject` has the same `uri` as the gate-check's. The `cid` values may differ, since each records the subject when its record was emitted.

**§5 Completion, and what is never published: add after the substrate-crossing bullets.**
> - An access change did not take effect if the emitter had not observed it in effect by `actTimeoutHorizon`. A later `access-change` record changes that.
> - No record of an access change the emitter has not observed in effect is published in any form. This includes its `gate-check` record.

**§6 Commitments: replace the first bullet's last sentence.**
> No commitment is made to a `crossing-intent` or to a `gate-check` record. Commitments to `access-change` records follow §8: only to `emitter-gated` records whose `governanceEvent` is `access-change`. None are made yet for other record types.

**§8 Access changes: replace the section.**
> ## 8. Gate checks and access changes
>
> Some changes alter who can see or act on data without moving it: a permissioned space made public, a public space made private again, a member added to a group, an access level raised or lowered, a grant issued or revoked. A change that goes through the emitter's own gate, with the regimes it authorized, is recorded as a governed event (`access-change`). A change the emitter observes but its own gate did not pass is recorded as an observation (`access-change-observed`), whether or not another party's gate governed it. So is a change that went through the emitter's gate but produced regimes other than those the gate authorized: the act was gated, the difference was not. Both are recorded with `gate-check` and `access-change` records, never with `crossing-intent` and `crossing-completion` records, which describe data that moves.
>
> - Every gate invocation outside a substrate crossing, pass or block, produces a `gate-check` record carrying `gateCheck`. (A substrate crossing's gate is recorded in its `crossing-intent`.) The record states who invoked the gate, under which grant, for which capability, when, with what result and, where it applies to something, the subject. A `gate-check` record says what the gate checked, not whether anything that followed took effect.
> - When the invocation is an access change, the `gate-check` record also carries `authorizedChange`, the regimes before and after that the gate authorized, and `actTimeoutHorizon`. It must be emitted before the change is made. This order is a duty on the emitter. The architecture does not enforce it where the change can be made without going through the gate.
> - An `access-change` record, carrying `accessChange`, must be emitted whenever the emitter observes in effect a change it authorized, including after `actTimeoutHorizon`. It records the regime actually observed, which may differ from the one authorized.
> - An emitter that observes a change made without going through its gate, by itself or by its agent, must record it as an `access-change` record with `actorRelation: emitter-ungated`. An agent is a non-human actor (for example an AI model or automated system) to which the emitter issued a grant to act as its agent. It stays the emitter's agent while it holds any grant from the emitter, counting a revoked grant until the revocation takes effect on the path the actor used. A change counts if it was made while the actor was the emitter's agent; the time the emitter observes the change is used only where the time of the change is unknown. The emitter answers for its agent's changes whether or not a grant permitted them. A person or organization holding a grant from the emitter, including one who represents it, is not its agent.
> - A party that observes a change made by someone other than itself and its agents (another party, a host or a service) may record it as an `access-change` record with `actorRelation: other-party`. No `gate-check` record of the emitter's precedes it, and it claims no gate.
> - One record covers one subject: a record, collection, space, document or group. A record for a collection or space does not list its members.
> - A delegation of the authority to consent is recorded as `delegation`, not as an access change.
>
> **Regimes.** A regime is described by four properties:
> - who can read (`readers`: `bounded` or `unbounded`)
> - whether it is pushed without a request to relays, indexers or other services that serve anyone (`indexing`: `none` or `global`); delivery only to a bounded set of readers, requested or not, is `none`
> - what removing access can do, including to copies made while the regime applied (`revocation`)
> - who can verify authorship (`integrity`: `signed`, `deniable` or `local`)
>
> Two regimes differ when any of the four differs. The service enforcing a regime is not one of the four: moving to another host with the same properties is not a change of regime. Every access change is recorded, whether or not the regime changes. `readers` decides the exposure claim and what may be published. A difference in any property requires `regimeAcknowledgment` at the gate.
>
> | Change | Regimes differ? |
> |---|---|
> | Permissioned space made public | Yes: readers, indexing, integrity |
> | Space `readPolicy` changed from `public` to `member-list` | Yes: readers |
> | Member added to, or removed from, a permissioned space or private group | No |
> | Access level raised or lowered inside a private group | No |
> | Space moved to a new host under the same properties | No |
> | A public record's "visibility" flag changed while it stays readable and indexed in a public repository | No: a flag is not a regime |
>
> **Exposure claims.** A `gate-check` record carries `exposure-upper-bound`. An `access-change` record carries `exposure-unbounded` when either regime has `readers: unbounded`, and `exposure-upper-bound` otherwise. What removing access can do about copies made under the earlier regime is stated by `regimeBefore.revocation`. The record claims nothing about those copies.
>
> **Publication.** Publication and the exposure claim follow the observed regimes (`accessChange.regimeBefore` and `regimeAfter`). A gated change is observed in effect when the emitter observes that the act its gate passed was applied at the subject, whatever regimes it then observes. That observation is the emitter's own. The record stays `emitter-gated`, and the regimes observed, not those authorized, decide the exposure claim and publication. Where they differ from those authorized, its `governanceEvent` is `access-change-observed`: the difference was not governed at the gate. Beyond the subject and the two regimes, a record shows what was observed only through `capability`, `grantAction`, `affectedGrant` and `affectedPartyDID`, when present. Where the two regimes are the same and those fields are absent, the record does not show which change was observed. The observed regimes may differ from the authorized ones. An access change is public when either regime has `readers: unbounded`, and private otherwise.
> - For a public access change, the emitter may publish its `access-change` record once it is emitted. The `gate-check` record is not published or committed; it may be delivered privately. A published `emitter-gated` record names its `gate-check` record by `recordId` and link CID, so anyone later given the `gate-check` record can bind the two.
> - For a private one, the emitter may publish a commitment to an `access-change` record with `actorRelation: emitter-gated` and `governanceEvent: access-change`, after it is emitted, and nothing else. No commitment is made to `emitter-ungated` or `other-party` records. A commitment attests the emitter's record of its own governed act, as for a completed substrate crossing: an `emitter-ungated` record does not record a governed act, and an `other-party` record does not record the emitter's act.
> - Block records are never published (§5).
> - No `gate-check` record is published or committed.
> - Signed records cannot be redacted. So in a record where either regime has `readers: unbounded`, `actorDID`, `grantAction`, `affectedGrant` and `affectedPartyDID` are absent. `capability` is allowed: it names a kind of right, not a grant or its holder.

**Known limits: replace "Private governed crossings of record types other than substrate crossings have no public commitment yet." with "Private governed crossings of record types other than substrate crossings and access changes have no public commitment yet." Replace "Access changes are not yet recordable (§8)." with:**
> - A `gate-check` record shows that the gate passed, not that the change happened. An `access-change` record is the emitter's own, author-declared observation. A change that took effect unobserved leaves no `access-change` record.
> - No record, private or public, shows that the act the gate passed was applied. The `gate-check` record binds the subject, the capability and the regimes authorized, not the member or grant affected, and whether the change observed is the act the gate passed is the emitter's statement, for every access change.
> - A change made around the gate that produces the authorized change cannot be told apart from the gated change, before or after `actTimeoutHorizon`. The gate claim is the emitter's.
> - A participant may be able to make a change without going through the gate. If the emitter observes such a change made by itself or its agent, it must record it (`emitter-ungated`). A change by any other participant, including misuse of a grant the emitter issued, may be recorded (`other-party`) but need not be, so the absence of a record does not show that it was not observed. An `other-party` record does not name the grant the actor used.
> - Whether a party is the emitter's agent, and whether it was one when the change was made, is the emitter's own statement. For an emitter that is an organization, which changes its people make count as its own is also its statement. No record shows any of these, so the scope of the emitter's duty to record changes made without its gate cannot be checked from outside.
> - A change made by someone who does not take part (a host, a service, a party outside the relationship) is recorded only if an affected party notices it. Nothing can be required of the one who made it.
> - For a public access change, a published `emitter-gated` record shows that the gate passed. How it passed (the actor, the grant, the capability and the regimes authorized) is shown only to those given its `gate-check` record.
> - A published record with `actorRelation: emitter-gated` and `governanceEvent: access-change-observed` went through the gate, but the regimes observed differ from those the gate authorized. It does not show which regimes were authorized.
> - A record for a collection or space does not show which members it covered.
> - Moving a space to a new authority changes its address. That is not an access change, and records made before the move keep the old address.
> - An access change applies to an address, not to content. Whatever the subject holds under the new regime is exposed, including content written after the gate check.
> - The regime properties describe reading. A change to another capability is stated by `capability`. In a record where either regime has `readers: unbounded`, the record does not say whether a grant was issued, amended or revoked.
> - Deleting data, or moving it to a new address (for example from a public repository into a permissioned space), is not an access change. No record shape here describes it.
> - The public record shows only the access-change records the emitter chose to publish and the commitments it chose to make, and a private access change can be committed only if it went through the emitter's gate with the regimes it authorized. Changes made without the gate, by the emitter or its agent, gated changes whose regimes differ from those authorized, and changes the emitter observed others make, can always be kept out of the public record: when private they are never committed, and when public their publication is optional. An emitter with such changes and one without look the same.


---

*Draft for feedback · prepared 2026-09-27 · not the published specification · Built with AI-collaborative methods · Intellectual direction and authorial responsibility: Jedi Wright · UX Minds, LLC*
