/** True when every word of `query` is somewhere in `fields` (case-insensitive): "chuck 42", "us 9". */
export function matchesWords(query: string, ...fields: (string | undefined | null)[]) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}
