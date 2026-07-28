import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { createDefaultProfileRecord } from "../../../models/profile";
import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import { loadPregnancyModuleOwned } from "../../../services/pregnancy-entitlement-service";
import { addDays, parseLocalDate } from "../../../services/profile-settings-policy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { PregnancyStartFlowScreen } from "./PregnancyStartFlowScreen";
import { PregnancyStartScreen, resolveStartError } from "./PregnancyStartScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}));

jest.mock("../../../services/pregnancy-entitlement-service", () => {
  const actual = jest.requireActual(
    "../../../services/pregnancy-entitlement-service",
  );
  return {
    ...actual,
    loadPregnancyModuleOwned: jest.fn().mockResolvedValue(true),
  };
});

// The default-wiring smoke renders without an injected storage; the real
// appStorage is the SQLite adapter, which has no backing database under Jest,
// so the bootstrap module resolves to an empty storage mock instead.
jest.mock("../../../services/app-bootstrap-service", () => {
  const { createLocalAppStorageMock } = jest.requireActual(
    "../../../test/create-local-app-storage-mock",
  );
  return { appStorage: createLocalAppStorageMock() };
});

const mockUnlocked = jest.mocked(loadPregnancyModuleOwned);

const EDD = "2026-10-08";

function nowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(EDD)!, gaDays - 280);
}

function profileWithLmp() {
  return { ...createDefaultProfileRecord(), lastPeriodStart: "2026-01-01" };
}

function renderStart(storage = createLocalAppStorageMock(), now = nowForGaDays(171)) {
  return render(
    <AppPreferencesTestProvider languageOverride="en">
      <PregnancyStartScreen now={now} storage={storage} />
    </AppPreferencesTestProvider>,
  );
}

