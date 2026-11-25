import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { buildDataSharingConsentViewData } from "../../../services/data-sharing-consent-service";
import { openPrivacyPolicy } from "../../../services/privacy-notice-service";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { DataSharingConsentDialog } from "./DataSharingConsentDialog";

jest.mock("../../../services/privacy-notice-service", () => ({
  ...jest.requireActual("../../../services/privacy-notice-service"),
  openPrivacyPolicy: jest.fn(),
}));

const mockOpenPrivacyPolicy = jest.mocked(openPrivacyPolicy);

async function renderDialog(
  consent: ReturnType<typeof buildDataSharingConsentViewData> | null,
) {
  const onAnswer = jest.fn();
  await render(
    <AppPreferencesTestProvider>
      <DataSharingConsentDialog consent={consent} onAnswer={onAnswer} />
    </AppPreferencesTestProvider>,
  );
  return { onAnswer };
}

describe("DataSharingConsentDialog", () => {
  beforeEach(() => {
    mockOpenPrivacyPolicy.mockReset();
  });

  it("renders nothing while no consent is pending", async () => {
    await renderDialog(null);

    expect(screen.queryByTestId("data-sharing-consent-dialog")).toBeNull();
  });

  it("shows the partner copy with its never-shared line and answers each button", async () => {
    const consent = buildDataSharingConsentViewData("partner_share", "en");
    const { onAnswer } = await renderDialog(consent);

    expect(screen.getByText(consent.title)).toBeTruthy();
    expect(consent.excluded).not.toBeNull();
    expect(screen.getByText(consent.excluded ?? "")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("data-sharing-consent-decline"));
    await fireEvent.press(screen.getByTestId("data-sharing-consent-agree"));

    expect(onAnswer.mock.calls).toEqual([[false], [true]]);
  });

  it("answers no when the dialog is dismissed with Back", async () => {
    const { onAnswer } = await renderDialog(
      buildDataSharingConsentViewData("managed_sync", "en"),
    );

    await act(async () => {
      screen.container
        .queryAll((node) => node.type === "Modal")[0]
        ?.props.onRequestClose();
    });

    expect(onAnswer).toHaveBeenCalledWith(false);
  });

  it("shows the policy address when the policy cannot be opened and hides it after an answer", async () => {
    const consent = buildDataSharingConsentViewData("self_hosted_sync", "en");
    mockOpenPrivacyPolicy.mockResolvedValue(false);
    await renderDialog(consent);
    const fallback = `${consent.policyUnavailable} ${consent.policyURL}`;

    await act(async () => {
      await fireEvent.press(screen.getByText(consent.policyLinkLabel));
    });

    expect(mockOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(fallback)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("data-sharing-consent-decline"));

    expect(screen.queryByText(fallback)).toBeNull();
  });

  it("shows no fallback when the policy opens", async () => {
    const consent = buildDataSharingConsentViewData("managed_sync", "en");
    mockOpenPrivacyPolicy.mockResolvedValue(true);
    await renderDialog(consent);

    await act(async () => {
      await fireEvent.press(screen.getByText(consent.policyLinkLabel));
    });

    expect(
      screen.queryByText(`${consent.policyUnavailable} ${consent.policyURL}`),
    ).toBeNull();
  });
});
