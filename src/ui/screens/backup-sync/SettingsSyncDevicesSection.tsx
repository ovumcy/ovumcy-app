import { StyleSheet, Text, View } from "react-native";

import type { DeviceCopy } from "../../../i18n/device-copy";
import type { BackupSyncDeviceListItemView } from "../../../services/backup-sync-view-service";
import { AppButton } from "../../components/AppButton";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type SettingsSyncDevicesSectionProps = {
  copy: DeviceCopy;
  // null = not loaded yet (the list is fetched on demand, never on focus).
  devices: BackupSyncDeviceListItemView[] | null;
  errorMessage: string;
  isBusy: boolean;
  onLoadDevices: () => void | Promise<void>;
  onRemoveDevice: (deviceID: string) => void | Promise<void>;
  statusMessage: string;
};

export function SettingsSyncDevicesSection({
  copy,
  devices,
  errorMessage,
  isBusy,
  onLoadDevices,
  onRemoveDevice,
  statusMessage,
}: SettingsSyncDevicesSectionProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <FeatureCard
      description={copy.subtitle}
      testID="settings-sync-devices-section"
      title={copy.title}
    >
      <View style={styles.stack}>
        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            testID="settings-sync-devices-status-banner"
            tone="success"
          />
        ) : null}

        {errorMessage ? (
          <StatusBanner
            message={errorMessage}
            testID="settings-sync-devices-error-banner"
            tone="error"
          />
        ) : null}

        {devices !== null ? (
          devices.length === 0 ? (
            <Text style={styles.helperText}>{copy.emptyLabel}</Text>
          ) : (
            devices.map((device) => (
              <View
                key={device.deviceID}
                style={styles.itemCard}
                testID={`settings-sync-device-${device.deviceID}`}
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{device.label}</Text>
                  {device.isCurrentDevice ? (
                    <Text
                      style={styles.currentBadge}
                      testID={`settings-sync-device-current-${device.deviceID}`}
                    >
                      {copy.thisDeviceBadge}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.helperText}>
                  {copy.lastSeenLabel}: {device.lastSeenText}
                </Text>
                <AppButton
                  disabled={isBusy}
                  label={copy.removeLabel}
                  onPress={() => {
                    void onRemoveDevice(device.deviceID);
                  }}
                  testID={`settings-sync-device-remove-${device.deviceID}`}
                  variant="secondary"
                />
              </View>
            ))
          )
        ) : null}

        <AppButton
          disabled={isBusy}
          label={devices === null ? copy.showDevicesLabel : copy.refreshLabel}
          onPress={onLoadDevices}
          testID="settings-sync-devices-load-button"
          variant="secondary"
        />
      </View>
    </FeatureCard>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    itemCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    itemHeader: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    itemTitle: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 15,
      fontWeight: "700",
    },
    currentBadge: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
  });
