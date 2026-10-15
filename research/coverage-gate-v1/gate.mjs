/** DEV-only proposal. Never replaces an app's acceptance decision or grants persistence.
 * Conservatively flags unlinked observed digits even when upstream marked material=false.
 * All token IDs are retained so an app may group warnings by page/row without hiding evidence.
 */
export function auditNumericCoverage(layout, parsed) {
  const blocked = (code, detail = null) => ({
    status: 'review-required', canAutoAccept: false, canPersist: false,
    newWarnings: [], issues: [{code, ...(detail === null ? {} : {detail})}],
    summary: {totalObservations: 0, linkedObservations: 0, numericUnlinked: 0,
      alreadyWarned: 0, newlyWarned: 0}
  });
  if (!Array.isArray(layout?.observations) || !parsed ||
      typeof parsed !== 'object' || !parsed.decision || typeof parsed.decision !== 'object')
    return blocked('INVALID_COVERAGE_INPUT');
  const observations = layout.observations;
  const ids = new Set();
  for (const o of observations) {
    if (!o || typeof o.id !== 'string' || !o.id || ids.has(o.id) ||
        typeof o.raw !== 'string' || !Number.isInteger(o.page) || o.page < 1)
      return blocked('INVALID_SOURCE_OBSERVATION', o?.id ?? null);
    ids.add(o.id);
  }
  const linked = new Set();
  // These references come only from parser-resolved verified fields and completed paylines.
  for (const f of Object.values(parsed.fields ?? {})) {
    if (f?.status !== 'verified') continue;
    if (!Array.isArray(f.sourceIds) || !f.sourceIds.length)
      return blocked('UNSOURCED_VERIFIED_FIELD');
    for (const id of f.sourceIds) linked.add(id);
  }
  if (!Array.isArray(parsed.payLines ?? [])) return blocked('INVALID_PAYLINES');
  for (const row of parsed.payLines ?? []) {
    if (!Array.isArray(row.sourceIds) || !row.sourceIds.length)
      return blocked('UNSOURCED_PAYLINE');
    for (const id of row.sourceIds) linked.add(id);
  }
  for (const id of linked) if (!ids.has(id)) return blocked('INVALID_LINKED_SOURCE', id);
  // Only document-specific, source-ID-bearing decision problems count as a targeted warning.
  const alreadyWarned = new Set((parsed.decision.problems ?? [])
    .filter(p => p?.code === 'UNACCOUNTED_MATERIAL' && typeof p.detail === 'string')
    .map(p => p.detail));
  const numericUnlinked = observations.filter(o => /[0-9]/.test(o.raw) && !linked.has(o.id));
  const newWarnings = numericUnlinked
    .filter(o => !alreadyWarned.has(o.id))
    .map(o => ({code: 'UNREVIEWED_NUMERIC_OBSERVATION', sourceId: o.id, page: o.page,
      box: o.box ?? null}));
  const originalStatus = parsed.decision.status;
  const originalBlocked = originalStatus !== 'candidate-ready' || parsed.decision.canAutoAccept !== true;
  return {
    status: originalBlocked || newWarnings.length ? 'review-required' : 'candidate-ready',
    canAutoAccept: !originalBlocked && newWarnings.length === 0,
    canPersist: false,
    newWarnings,
    issues: [],
    summary: {
      totalObservations: observations.length, linkedObservations: linked.size,
      numericUnlinked: numericUnlinked.length,
      alreadyWarned: numericUnlinked.filter(o => alreadyWarned.has(o.id)).length,
      newlyWarned: newWarnings.length
    }
  };
}
