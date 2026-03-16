import { render, screen } from "@testing-library/react-native";

import { DashboardScreen } from "./DashboardScreen";

describe("DashboardScreen", () => {
  it("renders the dashboard shell copy", () => {
    render(<DashboardScreen />);

    expect(screen.getByText("Dashboard shell")).toBeTruthy();
    expect(screen.getByText("Owner-first quick logging")).toBeTruthy();
  });
});
