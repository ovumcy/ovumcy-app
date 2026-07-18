import { StyleSheet, Text, View } from "react-native";

import type { PartnerCopy } from "../../../i18n/partner-copy";
import { formatBackupSyncLastSeen } from "../../../services/backup-sync-view-service";
import type {
  ManagedCloudPartnerAccessGrant,
  ManagedCloudPartnerAccessLevel,
  ManagedCloudPartnerAccessOverview,
  ManagedCloudPartnerInvite,
} from "../../../sync/managed-cloud-api-client";
import { AppButton } from "../../components/AppButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { PremiumLockCard } from "../../components/PremiumLockCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type SettingsPartnerAccessSectionProps = {
  copy: PartnerCopy;
  errorMessage: string;
  hasManagedSession: boolean;
  inviteAccessLevel: ManagedCloudPartnerAccessLevel;
  inviteLink: string;
  isBusy: boolean;
  locale?: string | undefined;
  onAcceptInvite: () => void | Promise<void>;
  onAcceptInviteAsGuest: () => void | Promise<void>;
  onAccessLevelChange: (value: ManagedCloudPartnerAccessLevel) => void;
  onChooseSignIn: () => void;
  onIssueInvite: () => void | Promise<void>;
  onOpenGrant: (grantID: string) => void | Promise<void>;
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
  inviteLink,
  isBusy,
  locale,
  onAcceptInvite,
  onAcceptInviteAsGuest,
  onAccessLevelChange,
  onChooseSignIn,
  onIssueInvite,
  onOpenGrant,
  onRevokeGrant,
  onRevokeInvite,
  overview,
  pendingInviteToken,
  showOwnerControls,
  statusMessage,
}: SettingsPartnerAccessSectionProps) {
  const styles = useThemedStyles(createStyles);
  const ownedInvites = overview?.owned.invites ?? [];
  // "Pending invites" should list only invites still awaiting a response: an
  // accepted invite already shows up as an active grant below, and a revoked
  // one is gone, so keeping either here makes the list lie about what is
  // actionable.
  const pendingOwnedInvites = ownedInvites.filter(
    (invite) => !invite.acceptedAt && !invite.revokedAt,
  );
  const ownedGrants = overview?.owned.grants ?? [];
  // "Active partner access" must list only live grants. A revoked grant stays in
  // owned.grants, but showing it here leaves the owner unsure whether a revoke
  // worked; filtering it out makes the success banner and the now-empty list
  // agree that access is gone.
  const activeOwnedGrants = ownedGrants.filter((grant) => !grant.revokedAt);
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
            {hasManagedSession ? (
              <>
                <Text style={styles.helperText}>{copy.acceptReadyHint}</Text>
                <AppButton
                  disabled={isBusy}
                  label={copy.acceptActionLabel}
                  onPress={onAcceptInvite}
                  testID="settings-partner-accept-button"
                />
              </>
            ) : (
              // No managed session yet on this device: the invite is
              // single-use, so neither option here may fire automatically —
              // both require an explicit tap. "Accept as guest" redeems the
              // invite in one tap with no form; "Sign in to accept" leaves
              // the token untouched so whoever is accepting can instead sign
              // in with the account fields on this screen and then use the
              // ready-to-accept button above.
              <>
                <Text style={styles.helperText}>{copy.acceptChoiceHint}</Text>
                <AppButton
                  disabled={isBusy}
                  label={copy.acceptAsGuestActionLabel}
                  onPress={onAcceptInviteAsGuest}
                  testID="settings-partner-accept-guest-button"
                />
                <AppButton
                  disabled={isBusy}
                  label={copy.acceptSignInActionLabel}
                  onPress={onChooseSignIn}
                  testID="settings-partner-signin-to-accept-button"
                  variant="secondary"
                />
              </>
            )}
          </View>
        ) : null}

        {showOwnerControls || hasOwnerHistory ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{copy.ownerTitle}</Text>
            <Text style={styles.helperText}>{copy.ownerHint}</Text>

            {showOwnerControls ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>{copy.accessLevelLabel}</Text>
                  <ChoiceGroup
                    layout="grid2"
                    onSelect={(value) => {
                      onAccessLevelChange(value as ManagedCloudPartnerAccessLevel);
                    }}
                    options={[
                      {
                        value: "summary",
                        label: copy.accessLevelSummary,
                        secondaryLabel: copy.accessLevelSummaryHint,
                      },
                      {
                        value: "full",
                        label: copy.accessLevelFull,
                        secondaryLabel: copy.accessLevelFullHint,
                      },
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
              <PremiumLockCard
                description={copy.planLocked}
                eyebrowLabel={copy.premiumEyebrowLabel}
                testID="settings-partner-plan-lock"
                title={copy.premiumLockTitle}
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
              invites={pendingOwnedInvites}
              onRevokeInvite={onRevokeInvite}
              styles={styles}
            />
            <PartnerGrantList
              copy={copy}
              grants={activeOwnedGrants}
              locale={locale}
              onOpenGrant={onOpenGrant}
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
              locale={locale}
              onOpenGrant={onOpenGrant}
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
            <View
              accessibilityLabel={buildPartnerInviteAccessibilityLabel(invite, copy)}
              accessible
              style={styles.itemInfo}
              testID={`settings-partner-invite-info-${invite.id}`}
            >
              <Text style={styles.itemTitle}>{copy.pendingInviteLabel}</Text>
              <Text style={styles.helperText}>
                {invite.accessLevel === "full"
                  ? copy.accessLevelFull
                  : copy.accessLevelSummary}
              </Text>
            </View>
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
  locale,
  onOpenGrant,
  onRevokeGrant,
  styles,
}: {
  copy: PartnerCopy;
  grants: ManagedCloudPartnerAccessGrant[];
  locale?: string | undefined;
  onOpenGrant: (grantID: string) => void | Promise<void>;
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
            <View
              accessibilityLabel={buildPartnerGrantAccessibilityLabel(
                grant,
                copy,
                locale,
              )}
              accessible
              style={styles.itemInfo}
              testID={`settings-partner-grant-info-${grant.id}`}
            >
              <Text style={styles.itemTitle}>{copy.activePartnerLabel}</Text>
              <Text style={styles.helperText}>
                {grant.accessLevel === "full"
                  ? copy.accessLevelFull
                  : copy.accessLevelSummary}
              </Text>
              <Text style={styles.helperText}>
                {grant.accessLevel === "full"
                  ? copy.accessLevelFullHint
                  : copy.accessLevelSummaryHint}
              </Text>
              <Text style={styles.helperText}>
                {copy.lastSeenLabel}:{" "}
                {formatBackupSyncLastSeen(grant.lastSeenAt, locale, copy.lastSeenNever)}
              </Text>
            </View>
            <AppButton
              label={copy.openSharedViewLabel}
              onPress={() => {
                void onOpenGrant(grant.id);
              }}
              testID={`settings-partner-open-grant-${grant.id}`}
              variant="secondary"
            />
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
  locale,
  onOpenGrant,
  styles,
}: {
  copy: PartnerCopy;
  grants: ManagedCloudPartnerAccessGrant[];
  locale?: string | undefined;
  onOpenGrant: (grantID: string) => void | Promise<void>;
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
            <View
              accessibilityLabel={buildPartnerSharedGrantAccessibilityLabel(
                grant,
                copy,
                locale,
              )}
              accessible
              style={styles.itemInfo}
              testID={`settings-partner-shared-grant-info-${grant.id}`}
            >
              <Text style={styles.itemTitle}>
                {copy.sharedGrantLabel}
              </Text>
              <Text style={styles.helperText}>
                {grant.accessLevel === "full"
                  ? copy.accessLevelFullHint
                  : copy.accessLevelSummaryHint}
              </Text>
              <Text style={styles.helperText}>
                {copy.lastSeenLabel}:{" "}
                {formatBackupSyncLastSeen(grant.lastSeenAt, locale, copy.lastSeenNever)}
              </Text>
            </View>
            <AppButton
              label={copy.openSharedViewLabel}
              onPress={() => {
                void onOpenGrant(grant.id);
              }}
              testID={`settings-partner-open-shared-grant-${grant.id}`}
              variant="secondary"
            />
          </View>
        ))
      )}
    </View>
  );
}

