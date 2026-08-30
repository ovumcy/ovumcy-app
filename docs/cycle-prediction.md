# Cycle prediction — how the math works

This document describes, in full, how Ovumcy App estimates ovulation, the fertile
window, and the next period. It exists so that anyone — users, contributors,
auditors — can read exactly what the app computes on-device and verify it against
the code.

The prediction math is **identical to `ovumcy-web`'s Free-tier prediction** —
Ovumcy App mirrors web's owner-flow baseline, so the same constants and steps run
locally here. The pure policy lives in
[`src/services/cycle-prediction-policy.ts`](../src/services/cycle-prediction-policy.ts)
(`predictCycleWindow`, `calcOvulationDay`, `resolveLutealPhase`) and is guarded by
[`src/services/cycle-prediction-policy.test.ts`](../src/services/cycle-prediction-policy.test.ts).

> [!IMPORTANT]
> **This is a calendar-based estimate, not medical advice and not a method of
> contraception.** Predictions are statistical guesses derived from cycle
> dates. They cannot detect ovulation, do not account for illness, stress,
> medication, or hormonal conditions, and are unreliable for irregular cycles.
> Do not rely on them to avoid or achieve pregnancy. Consult a qualified
> healthcare professional for medical decisions.

## Inputs

| Input | Meaning | Source |
|-------|---------|--------|
| `cycleStartDate` | First day of the current menstrual period (cycle day 1) | Canonical `profile.lastPeriodStart` / logged period days |
| `cycleLength` | Length of the cycle in days | Median of observed cycles, or the owner's configured value |
| `lutealPhase` | Days that **follow** ovulation, up to the day before the next period | **14-day** default (`DEFAULT_LUTEAL_PHASE_DAYS`), refined toward the owner's own value from logged BBT / cervical-mucus signals when enough cycles carry them |

## The model

The model rests on one physiological assumption: **the luteal phase (ovulation →
next period) is relatively stable per person** — modelled at ~14 days by default,
and refined toward the owner's own value when logged signals allow — while the
follicular phase (period → ovulation) absorbs the variation in cycle length. So
ovulation is counted *backwards* from the next expected period.

The `lutealPhase` parameter counts the days that **follow** ovulation. On a
28-day cycle with a 14, ovulation is cycle day 14 and the parameter covers cycle
days 15–28. It is therefore one day shorter than the calendar span from the
ovulation date to the next period start, which counts the ovulation day itself.
Every step below reads it that way, in both directions.

### Constants

| Constant | Value | Role |
|----------|-------|------|
| `DEFAULT_LUTEAL_PHASE_DAYS` | 14 | Default luteal phase, used when it is not refined from logged signals |
| `MIN_LUTEAL_PHASE_DAYS` | 10 | Lower clamp for the luteal phase |
| `MIN_OVULATION_CYCLE_DAY` | 5 | Ovulation may not fall before cycle day 5 |
| `MIN_CYCLE_LENGTH` | 15 | Shortest cycle that yields a prediction (`MIN_LUTEAL_PHASE_DAYS + MIN_OVULATION_CYCLE_DAY`) |

### Step 1 — resolve the luteal phase (`resolveLutealPhase`)

```
luteal ≤ 0          → 14   (default)
0 < luteal < 10     → 10   (minimum)
luteal ≥ 10         → luteal
```

### Step 2 — ovulation day (`calcOvulationDay`, 1-based within the cycle)

```
if cycleLength < 15:                      no prediction
maxSupportedLuteal = cycleLength − 5
if maxSupportedLuteal < 10:               no prediction   (equivalent to the 15-day floor)
if resolvedLuteal > maxSupportedLuteal:   resolvedLuteal = maxSupportedLuteal   (prediction marked non-exact: isExact = false)
ovulationDay = cycleLength − resolvedLuteal
if ovulationDay < 5:                      no prediction
```

`cycleStartDate` is cycle day 1, so the ovulation **date** is
`cycleStartDate + (ovulationDay − 1)` days.

### Step 2a — the same arithmetic, run backwards (`calcLutealPhase`)

Personalization travels this arithmetic in the other direction: an ovulation
*observed* from logged signals is turned back into the `lutealPhase` Step 2
consumes. That is Step 2 solved for the luteal phase, and nothing more:

```
observedLuteal = cycleLength − observedOvulationDay
```

Both directions have to use one indexing, or an observation trains a value that
predicts a different day than the one observed. What using one buys:

> An ovulation observed on cycle day **N** predicts cycle day **N** again on a
> next cycle of the same length.

