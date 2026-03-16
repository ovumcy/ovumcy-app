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
