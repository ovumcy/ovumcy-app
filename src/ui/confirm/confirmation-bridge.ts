export type ConfirmationRequest = {
  acceptLabel: string;
  cancelLabel: string;
  message: string;
  resolve: (value: boolean) => void;
};

type ConfirmationListener = (request: ConfirmationRequest) => void;

let listener: ConfirmationListener | null = null;

export function registerConfirmationListener(next: ConfirmationListener): () => void {
  listener = next;
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

export function requestConfirmation(
  message: string,
  acceptLabel: string,
  cancelLabel: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!listener) {
      resolve(false);
      return;
    }
    listener({ message, acceptLabel, cancelLabel, resolve });
  });
}

export function __resetConfirmationListenerForTesting(): void {
  listener = null;
}
