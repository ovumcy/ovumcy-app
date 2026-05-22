import { stashManagedPartnerInviteToken } from "./managed-partner-invite-token-buffer";

// F9: On RN-Web the URL bar would briefly show the invite_token between
// page load and the route handler's scrub effect (one paint window). Pull
// the token out of window.location synchronously, before expo-router
// commits any state — so the token never reaches window.history, browser
// autocomplete, devtools, or screen recordings. No-op on native (no
// window) and when the URL does not carry an invite_token.
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
    if (rawToken === null) {
      return;
    }
    const trimmed = rawToken.trim();
    if (trimmed.length > 0) {
      stashManagedPartnerInviteToken(trimmed);
    }
    url.searchParams.delete("invite_token");
    const nextQuery = url.searchParams.toString();
    const scrubbed =
      url.pathname + (nextQuery.length > 0 ? `?${nextQuery}` : "") + url.hash;
    history.replaceState(history.state, "", scrubbed);
  } catch {
    // Best-effort: URL parsing or history mutation failed. The existing
    // controller useEffect-based scrub stays as a fallback.
  }
}
