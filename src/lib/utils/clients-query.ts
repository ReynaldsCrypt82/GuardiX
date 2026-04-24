/**
 * Decides how to interpret a free-form search input.
 * If the input contains 3+ digits after stripping non-digits → search by name OR document (stripped).
 * Otherwise → search by name only (literal).
 */
export function buildSearchClause(
  query: string,
): { type: 'or'; name: string; document: string } | { type: 'name'; name: string } {
  const stripped = query.replace(/\D/g, '')
  if (stripped.length >= 3) {
    return { type: 'or', name: query, document: stripped }
  }
  return { type: 'name', name: query }
}

/**
 * Resets page to 1 when a filter changes — prevents stale pagination state (Pitfall 4).
 * Returns a new URLSearchParams with the filter applied and page reset to '1'.
 */
export function resetPageOnFilterChange(
  currentParams: URLSearchParams,
  filterKey: string,
  filterValue: string | null,
): URLSearchParams {
  const next = new URLSearchParams(currentParams)
  if (filterValue) next.set(filterKey, filterValue)
  else next.delete(filterKey)
  next.set('page', '1')
  return next
}
