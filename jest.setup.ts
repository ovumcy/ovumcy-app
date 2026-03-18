jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");

  return function MockDateTimePicker(
    props: Record<string, unknown> & { testID?: string },
  ) {
    return React.createElement(View, {
      ...props,
      testID: props.testID || "mock-date-picker",
    });
  };
});

jest.mock("@react-native-community/slider", () => {
  const React = require("react");
  const { View } = require("react-native");

  return function MockSlider(props: Record<string, unknown>) {
    return React.createElement(View, props);
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaConsumer: ({
      children,
    }: {
      children: (value: typeof insets) => React.ReactNode;
    }) => children(insets),
    SafeAreaView: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement(View, props, children),
    initialWindowMetrics: {
      frame,
      insets,
    },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
  };
});
