export type SyncAvailability = "disabled" | "self-hosted" | "managed";

export type SyncCapability = {
  availability: SyncAvailability;
  requiresAccount: boolean;
};

export const disabledSyncCapability: SyncCapability = {
  availability: "disabled",
  requiresAccount: false,
};