The table below is asserted row for row by the "Step 2a reference vectors" cases
in [`src/services/cycle-prediction-policy.test.ts`](../src/services/cycle-prediction-policy.test.ts).
The invariant itself is a claim about the *observation* path, so it is pinned
where that path runs, by
[`src/services/cycle-luteal-round-trip.test.ts`](../src/services/cycle-luteal-round-trip.test.ts):
those cases read an ovulation out of logged temperature or mucus entries and
follow it all the way to a rendered date. A test of the two formulas alone could
never catch a drift here, and not by oversight: they are exact inverses by
construction, so the pair always agrees. What can drift is a third thing — the
step that reads an ovulation out of the logs and works out which argument to
hand them.

| cycleLength | observed ovulation | → lutealPhase | → predicted ovulation |
|-------------|--------------------|---------------|-----------------------|
| 28 | day 14 | 14 (the model default) | day 14 |
| 28 | day 15 | 13 | day 15 |
| 21 | day 8  | 13 | day 8  |
| 35 | day 21 | 14 | day 21 |
| 40 | day 26 | 14 | day 26 |
| 30 | day 20 | 10 (equal to the floor, not clamped to it) | day 20 |

Measuring the ovulation-to-next-period span instead and feeding it back in as
the parameter moves every personalized prediction one day early — the ovulation
date and both edges of the fertile window alike.

### Step 3 — fertile window (`predictCycleWindow`)

The fertile window is the **6-day range ending on ovulation day**, reflecting
that sperm can survive several days and the egg is viable for about a day:

```
fertilityEnd   = ovulationDate
fertilityStart = ovulationDate − 5 days
if fertilityStart < cycleStartDate:  fertilityStart = cycleStartDate   (short-cycle clamp)
```

On short cycles the window may overlap menstruation; it is never allowed to
start before the period.

### Step 4 — next period

```
nextPeriodStart = cycleStartDate + cycleLength days
```

A window is only returned when the ovulation date falls strictly before the next
period start; otherwise the result is non-calculable (empty).

### A note on dates and time zones

All date arithmetic here operates on **calendar dates** (`YYYY-MM-DD`), not
instants. Day offsets and day-count differences are anchored so that one
calendar day always counts as exactly one day, independent of the device time
zone and of any daylight-saving transition between two dates — matching the
UTC-anchored day arithmetic in `ovumcy-web`'s Go source of truth. The results
are therefore the same on every device for the same input dates.

## Worked examples

These vectors are the same as `ovumcy-web`'s reference vectors; Ovumcy App
reproduces them because it runs the identical constants and steps.

| cycleStartDate | cycleLength | lutealPhase | → ovulation | fertile window | next period | exact? |
|----------------|-------------|-------------|-------------|----------------|-------------|--------|
| 2026-03-10 | 28 | 14 | 2026-03-23 | 2026-03-18 … 2026-03-23 | 2026-04-07 | yes |
| 2026-06-01 | 30 | 0 (→14) | 2026-06-16 | 2026-06-11 … 2026-06-16 | 2026-07-01 | yes |
| 2026-01-01 | 21 | 14 | 2026-01-07 | 2026-01-02 … 2026-01-07 | 2026-01-22 | yes |
| 2026-02-01 | 15 | 14 (→10) | 2026-02-05 | 2026-02-01 … 2026-02-05 | 2026-02-16 | no (luteal clamped, window clamped to period start) |
| any | 14 | any | — | — | — | no prediction (cycle too short) |

## How cycle length and luteal phase are chosen

- **Cycle length** is the median of the owner's recent observed cycles (a cycle
  being the gap between two detected period starts). The median is used rather
  than the mean, so a single missed-log gap that merges two cycles cannot skew
  the estimate. When there is not enough history, the owner's configured value
  is used.
- **Luteal phase** defaults to the fixed 14-day model value, but is refined for
  the owner when their logs carry enough signal: when basal body temperature
  (`detectSustainedThermalShift`) or cervical-mucus entries let the app read an
  observed ovulation day across several cycles, each observation becomes a luteal
  length by Step 2a and the average of them (lower-clamped at 10 days) replaces
  the default. A cycle whose inferred luteal length falls outside a physiological
  10–20 day window is **discarded**, not pulled to the nearest edge of it — an
  implausible inference is treated as a bad reading rather than as a 10 or a 20 —
  and the refinement needs at least two surviving cycles, so a single odd reading
  cannot move the estimate on its own. That window bounds the parameter, not the
  ovulation-to-next-period span, so a cycle whose span sits exactly on the lower
  edge is discarded. The cervical-mucus signal estimates ovulation as the day
  after the last egg-white (peak-quality) mucus day of the cycle; self-observed
  peak days can differ from reference ovulation by a day or more, which is
  another reason the inferred luteal length stays an estimate. With little or no such
  data the fixed 14-day default stands — a population default estimate, never a
  personal truth. The population mean actually sits a little below 14 (around
  12 days), and individual luteal phases vary widely from person to person and
  cycle to cycle (commonly 11–17 days), so 14 is a deliberately conservative
  fallback, not a target — that variability is one reason predictions remain
  estimates.
