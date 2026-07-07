import goldenVectors from "./__fixtures__/cycle-prediction-golden-vectors.json";
import { predictCycleWindow } from "./cycle-prediction-policy";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

// Golden-vector parity test for the cycle-prediction math.
//
// The vectors live in a single shared fixture
// (./__fixtures__/cycle-prediction-golden-vectors.json) that is the source of
// truth for BOTH this TypeScript suite and — by design — ovumcy-web's Go
// reference test (internal/services/cycles_reference_test.go). The Go and TS
// prediction implementations are hand-parallel ports; consuming one shared
// file makes any divergence between them fail CI on both sides instead of
// silently drifting. Each vector is also a worked example in
// docs/cycle-prediction.md. If the prediction math changes, update the fixture,
// the doc, and both reference tests in the same commit.
describe("cycle-prediction golden vectors (shared with ovumcy-web)", () => {
  for (const vector of goldenVectors.vectors) {
    it(vector.name, () => {
      const { cycleStartDate, cycleLength, lutealPhase } = vector.input;
      const { nextPeriodStart, ...expectedWindow } = vector.expected;

      expect(predictCycleWindow(cycleStartDate, cycleLength, lutealPhase)).toEqual(
        expectedWindow,
      );

      // next period = cycleStartDate + cycleLength days. Not part of
      // predictCycleWindow's output, so assert it directly to lock the
      // doc's "next period" column to the code as well.
      const cycleStart = parseLocalDate(cycleStartDate);
      expect(cycleStart).not.toBeNull();
      expect(formatLocalDate(addDays(cycleStart!, cycleLength))).toBe(
        nextPeriodStart,
      );
    });
  }
});
