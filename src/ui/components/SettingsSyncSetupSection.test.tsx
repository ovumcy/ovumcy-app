import { render, screen } from "@testing-library/react-native";

import { buildSettingsViewData } from "../../services/settings-view-service";
import { createDefaultSyncPreferencesRecord } from "../../sync/sync-contract";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesProvider } from "../providers/AppPreferencesProvider";
import { SettingsSyncSetupSection } from "./SettingsSyncSetupSection";

describe("SettingsSyncSetupSection", () => {
  it("shows a clear preparing state while the recovery phrase is being generated", async () => {
    const storage = createLocalAppStorageMock();
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;

    render(
      <AppPreferencesProvider storage={storage}>
        <SettingsSyncSetupSection
          authLoginValue=""
          authPasswordValue=""
          errorMessage=""
          generatedRecoveryPhrase=""
          hasStoredSyncSecrets={false}
          hasSyncSession={false}
          isAuthenticating={false}
          isPreparing
          isRecovering={false}
          isRestoring={false}
          isSyncing={false}
          notSetLabel="Not set"
          onAuthLoginChange={() => {}}
          onAuthPasswordChange={() => {}}
          onDisconnect={() => {}}
          onDeviceLabelChange={() => {}}
          onEndpointChange={() => {}}
          onLogin={() => {}}
          onModeSelect={() => {}}
          onPrepare={() => {}}
          onRecoverAccess={() => {}}
          onRecoveryPhraseChange={() => {}}
          onRegister={() => {}}
          onRestore={() => {}}
          onSyncNow={() => {}}
          preferences={{
            ...createDefaultSyncPreferencesRecord(),
            mode: "managed",
            deviceLabel: "Pixel 7",
          }}
          recoveryPhraseValue=""
          statusMessage=""
          syncCapabilities={null}
          viewData={viewData}
        />
      </AppPreferencesProvider>,
    );

    expect(await screen.findByTestId("settings-sync-preparing-block")).toBeTruthy();
    expect(await screen.findByText(viewData.preparingTitle)).toBeTruthy();
    expect(await screen.findByText(viewData.preparingHint)).toBeTruthy();
    expect(screen.getByTestId("settings-sync-recovery-import-block")).toBeTruthy();
  });

  it("shows managed account auth controls on the dedicated backup and sync screen", async () => {
    const storage = createLocalAppStorageMock();
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;

    render(
      <AppPreferencesProvider storage={storage}>
        <SettingsSyncSetupSection
          authLoginValue=""
          authPasswordValue=""
          errorMessage=""
          generatedRecoveryPhrase=""
          hasStoredSyncSecrets={false}
          hasSyncSession={false}
          isAuthenticating={false}
          isPreparing={false}
          isRecovering={false}
          isRestoring={false}
          isSyncing={false}
          notSetLabel="Not set"
          onAuthLoginChange={() => {}}
          onAuthPasswordChange={() => {}}
          onDisconnect={() => {}}
          onDeviceLabelChange={() => {}}
          onEndpointChange={() => {}}
          onLogin={() => {}}
          onModeSelect={() => {}}
          onPrepare={() => {}}
          onRecoverAccess={() => {}}
          onRecoveryPhraseChange={() => {}}
          onRegister={() => {}}
          onRestore={() => {}}
          onSyncNow={() => {}}
          preferences={{
            ...createDefaultSyncPreferencesRecord(),
            mode: "managed",
            deviceLabel: "Pixel 7",
          }}
          recoveryPhraseValue=""
          statusMessage=""
          syncCapabilities={null}
          viewData={viewData}
        />
      </AppPreferencesProvider>,
    );

    expect(await screen.findByTestId("settings-sync-login-input")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-password-input")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-recovery-import-block")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-managed-account-banner")).toBeNull();
  });
});
