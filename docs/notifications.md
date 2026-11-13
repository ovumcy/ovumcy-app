# Reminders & Notifications

Ovumcy-app delivers reminders as on-device local notifications and nothing else. Plans are derived
from the on-device profile and day logs, then handed to the operating system's notification
scheduler through `expo-notifications`. No server, account, push service, or billing state is
involved, and local reminders are a Free-tier feature. For the privacy and trust boundary see
[SECURITY.md](../SECURITY.md).

> [!IMPORTANT]
> Reminders are built from predictions, which are estimates, not medical advice or a method of
> contraception. See [cycle-prediction.md](cycle-prediction.md) for how the dates are produced.

## Contents

- [1. Reminder kinds](#1-reminder-kinds)
- [2. Lead days](#2-lead-days)
- [3. Time of day and time zone](#3-time-of-day-and-time-zone)
- [4. When the schedule is rebuilt](#4-when-the-schedule-is-rebuilt)
- [5. Permission flow](#5-permission-flow)
- [6. Notification text and privacy](#6-notification-text-and-privacy)
- [7. Prediction pause and pregnancy](#7-prediction-pause-and-pregnancy)
- [8. Web channels the app does not have](#8-web-channels-the-app-does-not-have)
- [Related documentation](#related-documentation)

## 1. Reminder kinds

Plans are built by `buildLocalReminderPlans` (`src/services/local-reminder-plan-service.ts`). Each
kind has its own toggle in the profile; a kind whose toggle is off produces no plan.

| Kind | Trigger | Date and time |
| --- | --- | --- |
| `daily_log` | Repeating daily | Every day at the reminder time. |
| `upcoming_period` | One-time | Predicted period window start (the predicted period date when no window is available), minus the lead days, at the reminder time. |
| `fertile_window` | One-time | Predicted fertile-window start minus a fixed 1 day, at the reminder time. |
| `kick_count` | Repeating daily | Every day at the reminder time, only during an active pregnancy (see [section 7](#7-prediction-pause-and-pregnancy)). |

For the two one-time kinds the trigger instant is resolved as follows:

1. The candidate day is the target date minus the lead. A candidate earlier than today becomes today.
2. The candidate day is combined with the reminder time. If that instant is not after the current
   moment, the reminder moves to the next day at the same time.
3. If the resulting instant falls after 23:59 on the target date, no plan is produced for that kind.

The fertile-window reminder anchors on the window start, which already precedes ovulation, and is
not governed by the lead-days setting. It is also skipped when the window is not calculable or the
cycle has no anchor date.

A one-time reminder fires once. The next one is scheduled only when the schedule is rebuilt
(see [section 4](#4-when-the-schedule-is-rebuilt)).

## 2. Lead days

The reminder lead time is a profile setting from **0 to 14** days, default **3**
(`MIN_REMINDER_LEAD_DAYS`, `MAX_REMINDER_LEAD_DAYS`, `DEFAULT_REMINDER_LEAD_DAYS` in
`src/models/profile.ts`). An out-of-range value is clamped, never rejected, and a non-numeric
value falls back to 3. 0 means on the day itself.

- Applies to: `upcoming_period` only.
- Does not apply to: `daily_log` and `kick_count` (daily, no target date) or `fertile_window`
  (fixed 1-day lead).

## 3. Time of day and time zone

The reminder time is a single `HH:MM` 24-hour setting, default `20:00`, shared by every kind. An
unparseable or out-of-range value falls back to `20:00`.

The local schedule is built without an explicit time zone, so the zone is the device's current
zone (UTC when the device zone cannot be resolved). Consequences:

- Daily kinds are handed to the OS as an hour and minute, so they follow the device clock and zone.
- One-time kinds are converted once, when the schedule is built, into an absolute instant. A
  change of device zone does not move an instant already scheduled; the next rebuild computes it in
  the new zone.
- "Today" for the lead-day floor is the calendar day in that zone.

Firing is driven by the OS clock, so a wrong device clock at build time yields a mistimed one-time
reminder until the next rebuild. See the clock assumption in [SECURITY.md](../SECURITY.md).

## 4. When the schedule is rebuilt

`syncLocalReminderSchedule` (`src/services/local-reminder-sync-service.ts`) rebuilds the whole
schedule: it cancels every notification the app scheduled, then schedules the current plans. There
is no background job and no resync on app launch or on screen focus. A rebuild runs after:

- a day-log save on the Dashboard or Calendar screen (including autosave);
- deleting a day entry, and starting a cycle manually, on either screen;
- accepting a cycle return after postpartum on the Dashboard;
- saving settings when the cycle values or the reminder values changed.

Each of these screens captures the current time once when it opens and reuses that value for every
rebuild it triggers, so a screen left open across midnight plans from the day it opened on.

Toggling the kick-count reminder on the kick counter screen only writes the profile; it takes
effect at the next rebuild. Starting or ending a pregnancy does not trigger one either.

When no toggle is on, or the enabled kinds yield no plans, the schedule is cleared. The pregnancy
state is read from storage only when the kick-count, upcoming-period, or fertile-window toggle is
on.

## 5. Permission flow

The native scheduler (`src/services/platform-local-reminder-scheduler.native.ts`) checks the OS
notification permission on every sync, including one with an empty plan list, and requests it when
it is not yet granted. iOS provisional authorization counts as granted. There is no separate
pre-prompt screen.

| Result | Meaning | Settings message |
| --- | --- | --- |
| `scheduled` | Permission granted; plans scheduled. | "Reminder settings updated for this device." |
| `permission_denied` | Permission refused. Previously scheduled reminders from this app are cancelled and nothing is scheduled. | "Allow notifications in device settings to receive reminders on this device." |
| `unavailable` | Expo Go (store client) or the web build; nothing is scheduled. | "This device cannot schedule local reminders right now." |

On denial the toggles and times stay saved in the profile. Granting permission in the OS settings
takes effect at the next rebuild. Only notifications carrying one of the app's reminder kinds are
cancelled; other notifications are left alone. On Android the reminders use the
`ovumcy-reminders` channel.

## 6. Notification text and privacy

Every notification uses the same generic title and one of two generic bodies, localized in the six
supported languages (`src/i18n/reminder-copy.ts`). In English:

- Title: "Ovumcy reminder".
- Daily bodies (`daily_log`, `kick_count`): "Open Ovumcy to update today's entry."
- Cycle bodies (`upcoming_period`, `fertile_window`): "Open Ovumcy to review your next cycle
  dates."

The notification data carries only the reminder kind identifier, used to cancel the app's own
schedules. No dates, cycle phase, symptoms, pregnancy state, or any other health data appears in
the title, body, or data, and `kick_count` deliberately reuses the daily wording so that no kick
or pregnancy wording reaches the lock screen. Notification payloads can be shown on a locked
screen and recorded by the OS, so they must never reveal health context; this follows the
transport invariant in [SECURITY.md](../SECURITY.md).

## 7. Prediction pause and pregnancy

- Unpredictable-cycle setting (facts-only mode): only the daily kinds are planned; the period and
  fertile-window reminders are not.
- Prediction pause after a positive pregnancy test (no later period): `upcoming_period` and
  `fertile_window` are both suppressed, matching the calendar, which hides predicted cells. Daily
  kinds are unaffected.
- Active pregnancy record: suppresses the same two kinds independently of the pause, so the two
  signals are combined. An ended record lifts the suppression.
- Kick-count reminder (the only pregnancy-module reminder): planned when its toggle is on, the
  pregnancy record is active, and the gestational age is at least week 28
  (`KICK_COUNTS_START_WEEK`). It is a daily reminder at the shared reminder time, independent of
  cycle predictability. The toggle lives on the kick counter screen, not in the Reminders
  settings section. No postpartum or screening reminders exist.

## 8. Web channels the app does not have

The app has no outbound webhook, no `.ics` calendar feed, and no in-app dashboard reminder banner:

- Webhook and `.ics` feed need a server that evaluates predictions and delivers or serves them. The
  app is local-first, holds health data on the device, and has no server-side reminder channel;
  adding one would move prediction data off-device, against the boundary in
  [SECURITY.md](../SECURITY.md).
- Web's ovulation-anchored lead is replaced by the fixed 1-day fertile-window lead above.
- Web's dashboard banner has no counterpart: the app dashboard already shows the next-period
  estimate persistently.
- The app has no reminder per cycle day.

The intentional differences are tracked in [web-parity-checklist.md](web-parity-checklist.md).

## Related documentation

- [SECURITY.md](../SECURITY.md)
- [cycle-prediction.md](cycle-prediction.md)
- [web-parity-checklist.md](web-parity-checklist.md)
