import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { onboardingCopy } from "../../i18n/app-copy";
import {
  appStorage,
  resolveEntryHref,
} from "../../services/app-bootstrap-service";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors } from "../theme/tokens";

type AppEntryScreenProps = {
  storage?: typeof appStorage;
};

export function AppEntryScreen({
  storage = appStorage,
}: AppEntryScreenProps) {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    void storage.readBootstrapState().then((state) => {
      if (!isMounted) {
        return;
      }

      router.replace(resolveEntryHref(state));
    });

    return () => {
      isMounted = false;
    };
  }, [router, storage]);

  return (
    <ScreenScaffold
      eyebrow="Ovumcy"
      title={onboardingCopy.loading}
      description="Preparing your local-first app shell."
    >
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    </ScreenScaffold>
  );
}