describe("PregnancyStartScreen", () => {
  afterEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
    mockUnlocked.mockReset();
    mockUnlocked.mockResolvedValue(true);
  });

  it("prefills the LMP date from the profile last period start", async () => {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
    });
    renderStart(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));

    const input = screen.getByTestId("pregnancy-start-date-input");
    expect(input.props.value).toBe("2026-01-01");
  });

  it("switches the date field to the EDD prefill when the ultrasound basis is chosen", async () => {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
    });
    renderStart(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-start-basis-ultrasound"));
    fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));

    expect(screen.getByTestId("pregnancy-start-date-input").props.value).toBe(EDD);
  });

  it("shows a live EDD and W+D preview on the date step", async () => {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
    });
    renderStart(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));

    expect(screen.getByTestId("pregnancy-start-preview-ga").props.children).toBe(
      "24+3",
    );
    expect(screen.getByTestId("pregnancy-start-preview-edd")).toBeTruthy();
  });

  it("renders the pregnancy disclaimer on the wizard", async () => {
    renderStart(
      createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
      }),
    );

    expect(await screen.findByTestId("pregnancy-start-disclaimer")).toBeTruthy();
  });

  it("starts the pregnancy and navigates to the dashboard on confirm", async () => {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
      readActivePregnancy: jest.fn().mockResolvedValue(null),
    });
    renderStart(storage);

    fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
    fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
    fireEvent.press(await screen.findByTestId("pregnancy-start-confirm-button"));

    await screen.findByTestId("pregnancy-start-confirm-step");
    // startPregnancy persisted the record and the container replaced to dashboard.
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
      expect.objectContaining({ edd: EDD, eddBasis: "lmp", status: "active" }),
    );
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  describe("multiples", () => {
    it("skip-path: never touching the multiples question yields a singleton record identical to today (pin)", async () => {
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      renderStart(storage);

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-confirm-button"));

      await screen.findByTestId("pregnancy-start-confirm-step");
      expect(storage.writePregnancyRecord).toHaveBeenCalledTimes(1);
      const persisted = jest.mocked(storage.writePregnancyRecord).mock.calls[0]![0];
      expect(persisted).toEqual(
        expect.objectContaining({ edd: EDD, eddBasis: "lmp", status: "active" }),
      );
      // Pin: the record shape is byte-identical to a singleton record -- no
      // fetusCount/chorionicity keys at all, not even undefined.
      expect(Object.prototype.hasOwnProperty.call(persisted, "fetusCount")).toBe(
        false,
      );
      expect(
        Object.prototype.hasOwnProperty.call(persisted, "chorionicity"),
      ).toBe(false);
    });

    it("explicitly choosing 'One' also yields a singleton record with no fetusCount key", async () => {
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      renderStart(storage);

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-fetus-count-1"));
      fireEvent.press(screen.getByTestId("pregnancy-start-confirm-button"));

      await screen.findByTestId("pregnancy-start-confirm-step");
      const persisted = jest.mocked(storage.writePregnancyRecord).mock.calls[0]![0];
      expect(Object.prototype.hasOwnProperty.call(persisted, "fetusCount")).toBe(
        false,
      );
    });

    it("hides the chorionicity question until Twins/Triplets is chosen", async () => {
      renderStart(
        createLocalAppStorageMock({
          readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
        }),
      );

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      await screen.findByTestId("pregnancy-start-confirm-step");

      expect(
        screen.queryByTestId("pregnancy-start-chorionicity-group"),
      ).toBeNull();

      fireEvent.press(screen.getByTestId("pregnancy-start-fetus-count-2"));
      expect(
        await screen.findByTestId("pregnancy-start-chorionicity-group"),
      ).toBeTruthy();
    });

    it("twins path: sets fetusCount and chorionicity on the persisted record", async () => {
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      renderStart(storage);

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-fetus-count-2"));
      fireEvent.press(
        await screen.findByTestId("pregnancy-start-chorionicity-mcda"),
      );
      fireEvent.press(screen.getByTestId("pregnancy-start-confirm-button"));

      await screen.findByTestId("pregnancy-start-confirm-step");
      expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
        expect.objectContaining({ fetusCount: 2, chorionicity: "mcda" }),
      );
    });

    it("triplets-or-more path sets fetusCount 3", async () => {
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      renderStart(storage);

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-fetus-count-3"));
      fireEvent.press(screen.getByTestId("pregnancy-start-confirm-button"));

      await screen.findByTestId("pregnancy-start-confirm-step");
      expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
        expect.objectContaining({ fetusCount: 3 }),
      );
    });

    it("reverting from Twins back to One clears the chosen chorionicity", async () => {
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      renderStart(storage);

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-fetus-count-2"));
      fireEvent.press(
        await screen.findByTestId("pregnancy-start-chorionicity-dcda"),
      );
      fireEvent.press(screen.getByTestId("pregnancy-start-fetus-count-1"));
      fireEvent.press(screen.getByTestId("pregnancy-start-confirm-button"));

      await screen.findByTestId("pregnancy-start-confirm-step");
      const persisted = jest.mocked(storage.writePregnancyRecord).mock.calls[0]![0];
      expect(Object.prototype.hasOwnProperty.call(persisted, "fetusCount")).toBe(
        false,
      );
      expect(
        Object.prototype.hasOwnProperty.call(persisted, "chorionicity"),
      ).toBe(false);
    });
  });

  it("renders the premium lock card and no form when locked", async () => {
    mockUnlocked.mockResolvedValue(false);
    renderStart(
      createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue(profileWithLmp()),
      }),
    );

    const lock = await screen.findByTestId("pregnancy-start-lock-title");
    expect(lock.props.children).toBe(getPregnancyCopy("en").entryCard.lockedTitle);
    expect(screen.queryByTestId("pregnancy-start-basis-step")).toBeNull();
    expect(screen.getByTestId("pregnancy-start-disclaimer")).toBeTruthy();

    // Info-only until the purchase flow ships: pressing the lock never routes
    // to plan options — the module is a one-time unlock, not a subscription.
    fireEvent.press(screen.getByTestId("pregnancy-start-lock"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  describe("wizard edges and failure paths", () => {
    it("validates a missing and an out-of-range date without leaving the step", async () => {
      renderStart();

      // Straight to Next with an empty date: required-date validation.
      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      expect(
        await screen.findByTestId("pregnancy-start-error"),
      ).toBeTruthy();

      // A far-future LMP is rejected as out of range, still on the date step.
      fireEvent.changeText(
        screen.getByTestId("pregnancy-start-date-input"),
        "2030-01-01",
      );
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      expect(await screen.findByTestId("pregnancy-start-error")).toBeTruthy();
      expect(screen.getByTestId("pregnancy-start-date-step")).toBeTruthy();
    });

    it("steps back through the wizard and leaves the screen from step one", async () => {
      renderStart();

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-back-button"));
      // Back from the date step lands on the basis step, where leaving is an
      // explicit cancel.
      fireEvent.press(await screen.findByTestId("pregnancy-start-cancel-button"));
      expect(mockBack).toHaveBeenCalled();
    });

    it("surfaces a failed save on the confirm step", async () => {
      const storage = createLocalAppStorageMock({
        writePregnancyRecord: jest.fn().mockRejectedValue(new Error("busy")),
      });
      renderStart(storage);

      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      fireEvent.changeText(
        await screen.findByTestId("pregnancy-start-date-input"),
        "2026-01-01",
      );
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      fireEvent.press(await screen.findByTestId("pregnancy-start-confirm-button"));

      expect(await screen.findByTestId("pregnancy-start-error")).toBeTruthy();
    });

    it("validates missing and malformed dates on the ultrasound basis and steps back from confirm", async () => {
      const copy = getPregnancyCopy("en");
      renderStart();

      fireEvent.press(
        await screen.findByTestId("pregnancy-start-basis-ultrasound"),
      );
      expect(screen.getByText(copy.wizard.basisOptions.ultrasoundHint)).toBeTruthy();
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));

      // Empty EDD input: the required-date validation on the non-LMP branch.
      fireEvent.press(await screen.findByTestId("pregnancy-start-next-button"));
      expect(
        await screen.findByText(copy.wizard.validation.missingDate),
      ).toBeTruthy();

      // Malformed input is rejected as an invalid date, still on the step.
      fireEvent.changeText(
        screen.getByTestId("pregnancy-start-date-input"),
        "not-a-date",
      );
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      expect(
        await screen.findByText(copy.wizard.validation.invalidDate),
      ).toBeTruthy();

      // A valid EDD advances to confirm; Back returns to the date step.
      fireEvent.changeText(
        screen.getByTestId("pregnancy-start-date-input"),
        EDD,
      );
      fireEvent.press(screen.getByTestId("pregnancy-start-next-button"));
      await screen.findByTestId("pregnancy-start-confirm-step");
      fireEvent.press(screen.getByTestId("pregnancy-start-back-button"));
      expect(await screen.findByTestId("pregnancy-start-date-step")).toBeTruthy();
    });

    it("shows the manual-basis hint when the manual basis is selected", async () => {
      renderStart();

      fireEvent.press(await screen.findByTestId("pregnancy-start-basis-manual"));
      expect(
        screen.getByText(getPregnancyCopy("en").wizard.basisOptions.manualHint),
      ).toBeTruthy();
    });
  });

  it("unmounts cleanly while the initial load is still in flight", async () => {
    let resolveProfile: (value: unknown) => void = () => {};
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
      ),
    });
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const view = renderStart(storage);
    // The load is genuinely mid-flight: the read was issued and left pending.
    expect(storage.readProfileRecord).toHaveBeenCalledTimes(1);

    expect(() => view.unmount()).not.toThrow();
    resolveProfile(profileWithLmp());
    await act(async () => {});

    // The load resolves onto a torn-down tree: nothing is rendered and React
    // reports no error.
    expect(screen.toJSON()).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("renders with default wiring when no storage or clock is injected", async () => {
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <PregnancyStartScreen />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("pregnancy-start-basis-step")).toBeTruthy();
  });

});

