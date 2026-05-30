export type ConfirmationOutcome = "accept" | "reject" | "dismiss";

export type ConfirmationRequest = {
  acceptLabel: string;
  cancelLabel: string;
  neutralLabel?: string | null;
  message: string;
  resolve: (outcome: ConfirmationOutcome) => void;
};

type ConfirmationListener = (request: ConfirmationRequest) => void;

let listener: ConfirmationListener | null = null;
let isPending = false;

export function registerConfirmationListener(next: ConfirmationListener): () => void {
  listener = next;
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

export function requestConfirmationOutcome(
  message: string,
  acceptLabel: string,
  cancelLabel: string,
  neutralLabel?: string | null,
): Promise<ConfirmationOutcome> {
  return new Promise<ConfirmationOutcome>((resolve) => {
    if (!listener) {
      resolve("dismiss");
      return;
    }
    if (isPending) {
      return;
    }
    isPending = true;
    const wrappedResolve = (outcome: ConfirmationOutcome) => {
      isPending = false;
      resolve(outcome);
    };
    listener({
      message,
      acceptLabel,
      cancelLabel,
      neutralLabel: neutralLabel ?? null,
      resolve: wrappedResolve,
    });
  });
}

export function requestConfirmation(
  message: string,
  acceptLabel: string,
  cancelLabel: string,
): Promise<boolean> {
  return requestConfirmationOutcome(message, acceptLabel, cancelLabel).then(
    (outcome) => outcome === "accept",
  );
}

export function __resetConfirmationListenerForTesting(): void {
  if (__DEV__) {
    listener = null;
    isPending = false;
  }
}
