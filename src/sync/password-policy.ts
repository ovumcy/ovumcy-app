// Single source of truth for the sync/managed account password minimum length.
//
// Both backends reject a password shorter than this at hash time (see
// SECURITY.md, "Network and Sync"): the community server and the managed cloud
// each trim the password and require at least SYNC_MIN_PASSWORD_LENGTH
// characters, folding the weak-password case into `invalid_registration_input`
// on register and surfacing `weak_new_password` on change/reset. Mirroring the
// rule here lets the client catch a short password before submit and show a
// specific "at least N characters" message instead of a generic server error.
//
// The count is over Unicode code points of the trimmed value to match the
// managed server's rune-count check; the community server counts bytes, so an
// all-ASCII password (the common case) is validated identically on every path,
// and any non-ASCII edge that slips past this client floor is still authorized
// by the server as the final arbiter.
export const SYNC_MIN_PASSWORD_LENGTH = 12;

export function isPasswordTooShort(password: string): boolean {
  return [...password.trim()].length < SYNC_MIN_PASSWORD_LENGTH;
}
