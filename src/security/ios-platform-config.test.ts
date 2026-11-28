import appJson from "../../app.json";
import { applyPinnedDomains } from "../../plugins/withIosPinnedDomains";

// An independent copy of the pin table in docs/sync-trust-model.md.
const MANAGED_HOSTS = ["managed.ovumcy.cloud", "sync.ovumcy.cloud"];
const ISRG_ROOT_PINS = [
  "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // ISRG Root X1
  "diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=", // ISRG Root X2
  "fk6IOKit1ild5647BH06ujSIq5XbCgqlbYl6ANhhi88=", // ISRG Root YR
  "sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=", // ISRG Root YE
];

type PinnedDomain = {
  NSIncludesSubdomains?: boolean;
  NSPinnedCAIdentities?: Record<string, string>[];
  NSPinnedLeafIdentities?: unknown;
};
type Ats = Record<string, unknown> & { NSPinnedDomains?: Record<string, PinnedDomain> };
type Plist = Record<string, unknown> & { NSAppTransportSecurity?: Ats };

function apply(plist: Plist): Plist {
  return applyPinnedDomains(plist) as Plist;
}

describe("iOS App Transport Security root pinning", () => {
  it("pins both managed hosts, without subdomains, to exactly the four ISRG root keys", () => {
    const pinned = apply({}).NSAppTransportSecurity?.NSPinnedDomains ?? {};

    expect(Object.keys(pinned).sort()).toEqual(MANAGED_HOSTS);
    for (const host of MANAGED_HOSTS) {
      const entry = pinned[host];
      expect(entry?.NSIncludesSubdomains).toBe(false);
      expect(entry?.NSPinnedCAIdentities).toEqual(
        ISRG_ROOT_PINS.map((pin) => ({ "SPKI-SHA256-BASE64": pin })),
      );
      // Root (CA) identities only: no leaf pin, whose key changes on every ACME renewal.
      expect(entry).not.toHaveProperty("NSPinnedLeafIdentities");
    }
  });

  it("merges into an existing App Transport Security dictionary and keeps its keys", () => {
    const before: Plist = {
      CFBundleName: "Ovumcy",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: { localhost: { NSExceptionAllowsInsecureHTTPLoads: true } },
        NSPinnedDomains: {
          "example.org": { NSIncludesSubdomains: true, NSPinnedCAIdentities: [] },
        },
      },
    };

    const after = apply(before);
    const ats = after.NSAppTransportSecurity;

    expect(after.CFBundleName).toBe("Ovumcy");
    expect(ats?.NSAllowsArbitraryLoads).toBe(false);
    expect(ats?.NSAllowsLocalNetworking).toBe(true);
    expect(ats?.NSExceptionDomains).toEqual({
      localhost: { NSExceptionAllowsInsecureHTTPLoads: true },
    });
    expect(Object.keys(ats?.NSPinnedDomains ?? {}).sort()).toEqual([
      "example.org",
      ...MANAGED_HOSTS,
    ]);
    expect(ats?.NSPinnedDomains?.["example.org"]).toEqual({
      NSIncludesSubdomains: true,
      NSPinnedCAIdentities: [],
    });
  });

  it("replaces a stale entry for a managed host with the committed pin set", () => {
    const after = apply({
      NSAppTransportSecurity: {
        NSPinnedDomains: {
          "sync.ovumcy.cloud": {
            NSIncludesSubdomains: true,
            NSPinnedLeafIdentities: [{ "SPKI-SHA256-BASE64": "stale" }],
          },
        },
      },
    });

    const entry = after.NSAppTransportSecurity?.NSPinnedDomains?.["sync.ovumcy.cloud"];
    expect(entry?.NSIncludesSubdomains).toBe(false);
    expect(entry).not.toHaveProperty("NSPinnedLeafIdentities");
    expect(entry?.NSPinnedCAIdentities?.map((identity) => identity["SPKI-SHA256-BASE64"])).toEqual(
      ISRG_ROOT_PINS,
    );
  });

  it("is wired into the app config", () => {
    const entries = appJson.expo.plugins.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
    expect(entries).toContain("./plugins/withIosPinnedDomains");
  });
});