describe("resolveStartError", () => {
  it("maps every start error code to its wizard validation copy", () => {
    const copy = getPregnancyCopy("en");
    expect(resolveStartError("active_pregnancy_exists", copy)).toBe(
      copy.wizard.validation.activeExists,
    );
    expect(resolveStartError("missing_date", copy)).toBe(
      copy.wizard.validation.missingDate,
    );
    expect(resolveStartError("invalid_date", copy)).toBe(
      copy.wizard.validation.invalidDate,
    );
    expect(resolveStartError("out_of_range", copy)).toBe(
      copy.wizard.validation.outOfRange,
    );
    expect(resolveStartError("save_failed", copy)).toBe(
      copy.wizard.validation.saveFailed,
    );
  });
});

describe("PregnancyStartFlowScreen direct states", () => {
  const noop = () => {};

  function flowProps() {
    return {
      language: "en",
      locked: false,
      step: 1 as const,
      basis: "lmp" as const,
      dateValue: "",
      preview: {
        edd: null,
        eddLabel: null,
        weeks: null,
        days: null,
        gaLabel: null,
      },
      error: "",
      isSaving: false,
      onBasisSelect: noop,
      onDateChange: noop,
      onBack: noop,
      onNext: noop,
      onConfirm: noop,
      onCancel: noop,
      fetusCount: undefined,
      chorionicity: undefined,
      onFetusCountSelect: noop,
      onChorionicitySelect: noop,
    };
  }

  it("renders the locked card with a CTA when a premium CTA handler is wired", () => {
    const onPremiumCTAPress = jest.fn();
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <PregnancyStartFlowScreen
          {...flowProps()}
          locked
          onPremiumCTAPress={onPremiumCTAPress}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("pregnancy-start-lock-cta").props.children).toBe(
      getPregnancyCopy("en").entryCard.lockedCta,
    );
    fireEvent.press(screen.getByTestId("pregnancy-start-lock"));
    expect(onPremiumCTAPress).toHaveBeenCalled();
  });

  it("renders an empty confirm summary when the preview has no computed dates", () => {
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <PregnancyStartFlowScreen {...flowProps()} step={3} />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("pregnancy-start-confirm-edd").props.children,
    ).toBe("");
  });
});
