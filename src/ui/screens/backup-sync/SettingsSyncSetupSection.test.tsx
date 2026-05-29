import { fireEvent, render, screen } from "@testing-library/react-native";

import { buildBackupSyncSetupPresentation } from "../../../services/backup-sync-view-service";
import { buildSettingsViewData } from "../../../services/settings-view-service";
import { createDefaultSyncPreferencesRecord } from "../../../sync/sync-contract";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { SettingsSyncSetupSection } from "./SettingsSyncSetupSection";

function createBaseProps(viewData: ReturnType<typeof buildSettingsViewData>["account"]) {
  return {
    authLoginValue: "",
    authPasswordValue: "",
    confirmActionLabel: "Confirm",
    errorPresentation: {
      accountMessage: "",
      deviceLabelMessage: "",
      endpointMessage: "",
      localMessage: "",
      loginMessage: "",
      passwordMessage: "",
      recoveryPhraseMessage: "",
      syncMessage: "",
    },
    generatedRecoveryCode: "",
    generatedRecoveryPhrase: "",
    hasStoredSyncSecrets: false,
    hasSyncSession: false,
    isExportingRecoveryPhrase: false,
    isPreparing: false,
    onAcknowledgeRecoveryCode: () => {},
    onAuthLoginChange: () => {},
    onAuthPasswordChange: () => {},
    onDisconnect: () => {},
    onDeviceLabelChange: () => {},
    onEndpointChange: () => {},
    onExportRecoveryPhrase: () => {},
    onLogin: () => {},
    onModeSelect: () => {},
    onPrepare: () => {},
    onRecoverAccess: () => {},
    onRetryPlanCheck: () => {},
    onRecoveryPhraseChange: () => {},
    onRegister: () => {},
    onRestore: () => {},
    onSyncNow: () => {},
    presentation: buildBackupSyncSetupPresentation({
      hasStoredSyncSecrets: false,
      hasSyncSession: false,
      isAuthenticating: false,
      isPreparing: false,
      isRecovering: false,
      isRestoring: false,
      isSyncing: false,
      locale: "en",
      managedPlanStatus: "unknown",
      notSetLabel: "Not set",
      preferences: {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed" as const,
        deviceLabel: "Pixel 7",
      },
      syncCapabilities: null,
      viewData,
    }),
    preferences: {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      deviceLabel: "Pixel 7",
    },
    recoveryPhraseValue: "",
    statusMessage: "",
    syncCapabilities: null,
    viewData,
  };
}

