### Fixed

- **Reminders follow every change to what they are planned from.** The local reminder schedule is now rebuilt at app launch (replacing a one-time reminder that already fired), after the kick-count reminder toggle, after starting, ending, re-dating or deleting a pregnancy, after deleting all local data, after a JSON import, and after an interface-language change. A screen left open past midnight no longer plans reminders from the day it was opened.
- **No notification prompt with every reminder off.** The device asks for notification permission only when at least one reminder will be scheduled; clearing the schedule never prompts.
- **Android reminders use the Ovumcy reminders channel** instead of the system fallback channel.
