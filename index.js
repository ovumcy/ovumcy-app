// F9: Strip invite_token from window.location before any other JS module
// (metro-runtime, expo-router, layouts) has a chance to read it. Must be
// the first import so it runs ahead of expo-router's initial URL parse.
import './src/security/web-invite-token-scrub-bootstrap';

import '@expo/metro-runtime';

import { withErrorOverlay } from '@expo/metro-runtime/error-overlay';
import { App } from 'expo-router/build/qualified-entry';
import * as SplashScreen from 'expo-router/build/utils/splash';
import { AppRegistry, Platform } from 'react-native';

function registerAppRoot(Component) {
  AppRegistry.registerComponent('main', () => Component);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const rootTag = document.getElementById('root');
    if (process.env.NODE_ENV !== 'production' && !rootTag) {
      throw new Error('Required HTML element with id "root" was not found in the document HTML.');
    }

    if (rootTag) {
      AppRegistry.runApplication('main', {
        rootTag,
        hydrate: globalThis.__EXPO_ROUTER_HYDRATE__,
      });
    }
  }
}

setTimeout(() => {
  SplashScreen._internal_preventAutoHideAsync?.();
});

const RootComponent =
  process.env.NODE_ENV !== 'production' ? withErrorOverlay(App) : App;

registerAppRoot(RootComponent);
