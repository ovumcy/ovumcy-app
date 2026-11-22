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
// The count is over Unicode code points of the trimmed value, matching the
// rune count both servers apply; the server stays the final arbiter.
export const SYNC_MIN_PASSWORD_LENGTH = 12;

export function isPasswordTooShort(password: string): boolean {
  return [...password.trim()].length < SYNC_MIN_PASSWORD_LENGTH;
}

// bcrypt's input ceiling, counted in UTF-8 bytes of the untrimmed value: both
// the community server and the managed cloud refuse a longer password (as a
// weak password on register/change/reset), so the client names the limit.
export const SYNC_MAX_PASSWORD_BYTES = 72;

export function isPasswordTooLong(password: string): boolean {
  return utf8ByteLength(password) > SYNC_MAX_PASSWORD_BYTES;
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