- For irregular cycles the app widens the prediction into a range rather than a
  single date, and surfaces variability statistics (shortest/longest cycle and
  the sample standard deviation) computed over the same recent-cycle window as
  the median, so an old outlier stops affecting them once it ages out.

## Observed-ovulation signals (retrospective, indicative)

Logged basal body temperature (BBT) and cervical mucus never predict a *future*
ovulation — they only refine the luteal phase and mark a *past* ovulation
retrospectively. Both mirror ovumcy-web (`internal/services/cycle_signals.go`).

- **BBT — the "3-over-6" coverline rule** (`detectSustainedThermalShift`). The
  detection series is one undisturbed reading per calendar day; days tagged
  `illness` or `sleep_disruption` are excluded entirely, so a fever neither
  inflates the coverline nor fakes a rise. The sliding coverline is the
  **maximum** (not the mean) of the 6 immediately preceding recorded
  temperatures. A shift is three calendar-consecutive recorded days: the first
  two strictly above the coverline and the third at least **0.2 °C** above it.
  Because basal temperature rises the day *after* ovulation, the estimated
  ovulation date is the calendar day **before** the first elevated day
  (`inferBBTOvulationDate` = first-elevated − 1). Even a detected shift is a
  **probable retrospective signal**, accurate only to **±1–2 days** — treat the
  marker as *indicative, not diagnostic*: prospective studies find BBT alone
  identifies the exact ovulation day imperfectly.
- **Cervical mucus — the peak-day heuristic** (`inferEggWhiteOvulationDate`). The
  last day of fertile-quality (egg-white) mucus is the peak signal; ovulation
  most commonly follows it by about a day, so the estimate is the **day after
  the last egg-white day** (clamped to stay before the next cycle start). This is
  a coarse, probable signal, weaker than the BBT shift, and is only a fallback
  when no sustained thermal shift is present.

Neither signal is a *confirmation* of ovulation. The free stats BBT chart draws
the coverline and a "probable ovulation" marker only once a shift is detected;
until then there is nothing physiologically meaningful to draw.

## Projection and anchor layer

The section above is the pure *window* math for a single known cycle start.
Production layers a small **projection** step on top of it, so a dashboard that
opens weeks after the last logged period still shows a sensible current cycle
instead of a stale or blank one. This layer lives in
[`src/services/cycle-history-service.ts`](../src/services/cycle-history-service.ts)
(`buildCurrentCycleProjection`) and mirrors `ovumcy-web`'s
`DashboardUpcomingPredictions` step for step.

1. **Prediction length (median-first).** The cycle length used to project is the
   median of the recent observed cycles (`predictedCycleLength`), falling back to
   the mean only when no median exists, and to the owner's configured value until
   there are enough completed cycles. The median is deliberately chosen so that a
   single missed-log gap — which merges two real cycles into one ~60–90 day
   pseudo-cycle and would drag the mean ~10 days late — does not skew the
   estimate.
2. **Project the current-cycle start forward.** From the logged anchor
   (`profile.lastPeriodStart` / the latest logged period start) the anchor is
   rolled forward by whole cycle lengths until it contains `today`
   (`projectCycleStartForward`, web `ProjectCycleStart`), yielding the projected
   current-cycle start and a 1-based current cycle day. The **logged anchor
   itself is preserved** — calendar, stats, reminders and the doctor PDF stay
   bound to the real logged history, exactly as web keeps `stats.LastPeriodStart`.
3. **Displayed next period.** Derived from the *un-shifted* projected start plus
   the prediction length, so the ovulation roll in step 4 can never disturb it.
4. **Roll the ovulation forward (upcoming ovulation).** The ovulation for the
   projected cycle may already be in the past (the owner is mid/late luteal). For
   a "next ovulation" surface this is rolled forward by whole cycles until it
   lands on or after `today` (`shiftCycleStartToFutureOvulation`, web
   `ShiftCycleStartToFutureOvulation`). This rolled **upcoming ovulation** is kept
   separate from the current cycle's ovulation date: the current-cycle date still
   drives the phase (follicular / fertile / ovulation / luteal) and the
   history-bounded calendar and PDF markers, mirroring how web keeps
   `stats.OvulationDate` distinct from the dashboard upcoming prediction.

All of this arithmetic is calendar-day based and therefore DST-immune: the
Europe/Berlin spring-forward case below projects identically to a UTC run.

