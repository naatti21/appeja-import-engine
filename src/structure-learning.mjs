/** Bounded structural memory. No text, coordinates, source IDs or value hashes on disk.
 * Caller supplies an ephemeral document key and explicit human confirmation.
 * Distinct documents must be confirmed in the SAME session to activate a profile.
 */
const ROLES = new Set(['text', 'identity', 'measure', 'price', 'total', 'cost', 'change', 'scope', 'currency', 'control', 'unknown']);
const APP = 'import-engine-structure';
const clone = value => JSON.parse(JSON.stringify(value));
const key = pattern => JSON.stringify(pattern);
/** Repetition records user choices, not semantic evidence. The adapter must first
 * derive a binding from the CURRENT source, independently of this memory.
 * No raw source content is accepted by or persisted in the learning store.
 */
export function assessSourceBinding(pattern, profile, binding) {
  if (!binding) return {usable:false, reason:'AMBIGUOUS_NAME', field:'name'};
  try {
    validatePattern(pattern); validateBinding(pattern,binding);
    if (profile) {
      if (key(profile.pattern)!==key(pattern)) throw Error('PATTERN_MISMATCH');
      validateBinding(pattern,profile.binding);
    }
  } catch {return {usable:false,reason:'INVALID_LEARNED_BINDING',field:'name'};}
  if (profile?.state==='conflict') return {usable:false,reason:'LEARNING_CONFLICT',field:'name'};
  if (profile && profile.binding.entity!==binding.entity)
    return {usable:false,reason:'LEARNED_NAME_CONFLICT',field:'name'};
  return {usable:true};
}
function validatePattern(pattern) {
  if (!Array.isArray(pattern) || pattern.length < 3 || pattern.length > 16 || pattern.some(x => !ROLES.has(x)))
    throw Error('INVALID_PATTERN');
}
function validateBinding(pattern, binding) {
  if (!binding || Object.keys(binding).sort().join() !== 'entity,identity,measure' ||
      !['entity', 'identity', 'measure'].every(k => Number.isInteger(binding[k]) && binding[k] >= 0 && binding[k] < pattern.length) ||
      new Set(Object.values(binding)).size !== 3 || pattern[binding.entity] !== 'text' ||
      pattern[binding.identity] !== 'identity' || pattern[binding.measure] !== 'measure') throw Error('INVALID_BINDING');
}
export function sanitizeStructureStore(input) {
  if (!input || input.app !== APP || input.version !== 1 || !Array.isArray(input.profiles) || input.profiles.length > 16)
    throw Error('INVALID_STORE');
  const seen = new Set();
  const profiles = input.profiles.map(p => {
    validatePattern(p.pattern); validateBinding(p.pattern, p.binding);
    if (seen.has(key(p.pattern)) || !['provisional', 'active', 'conflict'].includes(p.state)) throw Error('INVALID_PROFILE');
    seen.add(key(p.pattern));
    return {pattern: [...p.pattern], binding: {...p.binding}, state: p.state};
  });
  return {app: APP, version: 1, profiles};
}
export function createStructureLearner(initial) {
  let store = initial ? sanitizeStructureStore(initial) : {app: APP, version: 1, profiles: []};
  let samples = new Map();
  const history = [];
  const commit = next => {history.push(clone(store)); if (history.length > 16) history.shift(); store = next;};
  return {
    export() {return clone(store);},
    lookup(pattern) {
      validatePattern(pattern);
      return clone(store.profiles.find(p => key(p.pattern) === key(pattern)) ?? null);
    },
    confirm({pattern, binding, documentKey, confirmed}) {
      validatePattern(pattern); validateBinding(pattern, binding);
      if (confirmed !== true || typeof documentKey !== 'string' || !documentKey || documentKey.length > 256)
        throw Error('EXPLICIT_CONFIRMATION_REQUIRED');
      const k = key(pattern), next = clone(store), old = next.profiles.find(p => key(p.pattern) === k);
      if (!old && next.profiles.length >= 16) throw Error('PROFILE_LIMIT');
      const same = old && ['entity', 'identity', 'measure'].every(role => old.binding[role] === binding[role]);
      if (old?.state === 'conflict') throw Error('PROFILE_CONFLICT');
      if (old && !same) {old.state = 'conflict'; samples.delete(k); commit(next); return 'conflict';}
      const proof = samples.get(k) ?? new Set();
      if (proof.has(documentKey)) return old?.state ?? 'provisional';
      proof.add(documentKey);
      // Only two ephemeral keys are needed. No repeat import can grow this memory.
      if (proof.size > 2) proof.delete(proof.values().next().value);
      samples.set(k, proof);
      const state = old?.state === 'active' || proof.size >= 2 ? 'active' : 'provisional';
      if (old) old.state = state;
      else next.profiles.push({pattern: [...pattern], binding: {...binding}, state});
      commit(next); return state;
    },
    undo() {if (!history.length) return false; store = history.pop(); samples = new Map(); return true;},
    reset() {commit({app: APP, version: 1, profiles: []}); samples = new Map();},
    import(input) {
      const next = sanitizeStructureStore(input);
      // An imported backup is a suggestion, not proof of independent confirmations.
      next.profiles.forEach(p => {if (p.state === 'active') p.state = 'provisional';});
      commit(next); samples = new Map();
    }
  };
}
