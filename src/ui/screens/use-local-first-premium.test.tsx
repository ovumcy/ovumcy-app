import { act, renderHook } from "@testing-library/react-native";

import { EMPTY_MANAGED_PREMIUM_FEATURES } from "../../services/managed-premium-features-service";
import type { ManagedCloudPremiumFeatures } from "../../sync/managed-cloud-api-client";
import { useLocalFirstPremium } from "./use-local-first-premium";

const UNLOCKED: ManagedCloudPremiumFeatures = {
  ...EMPTY_MANAGED_PREMIUM_FEATURES,
  advancedFertility: true,
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useLocalFirstPremium", () => {
  it("applies the locked local state before premium resolves, then the unlocked one", async () => {
    const { result } = await renderHook(() => useLocalFirstPremium());
    const premium = deferred<ManagedCloudPremiumFeatures>();
    const applied: boolean[] = [];

    await act(async () => {
      await result.current({
        loadLocal: async (features) => features.advancedFertility,
        loadPremium: () => premium.promise,
        apply: (state) => applied.push(state),
      });
    });
    expect(applied).toEqual([false]);

    premium.resolve(UNLOCKED);
    await flush();
    expect(applied).toEqual([false, true]);
  });

  it("starts the next pass from the last resolved answer and skips an unchanged reload", async () => {
    const { result } = await renderHook(() => useLocalFirstPremium());
    const loadLocal = jest.fn(async (features: ManagedCloudPremiumFeatures) =>
      features.advancedFertility,
    );
    const applied: boolean[] = [];
    const apply = (state: boolean) => applied.push(state);

    await act(async () => {
      await result.current({ loadLocal, loadPremium: async () => UNLOCKED, apply });
    });
    await flush();
    expect(applied).toEqual([false, true]);

    await act(async () => {
      await result.current({ loadLocal, loadPremium: async () => UNLOCKED, apply });
    });
    await flush();
    expect(applied).toEqual([false, true, true]);
    expect(loadLocal).toHaveBeenCalledTimes(3);
  });

  it("resolves locked when the premium load throws", async () => {
    const { result } = await renderHook(() => useLocalFirstPremium());
    const applied: boolean[] = [];
    const apply = (state: boolean) => applied.push(state);
    const loadLocal = async (features: ManagedCloudPremiumFeatures) =>
      features.advancedFertility;

    await act(async () => {
      await result.current({ loadLocal, loadPremium: async () => UNLOCKED, apply });
    });
    await flush();
    await act(async () => {
      await result.current({
        loadLocal,
        loadPremium: async () => {
          throw new Error("offline");
        },
        apply,
      });
    });
    await flush();

    expect(applied).toEqual([false, true, true, false]);
  });

  it("keeps the local render when the premium-phase reload fails", async () => {
    const { result } = await renderHook(() => useLocalFirstPremium());
    const applied: boolean[] = [];

    await act(async () => {
      await result.current({
        loadLocal: async (features) => {
          if (features.advancedFertility) {
            throw new Error("storage");
          }
          return false;
        },
        loadPremium: async () => UNLOCKED,
        apply: (state) => applied.push(state),
      });
    });
    await flush();

    expect(applied).toEqual([false]);
  });

  it("does not apply a superseded pass's late local state", async () => {
    const { result } = await renderHook(() => useLocalFirstPremium());
    const slowLocal = deferred<string>();
    const applied: string[] = [];
    let firstPass: Promise<string> = Promise.resolve("");

    await act(async () => {
      firstPass = result.current({
        loadLocal: () => slowLocal.promise,
        loadPremium: async () => EMPTY_MANAGED_PREMIUM_FEATURES,
        apply: (state) => applied.push(state),
      });
      await result.current({
        loadLocal: async () => "second",
        loadPremium: async () => EMPTY_MANAGED_PREMIUM_FEATURES,
        apply: (state) => applied.push(state),
      });
    });
    slowLocal.resolve("first");
    await act(async () => {
      await firstPass;
    });

    expect(applied).toEqual(["second"]);
  });

  it("discards a superseded pass's late premium answer", async () => {
    const { result } = await renderHook(() => useLocalFirstPremium());
    const stale = deferred<ManagedCloudPremiumFeatures>();
    const applied: string[] = [];

    await act(async () => {
      await result.current({
        loadLocal: async (features) => `first:${features.advancedFertility}`,
        loadPremium: () => stale.promise,
        apply: (state) => applied.push(state),
      });
    });
    await act(async () => {
      await result.current({
        loadLocal: async (features) => `second:${features.advancedFertility}`,
        loadPremium: async () => EMPTY_MANAGED_PREMIUM_FEATURES,
        apply: (state) => applied.push(state),
      });
    });
    stale.resolve(UNLOCKED);
    await flush();

    expect(applied).toEqual(["first:false", "second:false"]);
  });

  it("applies nothing after unmount", async () => {
    const { result, unmount } = await renderHook(() => useLocalFirstPremium());
    const premium = deferred<ManagedCloudPremiumFeatures>();
    const applied: boolean[] = [];

    await act(async () => {
      await result.current({
        loadLocal: async (features) => features.advancedFertility,
        loadPremium: () => premium.promise,
        apply: (state) => applied.push(state),
      });
    });
    await unmount();
    premium.resolve(UNLOCKED);
    await flush();

    expect(applied).toEqual([false]);
  });

  it("drops the premium-phase reload that settles after unmount", async () => {
    const { result, unmount } = await renderHook(() => useLocalFirstPremium());
    const upgraded = deferred<boolean>();
    const applied: boolean[] = [];

    await act(async () => {
      await result.current({
        loadLocal: (features) =>
          features.advancedFertility ? upgraded.promise : Promise.resolve(false),
        loadPremium: async () => UNLOCKED,
        apply: (state) => applied.push(state),
      });
    });
    await flush();
    await unmount();
    upgraded.resolve(true);
    await flush();

    expect(applied).toEqual([false]);
  });
});
