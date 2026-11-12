import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { renderRouter, screen } from "expo-router/testing-library";

// Pins how expo-router decodes the query string of an incoming link into route
// params. The managed partner invite token arrives this way
// (/backup-sync?invite_token=…), so a router upgrade that changes decoding
// changes which token is captured.
function ParamsProbe() {
  const params = useLocalSearchParams();
  return <Text testID="params">{JSON.stringify(params)}</Text>;
}

async function paramsFor(initialUrl: string): Promise<Record<string, unknown>> {
  await renderRouter({ "backup-sync": ParamsProbe }, { initialUrl });
  return JSON.parse(String(screen.getByTestId("params").props.children));
}

describe("deep-link query parsing", () => {
  it("passes a plain token through unchanged", async () => {
    expect(await paramsFor("/backup-sync?invite_token=abc-DEF_123.xyz")).toEqual({
      invite_token: "abc-DEF_123.xyz",
    });
  });

  it("percent-decodes reserved characters", async () => {
    expect(await paramsFor("/backup-sync?invite_token=a%2Bb%2Fc%3Dd%26e")).toEqual({
      invite_token: "a+b/c=d&e",
    });
  });

  it("decodes a literal plus sign as a space", async () => {
    expect(await paramsFor("/backup-sync?invite_token=a+b")).toEqual({
      invite_token: "a b",
    });
  });

  it("collects a repeated key into an array", async () => {
    expect(await paramsFor("/backup-sync?invite_token=one&invite_token=two")).toEqual({
      invite_token: ["one", "two"],
    });
  });

  it("does not throw on malformed percent-encoding", async () => {
    await expect(paramsFor("/backup-sync?invite_token=%E0%A4%A")).resolves.toBeDefined();
  });

  it("treats an empty value as an empty string", async () => {
    expect(await paramsFor("/backup-sync?invite_token=")).toEqual({ invite_token: "" });
  });
});
