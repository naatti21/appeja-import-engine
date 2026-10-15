# YÖAJO 10 — source-evidence safety patch

Frozen parent #20 `35bb5c228fdadcae177973a07c0c67318d6187ca`. New isolated research module; no edits to v2, its generator/EVAL, E, src, demo, acceptance or production. Same-author development/regressions, not external independent QA.

## Architecture comparison (fixed before correction)

| Design | Safety / compatibility |
|---|---|
| Flat sourceIds + any matching token | D1 consumes unrelated amounts. Rejected. |
| Require entire flat list to reproduce value | Safe conservative legacy fallback; legitimate header+date lists become review-required. No guessing of roles. |
| Explicit disjoint value/header/context sets + independent content/geometry checks | Chosen research contract. Full value consumption; field-specific headings; exact expected context; collision/overlap detection. Claims remain untrusted until checked. |

`field.sourceRoles={valueIds:[],headerIds:[],contextIds:[]}` separates roles. If legacy `sourceIds` is also present it must equal the exact union, not hide surplus references. Missing typed roles means EVERY legacy ID is a value ID. A value observation cannot be claimed by two different fields/paylines or simultaneously as a heading/context. Shared ancillary evidence may be reused only for identical roles/claims. Header/context observations must independently match a declared role and be locally aligned to the value; unsupported/global contextual association abstains.

Value fragments must be on one page/row, disjoint and adjacent. Validate complete numeric grammar before removing grouping; sign/decimal fragments can join only when reconstruction has one unique matching interpretation. Never filter away nonnumeric tokens or deduplicate by raw text. Headers must match a field-specific exact vocabulary; contexts must reproduce an explicit expected currency/period/account. No generic confidence, source membership or accountedEvidenceIds authorizes consuming a token.

## Locked patch acceptance

1. The unchanged D1 oracle must fail on frozen v2: extra `73.21` appended to payDate sources => expected canAutoAccept=false and source-specific warning. Red must be an assertion failure with the known incorrect true result, not an import/harness failure.
2. D1 and all adversarial surplus IDs (numeric/text/ancillary), duplicate membership, overlapping fragments, cross-field value reuse, missing refs and contradictory context must block. Known original financial IDs get targeted warnings; canPersist always false.
3. New independent minimal controls: exact legacy scalars; declared headings; adjacent valid numeric/date/sign fragments; consistent typed context; legitimate disjoint payroll cells must remain usable. Input immutable, source-order invariant, upstream block never relaxed.
4. Report compatibility loss separately on healthy legacy header+date, distant column headings and unscoped context. These may conservatively block but are NOT described as usability fixes or hidden from report. No new metadata exemptions/no nuisance tuning.
5. Full affected Node suite and exact-head GitHub Actions; existing browser regression may run, but no new browser integration, OCR, Android, offline or external QA claim.

Cases use seed 101015 (deterministic enumerated control IDs, no random accuracy claim). All data fictional; no old YÖAJO 09 EVAL inputs used in design or comparisons. An inherited unmodified historical workflow may replay v2 independently; that is not new optimization evidence and is not used to evaluate this patch.

Stop after patch, impact tests and CI. No merge/deploy. Broad precision/ordinary-document testing needs a new separate round. Research patch success does not lift production NO-GO.
