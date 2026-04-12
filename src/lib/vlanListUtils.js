function normVlanToken(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * Append a VLAN name to a comma-separated list only if not already present (case-insensitive, whitespace-normalized).
 * @param {string} [existingCsv]
 * @param {string} vlanToAdd
 * @returns {string}
 */
export function mergeUniqueVlanIntoCsv(existingCsv, vlanToAdd) {
  const add = String(vlanToAdd || '').trim();
  if (!add) return String(existingCsv || '').trim();

  const parts = String(existingCsv || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const addNorm = normVlanToken(add);
  const seen = new Set(parts.map(normVlanToken));
  if (seen.has(addNorm)) return parts.join(', ');
  return [...parts, add].join(', ');
}
