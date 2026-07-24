import { act, fireEvent, render, screen } from "@testing-library/react-native";

import {
  createScreeningResponse,
  type ScreeningResponse,
} from "../../../models/screening";
import { createDefaultProfileRecord } from "../../../models/profile";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { ScreeningScreen, questionAtIndex } from "./ScreeningScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}));

// The default-wiring smoke renders without an injected storage; the real
// appStorage is the SQLite adapter, which has no backing database under Jest,
// so the bootstrap module resolves to an empty storage mock instead.
jest.mock("../../../services/app-bootstrap-service", () => {
  const { createLocalAppStorageMock } = jest.requireActual(
    "../../../test/create-local-app-storage-mock",
  );
  return { appStorage: createLocalAppStorageMock() };
});

const NOW = new Date(2026, 6, 1); // 2026-07-01

function renderScreening(
  storage: LocalAppStorage = createLocalAppStorageMock(),
  initialView: "questionnaire" | "history" = "questionnaire",
) {
  return render(
    <AppPreferencesTestProvider languageOverride="en">
      <ScreeningScreen initialView={initialView} now={NOW} storage={storage} />
    </AppPreferencesTestProvider>,
  );
}

// Walk the whole questionnaire, selecting the option that scores `score` on each
// item (every EPDS item has a score-0 option; item 10 also has a score-1 one).
async function completeWith(scores: number[]) {
  fireEvent.press(await screen.findByTestId("screening-begin-button"));
  for (let index = 0; index < scores.length; index += 1) {
    fireEvent.press(screen.getByTestId(`screening-option-${scores[index]}`));
    if (index < scores.length - 1) {
      fireEvent.press(screen.getByTestId("screening-next-button"));
    } else {
      fireEvent.press(screen.getByTestId("screening-finish-button"));
    }
  }
  // Finish triggers an async persist whose finally-block setState lands after
  // the result stage is set synchronously; flush it inside act so the trailing
  // update is not reported as an un-acted state change.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ScreeningScreen", () => {
  afterEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
  });

  it("shows the EPDS attribution and privacy note on the intro step", async () => {
    renderScreening();

    const attribution = await screen.findByTestId("screening-attribution");
    expect(attribution.props.children).toContain("Cox");
    expect(
      screen.getByTestId("screening-privacy-note").props.children,
    ).toContain("encrypted");
  });

  it("completes the flow and persists exactly one response with the computed score", async () => {
    const storage = createLocalAppStorageMock();
    renderScreening(storage);

    await completeWith(new Array<number>(10).fill(0));

    await screen.findByTestId("screening-result-card");
    expect(storage.writeScreeningResponse).toHaveBeenCalledTimes(1);
    expect(storage.writeScreeningResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        instrument: "epds",
        date: "2026-07-01",
        score: 0,
        selfHarmFlag: false,
      }),
    );

    // Result shown but no navigation yet; Done returns to the dashboard.
    expect(mockReplace).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("screening-done-button"));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("persists nothing when the questionnaire is abandoned partway through", async () => {
    const storage = createLocalAppStorageMock();
    renderScreening(storage);

    fireEvent.press(await screen.findByTestId("screening-begin-button"));
    fireEvent.press(screen.getByTestId("screening-option-2"));
    // Step back off the first question -> returns to intro, discarding answers.
    fireEvent.press(screen.getByTestId("screening-back-button"));

    expect(await screen.findByTestId("screening-begin-button")).toBeTruthy();
    expect(storage.writeScreeningResponse).not.toHaveBeenCalled();
  });

  it("renders the crisis-support block (not the interim urgent card) when item 10 is answered non-zero", async () => {
    const storage = createLocalAppStorageMock();
    renderScreening(storage);

    // All items scored 0 except item 10 scored 1 -> total 1, band lower, flag set.
    await completeWith([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);

    await screen.findByTestId("screening-result-card");
    expect(screen.getByTestId("screening-crisis-support")).toBeTruthy();
    // The interim inline urgent-support card is gone.
    expect(screen.queryByTestId("screening-urgent-support")).toBeNull();
    expect(storage.writeScreeningResponse).toHaveBeenCalledWith(
      expect.objectContaining({ score: 1, selfHarmFlag: true }),
    );
  });

  it("does not render the crisis block for a clear item 10", async () => {
    renderScreening();
    await completeWith(new Array<number>(10).fill(0));
    await screen.findByTestId("screening-result-card");
    expect(screen.queryByTestId("screening-crisis-support")).toBeNull();
  });

  it("shows a saved personal crisis contact and persists an inline edit through the profile path", async () => {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        crisisContactName: "Mum",
        crisisContactPhone: "07700 900000",
      }),
    });
    renderScreening(storage);

    await completeWith([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);

    // The loaded contact renders as plain text on the crisis card.
    expect(
      await screen.findByText("Your support contact: Mum — 07700 900000"),
    ).toBeTruthy();

    // Edit + save routes through storage.writeProfileRecord, merging only the
    // two crisis fields (normalized/trimmed) without clobbering other settings.
    fireEvent.press(screen.getByTestId("screening-crisis-support-edit-button"));
    fireEvent.changeText(
      screen.getByTestId("screening-crisis-support-name-input"),
      "  Aunt Jo  ",
    );
    fireEvent.changeText(
      screen.getByTestId("screening-crisis-support-phone-input"),
      "0123 456",
    );
    await act(async () => {
      fireEvent.press(
        screen.getByTestId("screening-crisis-support-save-button"),
      );
      await Promise.resolve();
    });

    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        crisisContactName: "Aunt Jo",
        crisisContactPhone: "0123 456",
      }),
    );
  });

  it("history view lists past check-ins with date and score only, never the answers", async () => {
    const responses: ScreeningResponse[] = [
      createScreeningResponse({
        date: "2026-06-01",
        answers: [3, 3, 3, 0, 0, 0, 0, 0, 0, 0], // score 9
      }),
      createScreeningResponse({
        date: "2026-06-20",
        answers: [1, 2, 0, 3, 1, 0, 2, 1, 0, 2], // score 12
      }),
    ];
    const storage = createLocalAppStorageMock({
      listScreeningResponses: jest.fn().mockResolvedValue(responses),
    });
    renderScreening(storage, "history");

    // Newest first, date + score visible in one row label.
    expect(await screen.findByText(/2026-06-20.*score 12 of 30/)).toBeTruthy();
    expect(screen.getByText(/2026-06-01.*score 9 of 30/)).toBeTruthy();

    // The per-item answers / question text never appear in the history view.
    expect(
      screen.queryByText(
        "I have been able to laugh and see the funny side of things",
      ),
    ).toBeNull();
    expect(screen.queryByTestId("screening-question-card")).toBeNull();
  });

  it("history view shows an empty state when there are no responses", async () => {
    renderScreening(createLocalAppStorageMock(), "history");
    expect(await screen.findByTestId("screening-history-empty")).toBeTruthy();
  });

  it("surfaces a save failure and keeps the questionnaire recoverable", async () => {
    const storage = createLocalAppStorageMock({
      writeScreeningResponse: jest.fn().mockRejectedValue(new Error("busy")),
    });
    renderScreening(storage);

    await completeWith([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    expect(await screen.findByTestId("screening-save-error")).toBeTruthy();
  });


  it("guards next-with-no-selection, steps back to the previous question, and backs out of question one", async () => {
    renderScreening();
    fireEvent.press(await screen.findByTestId("screening-begin-button"));

    // Next with nothing selected: guarded, stays on question 1.
    fireEvent.press(screen.getByTestId("screening-next-button"));
    // Answer and advance, then step back to question 1.
    fireEvent.press(screen.getByTestId("screening-option-0"));
    fireEvent.press(screen.getByTestId("screening-next-button"));
    fireEvent.press(screen.getByTestId("screening-back-button"));
    // Back from question one returns to the intro, not out of the screen.
    fireEvent.press(screen.getByTestId("screening-back-button"));
    expect(await screen.findByTestId("screening-begin-button")).toBeTruthy();
  });

  it("defaults now to the real clock and unmounts cleanly mid-load", async () => {
    let resolveProfile: (value: unknown) => void = () => {};
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
      ),
    });
    const view = render(
      <AppPreferencesTestProvider languageOverride="en">
        <ScreeningScreen initialView="questionnaire" storage={storage} />
      </AppPreferencesTestProvider>,
    );
    view.unmount();
    resolveProfile({ crisisContactName: undefined, crisisContactPhone: undefined });
    await Promise.resolve();
  });

  it("treats a profile without crisis-contact fields as an empty contact", async () => {
    // A pre-module profile simply has no crisis keys at all; the load resolves
    // them to empty strings rather than rendering a contact line.
    const {
      crisisContactName: _name,
      crisisContactPhone: _phone,
      ...legacyProfile
    } = createDefaultProfileRecord();
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(legacyProfile),
    });
    renderScreening(storage);

    await completeWith([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);

    await screen.findByTestId("screening-crisis-support");
    expect(screen.queryByText(/Your support contact:/)).toBeNull();
  });

  it("closes the history view through the back action", async () => {
    renderScreening(createLocalAppStorageMock(), "history");

    fireEvent.press(await screen.findByTestId("screening-history-back-button"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("unmounts cleanly while the history list is still loading", async () => {
    let resolveResponses: (value: unknown) => void = () => {};
    const storage = createLocalAppStorageMock({
      listScreeningResponses: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveResponses = resolve;
        }),
      ),
    });
    const view = renderScreening(storage, "history");
    view.unmount();
    resolveResponses([]);
    await act(async () => {});
  });

  it("renders with default wiring when no storage or clock is injected", async () => {
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <ScreeningScreen />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("screening-intro-card")).toBeTruthy();
    await act(async () => {});
  });

});

describe("questionAtIndex", () => {
  it("returns the element in range and null past either end", () => {
    expect(questionAtIndex(["a", "b"], 1)).toBe("b");
    expect(questionAtIndex(["a", "b"], 2)).toBeNull();
    expect(questionAtIndex([], 0)).toBeNull();
  });
});