describe("SettingsSyncSetupSection", () => {
  it("shows a clear preparing state while the recovery phrase is being generated", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          isPreparing
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("settings-sync-preparing-block")).toBeTruthy();
    expect(await screen.findByText(viewData.preparingTitle)).toBeTruthy();
    expect(await screen.findByText(viewData.preparingHint)).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-recovery-import-block")).toBeNull();
  });

  it("guides the owner to the next action via the top guidance banner", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} />
      </AppPreferencesTestProvider>,
    );

    const banner = await screen.findByTestId("settings-sync-guidance-banner");
    expect(banner).toBeTruthy();
    // Nothing prepared yet -> banner points at step 1 (prepare on this device).
    expect(screen.getAllByText(viewData.errors.syncNotPrepared).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("settings-sync-step-done")).toBeNull();
  });

  it("marks a completed step with a done badge", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          hasStoredSyncSecrets
          presentation={buildBackupSyncSetupPresentation({
            hasStoredSyncSecrets: true,
            hasSyncSession: false,
            isAuthenticating: false,
            isPreparing: false,
            isRecovering: false,
            isRestoring: false,
            isSyncing: false,
            locale: "en",
            managedPlanStatus: "unknown",
            notSetLabel: "Not set",
            preferences: {
              ...props.preferences,
              mode: "managed",
            },
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    // Step 1 (protect this device) is complete -> at least one done badge renders.
    expect((await screen.findAllByTestId("settings-sync-step-done")).length).toBeGreaterThan(0);
  });

  it("offers a retry action on the cloud plan step when signed in without a confirmed plan", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onRetryPlanCheck = jest.fn();

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          hasStoredSyncSecrets
          hasSyncSession
          onRetryPlanCheck={onRetryPlanCheck}
          presentation={buildBackupSyncSetupPresentation({
            hasStoredSyncSecrets: true,
            hasSyncSession: true,
            isAuthenticating: false,
            isPreparing: false,
            isRecovering: false,
            isRestoring: false,
            isSyncing: false,
            locale: "en",
            managedPlanStatus: "unknown",
            notSetLabel: "Not set",
            preferences: {
              ...props.preferences,
              mode: "managed",
            },
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    const retry = await screen.findByTestId("settings-sync-plan-retry-button");
    fireEvent.press(retry);
    expect(onRetryPlanCheck).toHaveBeenCalledTimes(1);
  });

  it("shows the recovery phrase without enabling direct text selection", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          generatedRecoveryPhrase="alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu"
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("settings-sync-recovery-phrase")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-recovery-phrase").props.selectable).toBeFalsy();
    expect(screen.getByTestId("settings-sync-recovery-export-button")).toBeTruthy();
  });

  it("shows managed account auth controls on the dedicated backup and sync screen", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("settings-sync-login-input")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-password-input")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-recovery-import-block")).toBeNull();
    expect(screen.queryByTestId("settings-sync-managed-account-banner")).toBeNull();
  });

  it("renumbers the sync step for self-hosted mode when the cloud plan step is hidden", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          presentation={buildBackupSyncSetupPresentation({
            hasStoredSyncSecrets: false,
            hasSyncSession: false,
            isAuthenticating: false,
            isPreparing: false,
            isRecovering: false,
            isRestoring: false,
            isSyncing: false,
            locale: "en",
            managedPlanStatus: "unknown",
            notSetLabel: "Not set",
            preferences: {
              ...props.preferences,
              mode: "self_hosted",
              endpointInput: "127.0.0.1:8080",
            },
            syncCapabilities: null,
            viewData,
          })}
          preferences={{
            ...props.preferences,
            mode: "self_hosted",
            endpointInput: "127.0.0.1:8080",
          }}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByText("3. Sync this backup")).toBeTruthy();
    expect(screen.queryByText("4. Sync this backup")).toBeNull();
    expect(screen.queryByTestId("settings-sync-plan-step")).toBeNull();
  });

  it("uses a clear account login label and a decluttered status recap", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} />
      </AppPreferencesTestProvider>,
    );

    expect(viewData.loginLabel).toBe("Email or login");
    expect(await screen.findByText(viewData.loginLabel)).toBeTruthy();
    // The redundant per-step status cards (covered now by the guidance banner
    // and per-step done badges) were removed; only the unique last-sync line
    // remains in the recap.
    expect(screen.queryByText(viewData.stateLabel)).toBeNull();
    expect(screen.queryByText(viewData.encryptionRowLabel)).toBeNull();
    expect(screen.getByText(viewData.lastSyncLabel)).toBeTruthy();
  });

  it("renders the preformatted last sync value from presentation state", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          presentation={buildBackupSyncSetupPresentation({
            hasStoredSyncSecrets: true,
            hasSyncSession: true,
            isAuthenticating: false,
            isPreparing: false,
            isRecovering: false,
            isRestoring: false,
            isSyncing: false,
            locale: "en",
            managedPlanStatus: "unknown",
            notSetLabel: "Not set",
            preferences: {
              ...props.preferences,
              lastSyncedAt: "2026-03-20T08:10:00.000Z",
            },
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByText(/Mar|20|2026/)).toBeTruthy();
    expect(screen.queryByText("2026-03-20T08:10:00.000Z")).toBeNull();
  });

  it("submits sign in from the password field when auth actions are enabled", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onLogin = jest.fn();
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          hasStoredSyncSecrets
          onLogin={onLogin}
          presentation={buildBackupSyncSetupPresentation({
            hasStoredSyncSecrets: true,
            hasSyncSession: false,
            isAuthenticating: false,
            isPreparing: false,
            isRecovering: false,
            isRestoring: false,
            isSyncing: false,
            locale: "en",
            managedPlanStatus: "unknown",
            notSetLabel: "Not set",
            preferences: props.preferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("submits restore access from the password field on the restore pane", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onRecoverAccess = jest.fn();
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          onRecoverAccess={onRecoverAccess}
        />
      </AppPreferencesTestProvider>,
    );

    fireEvent.press(screen.getByTestId("settings-sync-account-pane-restore"));
    fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onRecoverAccess).toHaveBeenCalledTimes(1);
  });

  it("reveals the account recovery code once and acknowledges it via the confirm action", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onAcknowledgeRecoveryCode = jest.fn();
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          generatedRecoveryCode="abcd1234abcd1234abcd1234abcd1234"
          onAcknowledgeRecoveryCode={onAcknowledgeRecoveryCode}
        />
      </AppPreferencesTestProvider>,
    );

    const valueNode = await screen.findByTestId("settings-sync-recovery-code-value");
    expect(valueNode.props.children).toBe("abcd1234abcd1234abcd1234abcd1234");
    expect(valueNode.props.selectable).toBe(true);
    expect(await screen.findByText(viewData.recoveryCodeTitle)).toBeTruthy();
    expect(await screen.findByText(viewData.recoveryCodeHint)).toBeTruthy();

    fireEvent.press(
      screen.getByTestId("settings-sync-recovery-code-confirm-button"),
    );

    expect(onAcknowledgeRecoveryCode).toHaveBeenCalledTimes(1);
  });

  it("keeps the recovery code modal closed when no code is set", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.queryByTestId("settings-sync-recovery-code-modal")).toBeNull();
  });
});
