# Shared review adapters: Osakevahti + Palkka (research-only)

**Scope 22.10.2026:** common read-only review boundary on top of PR #67; no production app integration. The two apps can share source observations, the `review-required` data shape, corrections, source references and diagnostic counters. The **domain adapter** alone decides which fields have which economic meaning.

| Responsibility | Shared core | Osakevahti adapter | Palkka adapter |
|---|---|---|---|
| OCR/PDF/CSV source observations | original source IDs and coordinates | Nordnet image/portfolio source | PDF.js payroll source |
| Financial semantics | never guessed | quantity, total value, NAV, GAV, account | pay date, gross/net, taxable income, withholding |
| User review | `createReviewDraft`, `correctReviewField` | existing position/account mapping happens inside Osakevahti | comparison with payroll periods happens inside Palkka |
| Persistence | forbidden: `canPersist:false` | Osakevahti's separate confirmation gate | Palkka's separate confirmation gate |

## Integration contract
- `createOsakevahtiReview({source,rows,documentRole})`: source envelope from `evidenceFromOcrTsv` / CSV / PDF, rows with field `{value,status,sourceIds,role?}`. Requires explicit holdings-document role. Never converts NAV to cost basis. No trade/import action.
- `createPalkkaReview({source,parsed})`: payroll domain output from `parsePayrollSections` or separately audited Palkka adapter, with `fields` and `issues`. Required salary fields remain independent of holdings.
- Both return a *transient* source-linked review draft. It deliberately contains private source contents in memory; never log it, upload it or export it. Diagnostics return only counts.

## Blocking launch conditions
1. Test 1- and 5-fund Nordnet screenshots with two independent OCR reads; distinguish `arvo`, `NAV`, `keskikurssi` and `kpl`. Duplicate fund names in AOT/OST must force account choice.
2. Run same-source PDF.js pay slips from Palkan adapter, including deductions, varying layouts, broken and missing YTD, signed entries and previous tax-card boundaries.
3. Confirm both apps' *existing* app-specific approve/cancel/backup/restore paths using real Android PWA; engine has no storage.
4. Independent regression QA and measured no false auto-accepts. Tests below are synthetic evidence and are not production GO.

The original experimental source fields may report "verified"; here they are **demoted to candidates**. Source ID existence is not proof of a field's financial role. No source role is inferred by this bridge. This is a narrow integration seam, not a completed OCR parser.

## Added: actual two-pass fund parser → review bridge (22.10.2026)
`createOsakevahtiFundSnapshotReview({source,snapshot})` consumes the existing
`extractFundSnapshot(primary,witness)` **result**, not an invented text-only
parser. The caller passes the canonical source evidence envelope for the same
first OCR reading (`schemaVersion:1,sourceKind:'image-ocr-tsv'`) and the
`snapshot` returned by the fund parser.
- Requires the parser's explicit snapshot schema, `canPersist:false`,
  `marketIdentityVerified:false`, and per-row `identityStatus:'UNVERIFIED'`.
- Keeps raw decimal strings such as `40.1234` and `35.5678` separate, with
  their exact source IDs; no NAV→GAV substitution, no rounding into a cost.
- Compares all original source observation IDs + raw strings to reject swapped
  or altered source envelopes; requires second OCR witness evidence for
  observed fields. Missing, ambiguous or disagreeing fields do **not**
  become candidates.
- No inferred broker account, position ID or transaction. Users must still
  select their own holding in Osakevahti, and only Osakevahti can commit it.

Focused Node gate now covers: 1-card and 5-card source-backed parser outputs,
four-decimal NAV/GAV separation, second-read disagreement, tampered source
envelopes, rejected forged identity, plus original domain adapters and Palkka
source parser. **This bridge is still LAB-only and not imported by the live
Osakevahti Alpha.**

### Current upstream QA limitation
The stacked research baseline (up through Draft PR #67) includes failing
legacy mobile-learning Node/Chromium tests. Do not hide them behind the new
focused gate or treat the gate as a full Engine release approval. Fix or
explicitly quarantine **only proven inherited test defects** in a separate,
auditable PR. Never loosen a financial safety gate merely to make CI green.
