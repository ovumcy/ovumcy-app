import { Alert, Platform } from "react-native";

export function openConfirmation(
  message: string,
  acceptLabel: string,
): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    Alert.alert("", message, [
      {
        style: "cancel",
        text: "Cancel",
        onPress: () => finish(false),
      },
      {
        text: acceptLabel,
        onPress: () => finish(true),
      },
    ], {
      cancelable: true,
      onDismiss: () => finish(false),
    });
  });
}
