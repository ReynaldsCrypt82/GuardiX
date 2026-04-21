/**
 * Generate a URL-safe slug from a company name.
 * - Lowercases, strips accents, replaces non-alphanumeric chars with '-'
 * - Collapses consecutive dashes, trims leading/trailing dashes
 * - Truncates to max 40 chars
 * - Appends "-2", "-3" etc. if slug collides with existingSlugs
 */
export function generateSlug(
  companyName: string,
  existingSlugs: string[] = [],
): string {
  const base =
    (companyName ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'corretora'

  if (!existingSlugs.includes(base)) return base

  let i = 2
  while (existingSlugs.includes(`${base}-${i}`)) i++
  return `${base}-${i}`
}
