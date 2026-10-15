# YÖAJO 10 — exact source-set safety wrapper

Research base #20: `35bb5c228fdadcae177973a07c0c67318d6187ca`.
Protocol + assertion-red D1 committed first: `18e479ebb2182da92ee291cfa7bd7e94f503bc09`.

**Scoped correction: PASS on the fixed controls. Production/integration/merge: NO-GO.**
This does not change the frozen YÖAJO 09 implementation or its failed precision result.

## Architecture and contract

| Source role | Authority | Safety check |
|---|---|---|
| Value | Reproduces the complete candidate value | All referenced text participates; validate full grammar, ordering, adjacency, page and no overlap. No `some()` match, no dropping nondigit sources. |
| Header | Establishes only an explicitly named field role | Exact bounded FI/EN/SV field vocabulary; same-row local heading geometry. Never supplies the value. |
| Context | Qualifies an explicit expected currency/period/account | Exact supported source grammar and expected claim; local same-row geometry. Contradiction blocks and warns the original value/context IDs. |

Typed field example:

```js
{
  status: 'verified', value: 3201.25,
  sourceIds: ['amount', 'heading', 'currency'], // optional audit union, must be EXACT
  sourceRoles: {valueIds: ['amount'], headerIds: ['heading'], contextIds: ['currency']},
  context: {currency: 'EUR'}
}
```

A legacy flat sourceIds list means **all values**, not implicit headers/context. Missing typed roles are never guessed from a matching token. Every role list is unique/disjoint and all IDs exist in the original layout. A value ID cannot be reused across fields/paylines; geometry-overlapping observations cannot pass as independent evidence. Shared ancillary evidence is allowed only for matching role/meaning and independently valid local geometry.

The wrapper compiles only independently checked individual source claims into the unchanged v2 gate internally; it does not return altered financial fields, mutate input or authorize persistence. Frozen v2 still handles its original upstream blocks, warning grouping and metadata exceptions. Unsafe source associations receive explicit issues and original-ID warnings even when another otherwise-valid association claimed that ID. `validatedEvidence` exposes the accepted value/header/context partition for auditing.

Payroll handling remains the parent numeric/arithmetic grammar, strengthened so ignored arbitrary text cannot be consumed: at most one exact declared label is ancillary. Unknown text/units, duplicate IDs, cross-field reuse and inconsistent numeric cells block. This is not independent verification of payroll code/label semantics.

## Red → green evidence

The identical D1 assertion on frozen v2 reports `canAutoAccept=true, newWarnings=[]` and **fails** with `ERR_ASSERTION` (`true !== false`). The patched wrapper reports `canAutoAccept=false`, targeted warnings for `date` and `extra-money`, and `canPersist=false`.

Reproduce from repository root:

```sh
SOURCE_EVIDENCE_BASELINE=1 node --test --test-name-pattern='D1 extra' tests/source-evidence-research.test.mjs
node --test tests/source-evidence-research.test.mjs
node research/source-evidence-v1/impact.mjs qa-output
npm test
```

The first command is intentionally assertion-red (exit 1); the remaining commands must pass. CI independently checks that the red result is the known unsafe true output and an assertion failure, not an import/environment failure. It uploads the red log and complete corrected impact results even on failure.

## Local measured impact

Node v24.19.0: **45/45 new test cases PASS**, including 42 enumerated impact controls, permutation/immutability/grouping checks and nine malformed-input mutations. **Full Node suite 146/146 PASS** (parent 101 unchanged + new 45). Fresh controls seed 101015; no old generator or YÖAJO 09 EVAL is used.

| Fixed control set | Result |
|---|---|
| Explicit positive controls | 11/11 remain eligible |
| Adversarial controls | 26/26 blocked; 17 were unsafe accepts in v2 |
| Original upstream blocked control | Stays blocked |
| Compatibility probes | 4/4 conservatively blocked; **3 new usability false blocks** compared with v2 |

All 42 controls satisfy their predeclared safety/compatibility outcome, **not** a claim of 42 usable imports or zero false blocks. Successful value cases include grouped money fragments, decimal/sign fragments, date fragments, typed headings, consistent/shared context and disjoint numeric payroll cells. Unsafe cases cover surplus financial/text/unit refs; duplicate dates/IDs; cross-field ownership; wrong field heading; extra money as a header/context; contradictory currency/period/shared context; undeclared contexts; overlapping/cross-page/missing-geometry fragments; payroll extra text and field-row reuse.

The three observed new conservative false blocks are (1) healthy flat heading+date source lists lacking explicit roles, (2) a plausible global currency context above the value row, and (3) a distant table column heading. Whole-integer fragments without grouping or punctuation also remain review-only, as in v2. These are deliberately reported compatibility losses; no exemption or criteria adjustment was added to turn them into a usability PASS.

## Boundaries and residual risks

- This is an unintegrated research API, not a modification of the real parser/UI. Existing adapters do not yet emit the typed role contract. Legacy lists containing headings will conservatively warn until a separately validated adapter emits exact roles.
- Content reproduction, narrow heading vocabulary and local geometry still do not establish the real-world truth of gross/net/quantity/price/account identity. Consistent but incorrectly assigned claims, especially same-valued fields, require independent semantic validation. Payroll code/label semantics remain the parser's responsibility.
- Only a small grammar of currency/period/synthetic-account context is supported; document-wide context scope and distant headings abstain. Multiple integer fragments without grouping/punctuation and complex multi-line values abstain. Missing geometry prevents multi-fragment/ancillary binding. No OCR repair is attempted.
- Overlapping PDF word boxes, unsupported labels/locales and broad legacy source sets may cause more false blocks than these minimal controls show. A real-document false-positive rate cannot be estimated here.
- Prior broad nuisance/precision FAIL remains unchanged. No new metadata exceptions, corpus tuning or ordinary-prose classifier work was performed.
- Local browser/OCR, new PDF extraction, physical Android, offline, persistence/reload and external independent QA: **NOT RUN** for this wrapper. The inherited CI browser suite is regression evidence only and does not validate this new role API.
- The inherited unmodified YÖAJO 09 workflow may replay its own frozen comparison in GitHub CI; its old EVAL is not an optimization input or an evaluation of this patch. Its known advisory research FAIL is distinct from the YÖAJO 10 safety gate.

The dedicated YÖAJO 10 workflow explicitly checks out PR HEAD, records all outcomes and a tested-SHA/checksummed manifest, and retains synthetic-only ZIP artifacts **14 days**. CI status and exact SHA are added to the PR handoff after actual completion; local counts are not called CI results in advance. Same author wrote oracle and patch; **external independent QA remains NOT RUN**.

Stop after this correction and its impact/CI checks. No frozen-candidate edits, production changes, merge or deployment. Broader nuisance improvement and adapter integration need separate work with new document families.
