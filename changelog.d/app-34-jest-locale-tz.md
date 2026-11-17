### Internal

- **Jest pins the zone and default locale to CI's.** `jest.config.js` sets `TZ=UTC` and `jest.setup-env.js` defaults locale-less `Intl` and `toLocale*` calls to `en-US`, so a local run on a machine with another region format matches CI.
