import { StyleSheet, Text, View } from "react-native";

import type { PartnerCopy } from "../../../i18n/partner-copy";
import type {
  ManagedCloudPartnerAccessGrant,
  ManagedCloudPartnerAccessLevel,
  ManagedCloudPartnerAccessOverview,
  ManagedCloudPartnerInvite,
} from "../../../sync/managed-cloud-api-client";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type SettingsPartnerAccessSectionProps = {
  copy: PartnerCopy;
  errorMessage: string;
  hasManagedSession: boolean;
  inviteAccessLevel: ManagedCloudPartnerAccessLevel;
  inviteEmailValue: string;
  inviteLink: string;
  isBusy: boolean;
  onAcceptInvite: () => void | Promise<void>;
  onAccessLevelChange: (value: ManagedCloudPartnerAccessLevel) => void;
  onInviteEmailChange: (value: string) => void;
  onIssueInvite: () => void | Promise<void>;
  onRevokeGrant: (grantID: string) => void | Promise<void>;
  onRevokeInvite: (inviteID: string) => void | Promise<void>;
  overview: ManagedCloudPartnerAccessOverview | null;
  pendingInviteToken: string;
  showOwnerControls: boolean;
  statusMessage: string;
};

export function SettingsPartnerAccessSection({
  copy,
  errorMessage,
  hasManagedSession,
  inviteAccessLevel,
  inviteEmailValue,
  inviteLink,
  isBusy,
  onAcceptInvite,
  onAccessLevelChange,
  onInviteEmailChange,
  onIssueInvite,
  onRevokeGrant,
  onRevokeInvite,
  overview,
  pendingInviteToken,
  showOwnerControls,
  statusMessage,
}: SettingsPartnerAccessSectionProps) {
  const styles = useThemedStyles(createStyles);
  const ownedInvites = overview?.owned.invites ?? [];
  const ownedGrants = overview?.owned.grants ?? [];
  const sharedWithMeGrants = overview?.sharedWithMe ?? [];
  const hasOwnerHistory = ownedInvites.length > 0 || ownedGrants.length > 0;
  const hasSharedAccess = sharedWithMeGrants.length > 0;

  return (
    <FeatureCard
      description={copy.subtitle}
      testID="settings-partner-section"
      title={copy.title}
    >
      <View style={styles.stack}>
        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            testID="settings-partner-status-banner"
            tone="success"
          />
        ) : null}

        {errorMessage ? (
          <StatusBanner
            message={errorMessage}
            testID="settings-partner-error-banner"
            tone="error"
          />
        ) : null}

        {pendingInviteToken ? (
          <View style={styles.card} testID="settings-partner-accept-card">
            <Text style={styles.sectionTitle}>{copy.acceptTitle}</Text>
            <Text style={styles.helperText}>
              {hasManagedSession ? copy.acceptReadyHint : copy.acceptSignInHint}
            </Text>
            <AppButton
              disabled={!hasManagedSession || isBusy}
              label={copy.acceptActionLabel}
              onPress={onAcceptInvite}
              testID="settings-partner-accept-button"
            />
          </View>
        ) : null}

        {showOwnerControls || hasOwnerHistory ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{copy.ownerTitle}</Text>
            <Text style={styles.helperText}>{copy.ownerHint}</Text>

            {showOwnerControls ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>{copy.inviteEmailLabel}</Text>
                  <AppTextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isBusy}
                    keyboardType="email-address"
                    onChangeText={onInviteEmailChange}
                    placeholder={copy.inviteEmailPlaceholder}
                    style={styles.input}
                    testID="settings-partner-invite-email-input"
                    value={inviteEmailValue}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>{copy.accessLevelLabel}</Text>
                  <ChoiceGroup
                    layout="grid2"
                    onSelect={(value) => {
                      onAccessLevelChange(value as ManagedCloudPartnerAccessLevel);
                    }}
                    options={[
                      { value: "summary", label: copy.accessLevelSummary },
                      { value: "full", label: copy.accessLevelFull },
                    ]}
                    selectedValue={inviteAccessLevel}
                    testIDPrefix="settings-partner-access-level"
                  />
                </View>

                <AppButton
                  disabled={isBusy}
                  label={copy.issueInviteLabel}
                  onPress={onIssueInvite}
                  testID="settings-partner-issue-button"
                />
              </>
            ) : (
              <StatusBanner
                message={copy.planLocked}
                testID="settings-partner-plan-banner"
                tone="info"
              />
            )}

            {inviteLink ? (
              <View style={styles.linkCard} testID="settings-partner-invite-link-card">
                <Text style={styles.fieldLabel}>{copy.inviteLinkTitle}</Text>
                <Text style={styles.linkText} testID="settings-partner-invite-link">
                  {inviteLink}
                </Text>
                <Text style={styles.helperText}>{copy.inviteLinkHint}</Text>
              </View>
            ) : null}

            <PartnerInviteList
              copy={copy}
              invites={ownedInvites}
              onRevokeInvite={onRevokeInvite}
              styles={styles}
            />
            <PartnerGrantList
              copy={copy}
              grants={ownedGrants}
              onRevokeGrant={onRevokeGrant}
              styles={styles}
            />
          </View>
        ) : null}

        {hasSharedAccess ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{copy.sharedWithMeTitle}</Text>
            <Text style={styles.helperText}>{copy.sharedWithMeHint}</Text>
            <PartnerSharedGrantList
              copy={copy}
              grants={sharedWithMeGrants}
              styles={styles}
            />
          </View>
        ) : null}
      </View>
    </FeatureCard>
  );
}

