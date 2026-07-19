import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Modal, Platform } from "react-native";

import type { ResolvedBillingOffer } from "../../../services/offers-service";
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
      deleteAccountMessage: "",
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
    onDeleteAccount: () => {},
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

  it("hides the local-step prepare/regenerate button for a guest session even though local secrets already exist", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          hasStoredSyncSecrets
          preferences={{
            ...props.preferences,
            guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
          }}
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
              guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
            },
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    // Local secrets already exist (guest accept silently created them), so
    // step 1 still legitimately shows done...
    expect((await screen.findAllByTestId("settings-sync-step-done")).length).toBeGreaterThan(0);
    // ...but the affordance that would mint and reveal a NEW, real recovery
    // phrase must never render for a guest session (docs/sync-trust-model.md
    // "Guest Partner Access": guests never see a recovery phrase).
    expect(screen.queryByTestId("settings-sync-prepare-button")).toBeNull();
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
    expect(
      screen.getByTestId("settings-sync-login-input").props.accessibilityLabel,
    ).toBe(viewData.loginLabel);
    expect(
      screen.getByTestId("settings-sync-password-input").props.accessibilityLabel,
    ).toBe(viewData.passwordLabel);
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

  it("renders a delete-account action alongside disconnect once signed in, and wires it to the handler", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onDeleteAccount = jest.fn();

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          hasStoredSyncSecrets
          hasSyncSession
          onDeleteAccount={onDeleteAccount}
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
            preferences: props.preferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    const deleteButton = await screen.findByTestId("settings-sync-delete-account-button");
    expect(deleteButton).toBeTruthy();
    fireEvent.press(deleteButton);
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("shows the dedicated delete-account error banner without touching the shared sync error banner", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          errorPresentation={{
            ...props.errorPresentation,
            deleteAccountMessage: viewData.errors.deleteAccountFailed,
          }}
          hasStoredSyncSecrets
          hasSyncSession
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
            preferences: props.preferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      await screen.findByTestId("settings-sync-delete-account-error-banner"),
    ).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-actions-error-banner")).toBeNull();
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

  it("ignores a submit from the password field once already signed in", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onLogin = jest.fn();
    const onRecoverAccess = jest.fn();

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          hasStoredSyncSecrets
          hasSyncSession
          onLogin={onLogin}
          onRecoverAccess={onRecoverAccess}
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
            preferences: props.preferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onLogin).not.toHaveBeenCalled();
    expect(onRecoverAccess).not.toHaveBeenCalled();
  });

  it("blocks an auth submit until local secrets are prepared", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onLogin = jest.fn();

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} onLogin={onLogin} />
      </AppPreferencesTestProvider>,
    );

    fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onLogin).not.toHaveBeenCalled();
  });

  it("wires the sync-mode picker to onModeSelect, guarded while account actions are disabled", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onModeSelect = jest.fn();

    const { rerender } = render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} onModeSelect={onModeSelect} />
      </AppPreferencesTestProvider>,
    );

    fireEvent.press(screen.getByTestId("settings-sync-mode-self_hosted"));
    expect(onModeSelect).toHaveBeenCalledWith("self_hosted");

    onModeSelect.mockClear();
    rerender(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          onModeSelect={onModeSelect}
          presentation={buildBackupSyncSetupPresentation({
            hasStoredSyncSecrets: false,
            hasSyncSession: false,
            isAuthenticating: true,
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

    fireEvent.press(screen.getByTestId("settings-sync-mode-self_hosted"));
    expect(onModeSelect).not.toHaveBeenCalled();
  });

  it("shows the endpoint validation error inline in self-hosted mode", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const selfHostedPreferences = { ...props.preferences, mode: "self_hosted" as const };

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          errorPresentation={{
            ...props.errorPresentation,
            endpointMessage: viewData.errors.invalidEndpoint,
          }}
          preferences={selfHostedPreferences}
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
            preferences: selfHostedPreferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByText(viewData.errors.invalidEndpoint)).toBeTruthy();
  });

  it("shows the device-label validation error inline", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          errorPresentation={{
            ...props.errorPresentation,
            deviceLabelMessage: viewData.errors.deviceLabelRequired,
          }}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByText(viewData.errors.deviceLabelRequired)).toBeTruthy();
  });

  it("hides the login-vs-restore pane picker once local secrets already exist", async () => {
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
            preferences: props.preferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("settings-sync-login-input")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-account-pane-restore")).toBeNull();
    expect(screen.queryByTestId("settings-sync-account-pane-auth")).toBeNull();
  });

  it("shows the login and password validation errors inline", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          errorPresentation={{
            ...props.errorPresentation,
            loginMessage: viewData.errors.loginRequired,
            passwordMessage: viewData.errors.passwordRequired,
          }}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByText(viewData.errors.loginRequired)).toBeTruthy();
    expect(screen.getByText(viewData.errors.passwordRequired)).toBeTruthy();
  });

  it("shows the recovery-phrase validation error inline on the restore pane", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          errorPresentation={{
            ...props.errorPresentation,
            recoveryPhraseMessage: viewData.errors.invalidRecoveryPhrase,
          }}
        />
      </AppPreferencesTestProvider>,
    );

    fireEvent.press(screen.getByTestId("settings-sync-account-pane-restore"));

    expect(
      await screen.findByText(viewData.errors.invalidRecoveryPhrase),
    ).toBeTruthy();
  });

  it("does not crash pressing renewal-management buttons when no handler is wired", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          hasStoredSyncSecrets
          hasSyncSession
          onCancelRenewal={undefined}
          onResumeRenewal={undefined}
          presentation={buildBackupSyncSetupPresentation({
            billingManagement: {
              canManageRenewal: true,
              canCancelAtPeriodEnd: true,
              canResumeRenewal: true,
            },
            hasStoredSyncSecrets: true,
            hasSyncSession: true,
            isAuthenticating: false,
            isPreparing: false,
            isRecovering: false,
            isRestoring: false,
            isSyncing: false,
            locale: "en",
            managedPlanStatus: "active",
            notSetLabel: "Not set",
            preferences: props.preferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    const cancelButton = await screen.findByTestId(
      "settings-sync-renewal-cancel-button",
    );
    const resumeButton = screen.getByTestId("settings-sync-renewal-resume-button");

    expect(() => {
      fireEvent.press(cancelButton);
      fireEvent.press(resumeButton);
    }).not.toThrow();
  });

  it("shows the announcement eyebrow for a non-promo offer and wires a screen-action CTA", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onOfferCTAPress = jest.fn();
    const announcementOffer: ResolvedBillingOffer = {
      id: "offer-announcement",
      kind: "announcement",
      title: "New in Ovumcy Cloud",
      body: "Reminders are here.",
      cta: "Learn more",
      action: {
        type: "play_checkout",
        productId: null,
        basePlanId: null,
        offerId: null,
      },
    };
    const screenOffer: ResolvedBillingOffer = {
      id: "offer-screen",
      kind: "subscription_promo",
      title: "Extend your plan",
      body: "Keep syncing without interruption.",
      cta: "Open",
      action: { type: "screen", screen: "backup-sync" },
    };

    render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          billingOffers={[announcementOffer, screenOffer]}
          onOfferCTAPress={onOfferCTAPress}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByText(viewData.offerAnnouncementEyebrow)).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-sync-offer-offer-screen-cta"));
    expect(onOfferCTAPress).toHaveBeenCalledWith(screenOffer);
  });

  it("closes the recovery-phrase reveal modal from the confirm button", async () => {
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

    await screen.findByTestId("settings-sync-recovery-modal");
    fireEvent.press(
      screen.getByTestId("settings-sync-recovery-modal-confirm-button"),
    );

    expect(screen.queryByTestId("settings-sync-recovery-modal")).toBeNull();
  });

  it("closes the recovery-phrase reveal modal when dismissed via the system back gesture", async () => {
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

    await screen.findByTestId("settings-sync-recovery-modal");
    const phraseModal = screen
      .UNSAFE_getAllByType(Modal)
      .find((modal) => modal.props.visible);

    act(() => {
      phraseModal?.props.onRequestClose();
    });

    expect(screen.queryByTestId("settings-sync-recovery-modal")).toBeNull();
  });

  it("submits the account form through the native web form element", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onLogin = jest.fn();
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    try {
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

      const form = screen
        .UNSAFE_getAllByProps({ "data-testid": "settings-sync-account-form" })
        .find((node) => typeof node.props.onSubmit === "function");

      act(() => {
        form?.props.onSubmit({ preventDefault: jest.fn() });
      });

      expect(onLogin).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalPlatformOS,
      });
    }
  });
});