### Worked examples (projection)

Recent cycle lengths are newest-last; `today` and the anchor are calendar dates.

| recent cycle lengths | lastPeriodStart | today | prediction length | projected start (cycle day) | displayed next period | upcoming ovulation |
|----------------------|-----------------|-------|-------------------|-----------------------------|-----------------------|--------------------|
| 28, 28, 28, 28, 60 | 2026-01-01 | 2026-01-19 | 28 (median, not mean 34) | 2026-01-01 (day 19) | 2026-01-29 | 2026-02-11 |
| 28, 28, 28 | 2026-03-15 | 2026-04-12 (Europe/Berlin) | 28 | 2026-04-12 (day 1) | 2026-05-10 | 2026-04-25 |
| 30, 30 | 2026-06-01 | 2026-07-01 | 30 | 2026-07-01 (day 1) | 2026-07-31 | 2026-07-16 |

In the first row the projected cycle's own ovulation (2026-01-14, cycle day 14)
has already passed `today`, so the upcoming ovulation rolls one whole cycle
forward to 2026-02-11 while the displayed next period stays anchored on the
un-shifted start. In the other two rows `today` lands on cycle day 1, so the
first ovulation is already in the future and no roll is needed.

## Pregnancy pause (app-specific)

Independently of the math above, a positive pregnancy test more recent than every
recorded cycle start **pauses** predictions across dashboard, calendar, and stats
until a new cycle start is logged. The pause lives in
`cycle-history-service.buildCurrentCycleProjection` (not in this pure policy) and
is a cross-cutting **Medical safety** invariant of the security constitution.

## Assumptions and limitations

- Luteal phase defaults to a constant 14-day estimate and is only refined when
  enough logged BBT / cervical-mucus signal exists; in reality it varies between
  people and cycles, so the default is never a personal truth.
- Predictions are **calendar-based** and cannot observe the body. Logged BBT /
  cervical-mucus signals only refine the luteal phase and mark past ovulation as
  a **probable retrospective signal (±1–2 days, indicative, not diagnostic)** —
  they never confirm ovulation, and never predict a future one.
- Accuracy degrades sharply for irregular or very short/long cycles.
- The model is **not** a fertility-awareness contraceptive method (which require
  trained tracking of multiple biomarkers).

## Physiological basis

The ~14-day luteal phase and the "6-day fertile window ending at ovulation" are
standard reproductive-physiology concepts (e.g. the fertile-window work of
Wilcox et al., *NEJM* 1995). Ovumcy applies them as a transparent calendar
estimate, nothing more.

## Verifying this document

The prediction policy is guarded by
[`src/services/cycle-prediction-policy.test.ts`](../src/services/cycle-prediction-policy.test.ts),
which asserts the core behaviors: day-14 ovulation for a normal 28-day cycle, the
short-supported-cycle clamp (non-exact), cycles below the 15-day floor returning
non-calculable, and the ovulation-before-next-period invariant. The algorithm is
identical to `ovumcy-web`'s Free prediction.

Every worked-example vector above is pinned to the code by a **shared
golden-vector fixture**,
[`src/services/__fixtures__/cycle-prediction-golden-vectors.json`](../src/services/__fixtures__/cycle-prediction-golden-vectors.json),
consumed by [`src/services/cycle-prediction-reference.test.ts`](../src/services/cycle-prediction-reference.test.ts).
That same file is, by design, the source of truth for `ovumcy-web`'s Go reference
test (`internal/services/cycles_reference_test.go`), so any change to either the
Go (`cycles.go`) or TypeScript (`cycle-prediction-policy.ts`) implementation that
breaks parity fails CI on both sides. If you change the math, update the fixture,
this document, and both reference tests in the same change.

The retrospective observed-ovulation signals (the "3-over-6" BBT detector and
the cervical-mucus peak-day heuristic) are guarded by
[`src/services/observed-ovulation-service.test.ts`](../src/services/observed-ovulation-service.test.ts),
including the illness / sleep_disruption exclusion, the max-coverline behavior,
the ovulation = day-before-first-elevated anchor, and the egg-white day-after
clamp.

The same fixture carries an additive `projection` section that pins the
projection/anchor layer (median-first length, forward-projected start, displayed
next period, and the upcoming-ovulation roll). It is consumed by
[`src/services/cycle-projection-reference.test.ts`](../src/services/cycle-projection-reference.test.ts)
here and by `ovumcy-web`'s `internal/services/cycle_projection_reference_test.go`,
which replay the identical projection sequence against the same numbers. The file
is vendored **byte-identical** between the repositories, so a projection-math
change must likewise update the fixture, this document, and both projection
reference tests together.
