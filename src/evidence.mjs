/** Candidate identities stay distinct; equality is not treated as a conflict. */
export function resolveCandidates(candidates, {required = true} = {}) {
  const raw = candidates.map(c => ({...c}));
  if (!raw.length) return {status: required ? 'missing' : 'optional-missing', value:null, candidates:[]};
  const bad = raw.some(c => c.status !== 'valid' || typeof c.value !== 'number' || !Number.isFinite(c.value));
  const distinct = [...new Set(raw.filter(c => c.status === 'valid').map(c => c.value))];
  if (bad) return {status:'unverified',value:null,candidates:raw};
  if (distinct.length > 1) return {status:'conflict',value:null,candidates:raw};
  return {status:'unique',value:distinct[0],candidates:raw};
}

export function decideSafety(fieldResults, issues = [], required = []) {
  const blocked = issues.length > 0 || required.some(name => fieldResults[name]?.status !== 'unique') ||
    Object.values(fieldResults).some(f => f.status === 'conflict' || f.status === 'unverified');
  return {canAutoAccept: !blocked, status: blocked ? 'review-required' : 'candidate-only'};
}
