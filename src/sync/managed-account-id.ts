// The managed cloud signs an account in with a server-generated Account ID:
// 64 random bits, canonically 16 lowercase hex characters and displayed as
// four dash-separated groups. It is an identifier, not a secret — the
// password is the secret — but it is still never persisted outside the secure
// store, logged, or carried in a route, URL or the clipboard.

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Normalizes typed Account ID input to its canonical form: trimmed, lowercased,
 * with dashes and any whitespace removed. Returns null when the result is not
 * exactly 16 hexadecimal characters.
 */
export function normalizeManagedAccountId(input: string): string | null {
  const canonical = input.toLowerCase().replace(/[-\s]+/g, "");
  return ACCOUNT_ID_PATTERN.test(canonical) ? canonical : null;
}
