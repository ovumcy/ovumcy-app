// The invite secret travels only in the link fragment, which no HTTP request
// carries, so neither the managed cloud nor the invite host receives it.
// Dependency-free on purpose: the web scrub imports this before app boot.
const INVITE_SECRET_FRAGMENT_PARAM = "k";
const INVITE_SECRET_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function isPartnerInviteSecretHex(value: string): boolean {
  return INVITE_SECRET_HEX_PATTERN.test(value);
}

/**
 * Builds the link the owner shares. Any fragment the server put on its URL is
 * dropped: the fragment is client-controlled and carries only the secret.
 */
export function buildShareablePartnerInviteURL(
  serverInviteURL: string,
  inviteSecretHex: string,
): string {
  if (!isPartnerInviteSecretHex(inviteSecretHex)) {
    throw new Error("invalid_partner_invite");
  }
  const hashIndex = serverInviteURL.indexOf("#");
  const base =
    hashIndex === -1 ? serverInviteURL : serverInviteURL.slice(0, hashIndex);
  return `${base}#${INVITE_SECRET_FRAGMENT_PARAM}=${inviteSecretHex}`;
}

/**
 * Reads the invite secret from a fragment (with or without the leading `#`).
 * Returns "" unless exactly one well-formed `k` is present.
 */
export function parsePartnerInviteSecretFromFragment(
  fragment: string | null | undefined,
): string {
  const raw = (fragment ?? "").replace(/^#/, "");
  const values = raw
    .split("&")
    .filter((part) => part.startsWith(`${INVITE_SECRET_FRAGMENT_PARAM}=`))
    .map((part) => part.slice(INVITE_SECRET_FRAGMENT_PARAM.length + 1));
  if (values.length !== 1) {
    return "";
  }
  const value = values[0] ?? "";
  return isPartnerInviteSecretHex(value) ? value : "";
}

export function fragmentCarriesPartnerInviteSecret(fragment: string): boolean {
  return fragment
    .replace(/^#/, "")
    .split("&")
    .some((part) => part.startsWith(`${INVITE_SECRET_FRAGMENT_PARAM}=`));
}

/**
 * Strips the `k` parameter from a fragment, keeping any other parameters.
 * Returns the fragment without the leading `#` ("" when nothing remains).
 */
export function removePartnerInviteSecretFromFragment(fragment: string): string {
  return fragment
    .replace(/^#/, "")
    .split("&")
    .filter(
      (part) =>
        part.length > 0 && !part.startsWith(`${INVITE_SECRET_FRAGMENT_PARAM}=`),
    )
    .join("&");
}

/**
 * Reads the invite token and secret from a raw link. Parsed by hand rather
 * than with `URL`, because custom-scheme links (`ovumcy://…`) are not
 * reliably parsed by the React Native URL implementation.
 */
export function parsePartnerInviteLink(link: string | null | undefined): {
  inviteToken: string;
  inviteSecretHex: string;
} {
  const raw = link ?? "";
  const hashIndex = raw.indexOf("#");
  const beforeHash = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : raw.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex + 1);

  let inviteToken = "";
  for (const part of query.split("&")) {
    if (part.startsWith("invite_token=")) {
      inviteToken = safeDecode(part.slice("invite_token=".length)).trim();
      break;
    }
  }

  return {
    inviteToken,
    inviteSecretHex: parsePartnerInviteSecretFromFragment(fragment),
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}
