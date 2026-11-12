import { fireEvent, render, screen } from "@testing-library/react-native";

import { getDeviceCopy } from "../../../i18n/device-copy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { SettingsSyncDevicesSection } from "./SettingsSyncDevicesSection";

const copy = getDeviceCopy("en");

function noop() {}

describe("SettingsSyncDevicesSection", () => {
  it("fires onLoadDevices from the load action, then relabels it once a list exists", async () => {
    const onLoadDevices = jest.fn();

    const { rerender } = await render(
      <AppPreferencesTestProvider>
        <SettingsSyncDevicesSection
          copy={copy}
          devices={null}
          errorMessage=""
          isBusy={false}
          onLoadDevices={onLoadDevices}
          onRemoveDevice={noop}
          statusMessage=""
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByText(copy.showDevicesLabel)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("settings-sync-devices-load-button"));
    expect(onLoadDevices).toHaveBeenCalledTimes(1);

    await rerender(
      <AppPreferencesTestProvider>
        <SettingsSyncDevicesSection
          copy={copy}
          devices={[]}
          errorMessage=""
          isBusy={false}
          onLoadDevices={onLoadDevices}
          onRemoveDevice={noop}
          statusMessage={copy.statusRemoved}
        />
      </AppPreferencesTestProvider>,
    );

    // Loaded-but-empty: the empty-list copy and the status banner both show,
    // and the action relabels from "show" to "refresh".
    expect(screen.getByText(copy.refreshLabel)).toBeTruthy();
    expect(screen.getByText(copy.emptyLabel)).toBeTruthy();
    expect(
      screen.getByTestId("settings-sync-devices-status-banner"),
    ).toBeTruthy();
  });

  it("renders each device with a current-device badge only on this device, and wires remove to the callback", async () => {
    const onRemoveDevice = jest.fn();

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncDevicesSection
          copy={copy}
          devices={[
            {
              deviceID: "device-1",
              label: "Pixel 7",
              lastSeenText: "Mar 20, 2026",
              isCurrentDevice: true,
            },
            {
              deviceID: "device-2",
              label: "iPad",
              lastSeenText: "Never",
              isCurrentDevice: false,
            },
          ]}
          errorMessage=""
          isBusy={false}
          onLoadDevices={noop}
          onRemoveDevice={onRemoveDevice}
          statusMessage=""
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("settings-sync-device-current-device-1")).toBeTruthy();
    expect(
      screen.queryByTestId("settings-sync-device-current-device-2"),
    ).toBeNull();

    await fireEvent.press(screen.getByTestId("settings-sync-device-remove-device-2"));
    expect(onRemoveDevice).toHaveBeenCalledWith("device-2");
  });

  it("shows the error banner when errorMessage is set", async () => {
    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncDevicesSection
          copy={copy}
          devices={null}
          errorMessage={copy.errors.networkFailed}
          isBusy={false}
          onLoadDevices={noop}
          onRemoveDevice={noop}
          statusMessage=""
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("settings-sync-devices-error-banner"),
    ).toBeTruthy();
    expect(screen.getByText(copy.errors.networkFailed)).toBeTruthy();
  });
});
