export type LocalBootstrapState = {
  hasCompletedOnboarding: boolean;
  profileVersion: number;
};

export interface LocalAppStorage {
  readBootstrapState(): Promise<LocalBootstrapState>;
  writeBootstrapState(state: LocalBootstrapState): Promise<void>;
}
