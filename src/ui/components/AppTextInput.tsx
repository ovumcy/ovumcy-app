import {
  TextInput,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
} from "react-native";

import { useAppPreferences } from "../providers/AppPreferencesProvider";

type AppTextInputProps = TextInputProps & {
  style?: StyleProp<TextStyle>;
};

// Shared text-input primitive. Deliberately leaves `allowFontScaling` at its
// RN default (true) and applies no `maxFontSizeMultiplier`, so what the user
// types honours their OS font-size preference in full — see the Dynamic Type
// policy on `fontScale` in ../theme/tokens.ts. Pass `accessibilityLabel` from
// the call site (the visible field label) so the control is announced.

export function AppTextInput({
  placeholderTextColor,
  selectionColor,
  style,
  ...props
}: AppTextInputProps) {
  const { colors, theme } = useAppPreferences();

  return (
    <TextInput
      cursorColor={colors.accentStrong}
      keyboardAppearance={theme}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      selectionColor={selectionColor ?? colors.accentStrong}
      style={[{ color: colors.text }, style]}
      underlineColorAndroid="transparent"
      {...props}
    />
  );
}
