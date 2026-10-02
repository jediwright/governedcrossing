# Tools

Scripts that produce, check and publish governed crossing records for the draft `org.governedcrossing.temp.*` lexicons. They made the examples listed under "Live examples" in the repository README.

These are working scripts for one emitter, not a general library. The emitter's DID and key reference are fixed in `lib.mjs`.

## What they do

A crossing record pair describes one act: data leaving an access-controlled document for the public network. The steps are separate so that the records can be checked before they are published.

| Step | Command | Network | What it does |
|---|---|---|---|
| 1 | `npm run cross` | yes | Runs one public crossing and stores the records the crossing code wrote: an intent before publication, a completion after it succeeded. |
| 2 | `npm run sign -- --store <folder>` | no | Maps those records onto the lexicon, adds a record id and a fresh salt to each, links the completion to the intent, and signs both. |
| 3 | `npm run check -- --store <folder>` | no | Validates both records against the lexicons in this repository and against `CONFORMANCE.md` sections 1 to 5, 7 and 9. |
| 4 | `npm run publish-records -- --store <folder> --yes` | yes | Publishes the two records, then reads each back and compares it with the local copy. |

Step 1 publishes a `com.whtwnd.blog.entry`. That write is permanent. Step 4 refuses to run unless step 3 passes on the files as they are.

To check a published record from the network, with no sign-in:

```
npm run verify -- at://did:plc:4xoefmmbsulm4xns3kbb6mnk/org.governedcrossing.temp.crossingRecord/<record key>
```

It fetches the record, looks up the signing key in the signer's DID document, verifies the signature, and for a completion finds the intent and checks the link.

Step 1 has two test modes. `--dry-run` signs in and runs the whole path, but the publish is rejected, so nothing is written. `--rehearse` uses no network at all; step 2 then takes `--throwaway-key`, and step 4 refuses the folder.

## Setup

- Node 22 or later. Run `npm ci` in this folder.
- A clone of [`jediwright/employment-seam`](https://github.com/jediwright/employment-seam) at commit `fb05ea1`, with `npm ci` run in its `substrate-crossing` folder and a `.env` there holding the account handle and an App Password. Point `EMPLOYMENT_SEAM_DIR` at the clone. Step 1 uses that code in place and refuses to run if the clone is at another commit or has uncommitted or untracked files.
- A store folder outside any git repository. The default is `~/governedcrossing-store`; set `GC_STORE_DIR` to change it. The signed records in the store are the canonical copies. What is published is a copy.

## The signing key

Step 2 asks for the secret key at a terminal prompt. The input is hidden. The key is not read from a file, an argument or the environment, and it is not written anywhere. The step refuses to sign if the key does not match the public key of the `#governedcrossing` verification method.

## How records are signed

Signatures follow the ATProtocol Attestation Specification v1.0 and `CONFORMANCE.md` section 3. The signed CID is computed over the record in the AT Protocol data-model form, in which a `bytes` field such as `salt` is a CBOR byte string.

`atproto-attestation-verify` 0.14.5 computes the CID from the JSON form instead, in which the same field is a map holding base64 text. It therefore rejects these signatures, and would reject any signature made this way on a record with a `bytes` field outside `signatures`. Step 3 and `verify.mjs` verify the signatures with this repository's own code, which is not an independent check.

## Files

| File | Purpose |
|---|---|
| `1-cross.mjs` to `4-publish.mjs` | The four steps. |
| `lib.mjs` | Encoding, CIDs, signing and verification, the store, the clone check. |
| `projection.mjs` | The field mapping onto the lexicon. |
| `checks.mjs` | The offline check used by steps 3 and 4. |
| `verify.mjs` | Read-only check of a published record. |
| `proto-resolve.mjs`, `proto-hooks.mjs` | Let step 1 load the crossing code's dependencies from the `employment-seam` clone. |