function buildPartnerInviteAccessibilityLabel(
  invite: ManagedCloudPartnerInvite,
  copy: PartnerCopy,
): string {
  const accessLevelLabel =
    invite.accessLevel === "full" ? copy.accessLevelFull : copy.accessLevelSummary;

  return [copy.pendingInviteLabel, accessLevelLabel]
    .filter((value) => value.trim().length > 0)
    .join(". ");
}

function buildPartnerGrantAccessibilityLabel(
  grant: ManagedCloudPartnerAccessGrant,
  copy: PartnerCopy,
  locale: string | undefined,
): string {
  const accessLevelLabel =
    grant.accessLevel === "full" ? copy.accessLevelFull : copy.accessLevelSummary;
  const accessLevelHint =
    grant.accessLevel === "full" ? copy.accessLevelFullHint : copy.accessLevelSummaryHint;

  return [
    copy.activePartnerLabel,
    accessLevelLabel,
    accessLevelHint,
    `${copy.lastSeenLabel}: ${formatBackupSyncLastSeen(grant.lastSeenAt, locale, copy.lastSeenNever)}`,
  ]
    .filter((value) => value.trim().length > 0)
    .join(". ");
}

function buildPartnerSharedGrantAccessibilityLabel(
  grant: ManagedCloudPartnerAccessGrant,
  copy: PartnerCopy,
  locale: string | undefined,
): string {
  const accessLevelHint =
    grant.accessLevel === "full" ? copy.accessLevelFullHint : copy.accessLevelSummaryHint;

  return [
    copy.sharedGrantLabel,
    accessLevelHint,
    `${copy.lastSeenLabel}: ${formatBackupSyncLastSeen(grant.lastSeenAt, locale, copy.lastSeenNever)}`,
  ]
    .filter((value) => value.trim().length > 0)
    .join(". ");
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
    itemInfo: {
      gap: spacing.sm,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
  });
