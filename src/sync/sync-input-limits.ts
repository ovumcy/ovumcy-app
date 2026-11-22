import { utf8ByteLength } from "./password-policy";

// The community server's limits, in UTF-8 bytes of the trimmed value. It
// stays the final arbiter; these checks only name the failure before submit.
const SYNC_LOGIN_MIN_BYTES = 3;
const SYNC_LOGIN_MAX_BYTES = 254;
const SYNC_DEVICE_LABEL_MIN_BYTES = 2;
const SYNC_DEVICE_LABEL_MAX_BYTES = 64;

export function isSyncLoginLengthValid(login: string): boolean {
  const bytes = utf8ByteLength(login.trim());
  return bytes >= SYNC_LOGIN_MIN_BYTES && bytes <= SYNC_LOGIN_MAX_BYTES;
}

export function isSyncDeviceLabelLengthValid(label: string): boolean {
  const bytes = utf8ByteLength(label.trim());
  return bytes >= SYNC_DEVICE_LABEL_MIN_BYTES && bytes <= SYNC_DEVICE_LABEL_MAX_BYTES;
}
