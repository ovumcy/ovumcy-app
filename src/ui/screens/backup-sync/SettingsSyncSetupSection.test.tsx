import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

import { selectAccountChangeRecoveryCopy } from "../../../i18n/account-change-recovery-copy";
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
    onAcknowledgeRecoveryPhrase: () => {},
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

    await render(
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

    await render(
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

  it("locks sync actions and says sync is not included when the server refuses sync under an active plan", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const syncCapabilities = {
      mode: "managed" as const,
      syncEnabled: false,
      recoverySupported: true,
      pushSupported: false,
      portalSupported: false,
      advancedCloudInsights: false,
      maxDevices: 5,
      maxBlobBytes: 1024,
    };

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
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
            managedPlanStatus: "active",
            notSetLabel: "Not set",
            preferences: props.preferences,
            syncCapabilities,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("settings-sync-plan-blocked-banner")).toBeTruthy();
    expect(screen.getAllByText(viewData.status.syncNotIncluded).length).toBeGreaterThan(0);
    expect(screen.queryByText(viewData.syncBlockedNoPlan)).toBeNull();
    expect(screen.queryByTestId("settings-sync-upload-button")).toBeNull();
    expect(screen.getByTestId("settings-sync-plan-retry-button")).toBeTruthy();
  });

  it("marks a completed step with a done badge", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    await render(
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

    await render(
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

    await render(
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
    await fireEvent.press(retry);
    expect(onRetryPlanCheck).toHaveBeenCalledTimes(1);
  });

  it("shows the recovery phrase without enabling direct text selection", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    await render(
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

  describe("account-change recovery offer", () => {
    const copy = selectAccountChangeRecoveryCopy("en");

    async function renderOffer(
      offer: "none" | "reveal" | "replace",
      generatedRecoveryPhrase = "",
    ) {
      const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
      const onReveal = jest.fn();
      const onReplace = jest.fn();
      await render(
        <AppPreferencesTestProvider>
          <SettingsSyncSetupSection
            {...createBaseProps(viewData)}
            accountChangeRecovery={{ copy, offer, onReveal, onReplace }}
            generatedRecoveryPhrase={generatedRecoveryPhrase}
          />
        </AppPreferencesTestProvider>,
      );
      return { onReveal, onReplace };
    }

    it("shows the reveal action, never the phrase, until it is pressed", async () => {
      const { onReveal, onReplace } = await renderOffer("reveal");

      expect(screen.getByText(copy.pendingHint)).toBeTruthy();
      expect(screen.queryByTestId("settings-sync-recovery-phrase")).toBeNull();
      await act(async () => {
        await fireEvent.press(screen.getByTestId("settings-sync-account-change-recovery-button"));
      });
      expect(onReveal).toHaveBeenCalledTimes(1);
      expect(onReplace).not.toHaveBeenCalled();
    });

    it("offers a new phrase once the unrevealed one was lost", async () => {
      const { onReveal, onReplace } = await renderOffer("replace");

      expect(screen.getByText(copy.lostHint)).toBeTruthy();
      await act(async () => {
        await fireEvent.press(screen.getByTestId("settings-sync-account-change-recovery-button"));
      });
      expect(onReplace).toHaveBeenCalledTimes(1);
      expect(onReveal).not.toHaveBeenCalled();
    });

    it("shows no offer without a replaced key, or while a phrase is on screen", async () => {
      await renderOffer("none");
      expect(screen.queryByTestId("settings-sync-account-change-recovery-card")).toBeNull();

      await renderOffer("reveal", "alpha beta gamma");
      expect(screen.queryByTestId("settings-sync-account-change-recovery-card")).toBeNull();
    });
  });

  it("shows managed account auth controls on the dedicated backup and sync screen", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    await render(
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

    await render(
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

    await render(
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

    await render(
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

    await render(
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
    await fireEvent.press(deleteButton);
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("shows the dedicated delete-account error banner without touching the shared sync error banner", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    await render(
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

    await render(
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

    await fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("submits restore access from the password field on the restore pane", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onRecoverAccess = jest.fn();
    const props = createBaseProps(viewData);

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          onRecoverAccess={onRecoverAccess}
        />
      </AppPreferencesTestProvider>,
    );

    await fireEvent.press(screen.getByTestId("settings-sync-account-pane-restore"));
    await fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onRecoverAccess).toHaveBeenCalledTimes(1);
  });

  it("reveals the account recovery code once and acknowledges it via the confirm action", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onAcknowledgeRecoveryCode = jest.fn();
    const props = createBaseProps(viewData);

    await render(
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

    await fireEvent.press(
      screen.getByTestId("settings-sync-recovery-code-confirm-button"),
    );

    expect(onAcknowledgeRecoveryCode).toHaveBeenCalledTimes(1);
  });

  it("keeps the recovery code modal open on the system back gesture without acknowledging it", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onAcknowledgeRecoveryCode = jest.fn();
    const props = createBaseProps(viewData);

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          generatedRecoveryCode="abcd1234abcd1234abcd1234abcd1234"
          onAcknowledgeRecoveryCode={onAcknowledgeRecoveryCode}
        />
      </AppPreferencesTestProvider>,
    );

    await screen.findByTestId("settings-sync-recovery-code-modal");
    const codeModal = screen.container
      .queryAll((node) => node.type === "Modal")
      .find((modal) => modal.props.visible);

    await act(() => {
      codeModal?.props.onRequestClose();
    });

    expect(onAcknowledgeRecoveryCode).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-sync-recovery-code-modal")).toBeTruthy();
  });

  it("keeps the recovery code modal closed when no code is set", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    await render(
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

    await render(
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

    await fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onLogin).not.toHaveBeenCalled();
    expect(onRecoverAccess).not.toHaveBeenCalled();
  });

  it("blocks an auth submit until local secrets are prepared", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onLogin = jest.fn();

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} onLogin={onLogin} />
      </AppPreferencesTestProvider>,
    );

    await fireEvent(screen.getByTestId("settings-sync-password-input"), "submitEditing");

    expect(onLogin).not.toHaveBeenCalled();
  });

  it("wires the sync-mode picker to onModeSelect, guarded while account actions are disabled", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const onModeSelect = jest.fn();

    const { rerender } = await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} onModeSelect={onModeSelect} />
      </AppPreferencesTestProvider>,
    );

    await fireEvent.press(screen.getByTestId("settings-sync-mode-self_hosted"));
    expect(onModeSelect).toHaveBeenCalledWith("self_hosted");

    onModeSelect.mockClear();
    await rerender(
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

    await fireEvent.press(screen.getByTestId("settings-sync-mode-self_hosted"));
    expect(onModeSelect).not.toHaveBeenCalled();
  });

  it("shows the endpoint validation error inline in self-hosted mode", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);
    const selfHostedPreferences = { ...props.preferences, mode: "self_hosted" as const };

    await render(
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

    await render(
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

    await render(
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

    await render(
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

    await render(
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

    await fireEvent.press(screen.getByTestId("settings-sync-account-pane-restore"));

    expect(
      await screen.findByText(viewData.errors.invalidRecoveryPhrase),
    ).toBeTruthy();
  });

  // The managed backend's web-checkout billing surface is gone, so an active
  // managed plan renders no in-app renewal controls at all. The plan step keeps
  // its banner, countdown, and withdrawal notice; cancelling is done wherever
  // the subscription was bought, as the delete-account warning already says.
  it("renders an active managed plan step without any renewal controls", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
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
            managedPlanStatus: "active",
            notSetLabel: "Not set",
            preferences: props.preferences,
            syncCapabilities: null,
            viewData,
          })}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("settings-sync-plan-step")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-withdrawal-notice")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-renewal-row")).toBeNull();
    expect(
      screen.queryByTestId("settings-sync-renewal-cancel-button"),
    ).toBeNull();
    expect(
      screen.queryByTestId("settings-sync-renewal-resume-button"),
    ).toBeNull();
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

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          billingOffers={[announcementOffer, screenOffer]}
          onOfferCTAPress={onOfferCTAPress}
        />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByText(viewData.offerAnnouncementEyebrow)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("settings-sync-offer-offer-screen-cta"));
    expect(onOfferCTAPress).toHaveBeenCalledWith(screenOffer);
  });

  it("acknowledges the recovery phrase from the reveal modal's confirm button", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onAcknowledgeRecoveryPhrase = jest.fn();
    const props = createBaseProps(viewData);

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          generatedRecoveryPhrase="alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu"
          onAcknowledgeRecoveryPhrase={onAcknowledgeRecoveryPhrase}
        />
      </AppPreferencesTestProvider>,
    );

    await screen.findByTestId("settings-sync-recovery-modal");
    await fireEvent.press(
      screen.getByTestId("settings-sync-recovery-modal-confirm-button"),
    );

    expect(onAcknowledgeRecoveryPhrase).toHaveBeenCalledTimes(1);
  });

  it("hides the phrase card together with the modal once the phrase is acknowledged", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const props = createBaseProps(viewData);

    const view = await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          generatedRecoveryPhrase="alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu"
        />
      </AppPreferencesTestProvider>,
    );
    await screen.findByTestId("settings-sync-recovery-modal");

    await view.rerender(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection {...props} generatedRecoveryPhrase="" />
      </AppPreferencesTestProvider>,
    );

    expect(screen.queryByTestId("settings-sync-recovery-modal")).toBeNull();
    expect(screen.queryByTestId("settings-sync-recovery-card")).toBeNull();
  });

  it("keeps the recovery-phrase modal open on the system back gesture without acknowledging it", async () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 21), "en").account;
    const onAcknowledgeRecoveryPhrase = jest.fn();
    const props = createBaseProps(viewData);

    await render(
      <AppPreferencesTestProvider>
        <SettingsSyncSetupSection
          {...props}
          generatedRecoveryPhrase="alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu"
          onAcknowledgeRecoveryPhrase={onAcknowledgeRecoveryPhrase}
        />
      </AppPreferencesTestProvider>,
    );

    await screen.findByTestId("settings-sync-recovery-modal");
    const phraseModal = screen.container
      .queryAll((node) => node.type === "Modal")
      .find((modal) => modal.props.visible);

    await act(() => {
      phraseModal?.props.onRequestClose();
    });

    expect(onAcknowledgeRecoveryPhrase).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-sync-recovery-modal")).toBeTruthy();
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
      await render(
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

      const form = screen.container
        .queryAll(
          (node) =>
            node.props["data-testid"] === "settings-sync-account-form" &&
            typeof node.props.onSubmit === "function",
        )
        .at(0);

      await act(() => {
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
