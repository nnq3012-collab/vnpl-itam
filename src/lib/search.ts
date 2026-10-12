/** Lowercases and strips accents so "nguyen" matches "Nguyễn" and "dang"
 * matches "Đặng". Safe to use on both server and client. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

/** True when every word of `query` appears in at least one of `fields`
 * (case- and accent-insensitive). An empty query matches everything. */
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(fields.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}
