import { stashManagedPartnerInviteToken } from "./managed-partner-invite-token-buffer";
import {
  fragmentCarriesPartnerInviteSecret,
  parsePartnerInviteSecretFromFragment,
  removePartnerInviteSecretFromFragment,
} from "./partner-invite-link";

// F9: On RN-Web the URL bar would briefly show the invite_token between
// page load and the route handler's scrub effect (one paint window). Pull
// the token and the fragment's invite secret out of window.location
// synchronously, before expo-router commits any state — so neither reaches
// window.history, browser autocomplete, devtools, or screen recordings.
// No-op on native (no window) and when the URL carries neither.
export function scrubManagedPartnerInviteTokenFromWebUrl(): void {
  if (typeof window === "undefined") {
    return;
  }
  const location = window.location;
  const history = window.history;
  if (!location || !history || typeof history.replaceState !== "function") {
    return;
  }
  try {
    const url = new URL(location.href);
    const rawToken = url.searchParams.get("invite_token");
    const nextFragment = removePartnerInviteSecretFromFragment(url.hash);
    const carriesSecret = fragmentCarriesPartnerInviteSecret(url.hash);
    if (rawToken === null && !carriesSecret) {
      return;
    }
    const trimmed = rawToken?.trim() ?? "";
    if (trimmed.length > 0) {
      stashManagedPartnerInviteToken(
        trimmed,
        parsePartnerInviteSecretFromFragment(url.hash),
      );
    }
    url.searchParams.delete("invite_token");
    const nextQuery = url.searchParams.toString();
    const scrubbed =
      url.pathname +
      (nextQuery.length > 0 ? `?${nextQuery}` : "") +
      (nextFragment.length > 0 ? `#${nextFragment}` : "");
    history.replaceState(history.state, "", scrubbed);
  } catch {
    // Best-effort: URL parsing or history mutation failed. The existing
    // controller useEffect-based scrub stays as a fallback.
  }
}
