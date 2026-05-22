// F9 bootstrap: imported from index.js as the very first JS module so the
// scrub runs before @expo/metro-runtime, expo-router, or any layout code
// has a chance to read window.location. Keeping the side-effect in its
// own file (instead of inlining at index.js call sites) prevents lint /
// import-sort tooling from reordering the import behind other entries.
import { scrubManagedPartnerInviteTokenFromWebUrl } from "./web-invite-token-scrub";

scrubManagedPartnerInviteTokenFromWebUrl();
