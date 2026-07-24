import { act, render, waitFor } from "@testing-library/react-native";

import { createPregnancyRecord } from "../../../models/pregnancy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { KickCounterFlowScreenProps } from "./KickCounterFlowScreen";
import { KickCounterScreen } from "./KickCounterScreen";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

// The presentational flow screen is replaced with a prop recorder so the
// container's defensive handler guards can be exercised in states the real
// UI's disabled buttons never produce (finish/discard while idle, a history
// delete landing when no pregnancy is active). The regular screen tests keep
// covering the real composed UI.
let mockFlowProps: KickCounterFlowScreenProps | null = null;
jest.mock("./KickCounterFlowScreen", () => ({
  KickCounterFlowScreen: (props: unknown) => {
    mockFlowProps = props as KickCounterFlowScreenProps;
    return null;
  },
}));

const mockOpenConfirmation = jest.mocked(openConfirmation);

function activeRecord() {
  return createPregnancyRecord({
    edd: "2026-10-08",
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
  });
}

function renderKickCounter(storage = createLocalAppStorageMock()) {
  return render(
    <AppPreferencesTestProvider languageOverride="en">
      <KickCounterScreen
        now={new Date("2026-07-20T10:00:00.000Z")}
        storage={storage}
      />
    </AppPreferencesTestProvider>,
  );
}

async function flowReady(): Promise<KickCounterFlowScreenProps> {
  await waitFor(() => expect(mockFlowProps).not.toBeNull());
  return mockFlowProps!;
}

describe("KickCounterScreen handler guards", () => {
  beforeEach(() => {
    mockFlowProps = null;
  });

  afterEach(() => {
    mockOpenConfirmation.mockReset();
  });

  it("ignores a finish fired while no counting session is in progress", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    renderKickCounter(storage);
    const props = await flowReady();

    await act(async () => {
      await props.onFinish();
    });

    expect(storage.writeKickSession).not.toHaveBeenCalled();
    expect(mockFlowProps?.sessionPhase).toBe("idle");
  });

  it("ignores a discard fired while no counting session is in progress", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    renderKickCounter(storage);
    const props = await flowReady();

    await act(async () => {
      await props.onDiscard();
    });

    expect(mockOpenConfirmation).not.toHaveBeenCalled();
  });

  it("clears the session list when a history delete lands with no active pregnancy", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
    });
    mockOpenConfirmation.mockResolvedValue(true);
    renderKickCounter(storage);
    const props = await flowReady();

    await act(async () => {
      await props.onDeleteSession("kick-1");
    });

    expect(storage.deleteKickSession).toHaveBeenCalledWith("kick-1");
    // With no pregnancy there is no session window to re-list: the refresh
    // settles on an empty list without a storage read.
    expect(storage.listKickSessions).not.toHaveBeenCalled();
  });
});