function PartnerInviteList({
  copy,
  invites,
  onRevokeInvite,
  styles,
}: {
  copy: PartnerCopy;
  invites: ManagedCloudPartnerInvite[];
  onRevokeInvite: (inviteID: string) => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.subsection}>
      <Text style={styles.sectionTitle}>{copy.pendingInvitesTitle}</Text>
      {invites.length === 0 ? (
        <Text style={styles.helperText}>{copy.pendingInvitesEmpty}</Text>
      ) : (
        invites.map((invite) => (
          <View
            key={invite.id}
            style={styles.itemCard}
            testID={`settings-partner-invite-${invite.id}`}
          >
            <Text style={styles.itemTitle}>{invite.invitedEmail}</Text>
            <Text style={styles.helperText}>
              {invite.accessLevel === "full"
                ? copy.accessLevelFull
                : copy.accessLevelSummary}
            </Text>
            <AppButton
              label={copy.revokeInviteLabel}
              onPress={() => {
                void onRevokeInvite(invite.id);
              }}
              testID={`settings-partner-revoke-invite-${invite.id}`}
              variant="secondary"
            />
          </View>
        ))
      )}
    </View>
  );
}

function PartnerGrantList({
  copy,
  grants,
  onRevokeGrant,
  styles,
}: {
  copy: PartnerCopy;
  grants: ManagedCloudPartnerAccessGrant[];
  onRevokeGrant: (grantID: string) => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.subsection}>
      <Text style={styles.sectionTitle}>{copy.activePartnersTitle}</Text>
      {grants.length === 0 ? (
        <Text style={styles.helperText}>{copy.activePartnersEmpty}</Text>
      ) : (
        grants.map((grant) => (
          <View
            key={grant.id}
            style={styles.itemCard}
            testID={`settings-partner-grant-${grant.id}`}
          >
            <Text style={styles.itemTitle}>{grant.partnerEmail}</Text>
            <Text style={styles.helperText}>
              {grant.accessLevel === "full"
                ? copy.accessLevelFull
                : copy.accessLevelSummary}
            </Text>
            <Text style={styles.helperText}>
              {copy.lastSeenLabel}: {grant.lastSeenAt ?? copy.lastSeenNever}
            </Text>
            <AppButton
              label={copy.revokeGrantLabel}
              onPress={() => {
                void onRevokeGrant(grant.id);
              }}
              testID={`settings-partner-revoke-grant-${grant.id}`}
              variant="secondary"
            />
          </View>
        ))
      )}
    </View>
  );
}

function PartnerSharedGrantList({
  copy,
  grants,
  styles,
}: {
  copy: PartnerCopy;
  grants: ManagedCloudPartnerAccessGrant[];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.subsection}>
      {grants.length === 0 ? (
        <Text style={styles.helperText}>{copy.sharedWithMeEmpty}</Text>
      ) : (
        grants.map((grant) => (
          <View
            key={grant.id}
            style={styles.itemCard}
            testID={`settings-partner-shared-grant-${grant.id}`}
          >
            <Text style={styles.itemTitle}>
              {grant.accessLevel === "full"
                ? copy.accessLevelFull
                : copy.accessLevelSummary}
            </Text>
            <Text style={styles.helperText}>
              {copy.lastSeenLabel}: {grant.lastSeenAt ?? copy.lastSeenNever}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    subsection: {
      gap: spacing.sm,
    },
    formGroup: {
      gap: spacing.sm,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    linkCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    linkText: {
      color: colors.text,
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
    itemTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
  });
