import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { getShellCopy } from "../../i18n/shell-copy";
import {
  appStorage,
  resolveInitialEntryHref,
} from "../../services/app-bootstrap-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useAppPreferences } from "../providers/AppPreferencesProvider";

type AppEntryScreenProps = {
  storage?: LocalAppStorage;
};

export function AppEntryScreen({
  storage = appStorage,
}: AppEntryScreenProps) {
  const { colors, language } = useAppPreferences();
  const router = useRouter();
  const shellCopy = getShellCopy(language);

  useEffect(() => {
    let isMounted = true;

    void resolveInitialEntryHref(storage).then((href) => {
      if (!isMounted) {
        return;
      }

      router.replace(href);
    });

    return () => {
      isMounted = false;
    };
  }, [router, storage]);

  return (
    <ScreenScaffold
      eyebrow="Ovumcy"
      title={shellCopy.loading.appShellTitle}
      description={shellCopy.loading.appShellDescription}
    >
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    </ScreenScaffold>
  );
}
