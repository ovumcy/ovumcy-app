import { fireEvent, render, screen } from "@testing-library/react-native";

import { createDefaultProfileRecord } from "../../../models/profile";
import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import { loadPregnancyModuleOwned } from "../../../services/pregnancy-entitlement-service";
import { addDays, parseLocalDate } from "../../../services/profile-settings-policy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { PregnancyStartScreen } from "./PregnancyStartScreen";

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
      // Pin: the record shape is byte-identical to a pre-Y0 record -- no
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
  });

});
