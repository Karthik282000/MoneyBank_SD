export const SOCIETY_BLOCKS = ['A', 'B', 'C', 'D'];
export const OUTSIDE_BLOCK = 'Outside';
export const NO_OUTSIDE_FLAG = 'NO_OUTSIDE';
export const ALL_BLOCKS = 'ALLBLOCKS';
export const LOGIN_BLOCK_OPTIONS = ['A', 'B', 'C', 'D', 'Outside', 'ALLBLOCKS'];
export const FORM_BLOCK_OPTIONS = ['A', 'B', 'C', 'D', 'Outside'];

export function blockLabel(block) {
  if (!block) return '';
  const v = String(block).trim();
  if (v === OUTSIDE_BLOCK || v.toUpperCase() === 'OUTSIDE') return 'Outside';
  return v;
}

export function isOutsideBlock(block) {
  const v = String(block || '').trim();
  return v === OUTSIDE_BLOCK || v.toUpperCase() === 'OUTSIDE';
}

export function outsideRowClass(block) {
  return isOutsideBlock(block)
    ? 'bg-amber-50/80 border-l-4 border-l-amber-500'
    : '';
}

export function blockPhrase(block) {
  if (!block) return '';
  if (isOutsideBlock(block)) return 'Outside';
  return `Block ${block}`;
}

function hasSocietyAccess(list) {
  return list.includes(ALL_BLOCKS) || list.some((b) => SOCIETY_BLOCKS.includes(b));
}

function hasOutsideSelected(list) {
  return list.some((b) => isOutsideBlock(b));
}

/** Runtime access: anyone with A–D / ALLBLOCKS also gets Outside unless they opted out. */
export function withDefaultOutsideAccess(blocks) {
  const list = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (list.includes(NO_OUTSIDE_FLAG)) {
    return list.filter((b) => b !== NO_OUTSIDE_FLAG && !isOutsideBlock(b));
  }
  if (hasSocietyAccess(list) && !hasOutsideSelected(list)) {
    return [...list, OUTSIDE_BLOCK];
  }
  return list;
}

/** Persist checkbox state: opting out of Outside is stored as NO_OUTSIDE. */
export function blocksForStorage(blocks) {
  const list = [...new Set((Array.isArray(blocks) ? blocks : []).filter(Boolean))];
  if (list.includes(ALL_BLOCKS)) return [ALL_BLOCKS];

  const wantsOutside = hasOutsideSelected(list);
  const cleaned = list.filter((b) => b !== NO_OUTSIDE_FLAG && !isOutsideBlock(b));
  if (wantsOutside) return [...cleaned, OUTSIDE_BLOCK];
  if (hasSocietyAccess(cleaned)) return [...cleaned, NO_OUTSIDE_FLAG];
  return cleaned;
}
