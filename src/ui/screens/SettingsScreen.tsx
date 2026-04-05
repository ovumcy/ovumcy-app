import { ActivityIndicator, View } from "react-native";

import { appStorage } from "../../services/app-bootstrap-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../services/export-delivery";
import type { ExportServiceDependencies } from "../../services/export-service";
import type { LocalReminderScheduler } from "../../services/local-reminder-scheduler-contract";
import { createPlatformLocalReminderScheduler } from "../../services/platform-local-reminder-scheduler";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { SettingsFlowScreen } from "./SettingsFlowScreen";
import { useSettingsScreenController } from "./settings/useSettingsScreenController";

type SettingsScreenProps = {
  exportDeliveryClient?: ExportDeliveryClient;
  exportServiceDependencies?: ExportServiceDependencies;
  now?: Date;
  reminderScheduler?: LocalReminderScheduler;
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
};

export function SettingsScreen({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  exportServiceDependencies,
  now,
  reminderScheduler = createPlatformLocalReminderScheduler(),
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: SettingsScreenProps) {
  const { accentColor, flowProps, loadingDescription, loadingTitle } =
    useSettingsScreenController({
      exportDeliveryClient,
      exportServiceDependencies,
      now,
      reminderScheduler,
      storage,
      syncSecretStore,
    });

  if (!flowProps) {
    return (
      <ScreenScaffold description={loadingDescription} title={loadingTitle}>
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={accentColor} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  return <SettingsFlowScreen {...flowProps} />;
}
