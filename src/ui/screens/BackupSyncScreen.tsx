import { ActivityIndicator, View } from "react-native";

import { appStorage } from "../../services/app-bootstrap-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../services/export-delivery";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useBackupSyncScreenController } from "./backup-sync/useBackupSyncScreenController";
import { BackupSyncFlowScreen } from "./BackupSyncFlowScreen";

type BackupSyncScreenProps = {
  exportDeliveryClient?: ExportDeliveryClient;
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
  now?: Date;
};

export function BackupSyncScreen({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
  now,
}: BackupSyncScreenProps) {
  const { accentColor, flowProps, loadingDescription, loadingTitle } =
    useBackupSyncScreenController({
      exportDeliveryClient,
      now,
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

  return <BackupSyncFlowScreen {...flowProps} />;
}
