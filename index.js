// F9: Strip invite_token from window.location before any other JS module
// (metro-runtime, expo-router, layouts) has a chance to read it. Must be
// the first import so it runs ahead of expo-router's initial URL parse.
import './src/security/web-invite-token-scrub-bootstrap';

// The rest mirrors expo-router/entry-classic.
import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

renderRootComponent(App);
