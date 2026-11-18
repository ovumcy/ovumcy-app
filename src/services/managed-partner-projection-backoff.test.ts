import {
  backOffManagedPartnerProjectionPush,
  isManagedPartnerProjectionPushBackedOff,
  resetManagedPartnerProjectionPushBackoff,
} from "./managed-partner-projection-backoff";

const T0 = Date.parse("2026-11-18T08:00:00.000Z");

describe("managed partner projection push back-off", () => {
  afterEach(() => {
    resetManagedPartnerProjectionPushBackoff();
  });

  it("is open until a 429 arms it", () => {
    expect(isManagedPartnerProjectionPushBackedOff(T0)).toBe(false);
  });

  it("holds for the server's Retry-After and then reopens", () => {
    backOffManagedPartnerProjectionPush(20, T0);

    expect(isManagedPartnerProjectionPushBackedOff(T0 + 19_999)).toBe(true);
    expect(isManagedPartnerProjectionPushBackedOff(T0 + 20_000)).toBe(false);
  });

  it("defaults to 60s without a usable Retry-After", () => {
    backOffManagedPartnerProjectionPush(undefined, T0);

    expect(isManagedPartnerProjectionPushBackedOff(T0 + 59_000)).toBe(true);
    expect(isManagedPartnerProjectionPushBackedOff(T0 + 60_000)).toBe(false);
  });

  it("caps a huge Retry-After at 15 minutes and floors zero at one second", () => {
    backOffManagedPartnerProjectionPush(86_400, T0);
    expect(isManagedPartnerProjectionPushBackedOff(T0 + 15 * 60_000 - 1)).toBe(true);
    expect(isManagedPartnerProjectionPushBackedOff(T0 + 15 * 60_000)).toBe(false);

    backOffManagedPartnerProjectionPush(0, T0);
    expect(isManagedPartnerProjectionPushBackedOff(T0 + 999)).toBe(true);
    expect(isManagedPartnerProjectionPushBackedOff(T0 + 1_000)).toBe(false);
  });

  it("reopens when the clock moved backwards past the cap", () => {
    backOffManagedPartnerProjectionPush(60, T0);

    expect(isManagedPartnerProjectionPushBackedOff(T0 - 60 * 60_000)).toBe(false);
    expect(isManagedPartnerProjectionPushBackedOff(T0 + 1_000)).toBe(false);
  });
});
