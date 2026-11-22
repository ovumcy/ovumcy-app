import { fetch as expoFetch } from "expo/fetch";

export type RedirectRefusingFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

/**
 * React Native's global fetch (whatwg-fetch over XHR) never reads
 * `redirect`, so the platform stack follows a 307/308 and re-sends the
 * request body to the new host. expo/fetch honours `redirect: "error"` in
 * OkHttp and URLSession, refusing before the redirected request is sent; on
 * web it resolves to the browser fetch, which honours the flag itself.
 */
export const redirectRefusingFetch: RedirectRefusingFetch = (url, init) =>
  expoFetch(url, init);

function originOf(url: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(url);
  if (!match) {
    return null;
  }
  const authority = match[2]!;
  const host = authority.slice(authority.lastIndexOf("@") + 1).toLowerCase();
  return `${match[1]!.toLowerCase()}://${host}`;
}

/**
 * True when a response did not come straight from the requested origin: the
 * fetch reports a followed redirect, or the final URL is on another origin.
 * An empty response URL (a synthetic or test Response) is not evidence of a
 * redirect. An unparseable request URL fails closed.
 */
export function responseLeftRequestOrigin(
  requestURL: string,
  response: Pick<Response, "redirected" | "url">,
): boolean {
  if (response.redirected === true) {
    return true;
  }
  if (!response.url) {
    return false;
  }
  const expected = originOf(requestURL);
  return expected === null || originOf(response.url) !== expected;
}
