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
