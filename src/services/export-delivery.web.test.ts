/**
 * @jest-environment jsdom
 */
import { createPlatformExportDeliveryClient } from "./export-delivery.web";

afterEach(() => {
  document.body.innerHTML = "";
});

// The installed jsdom version implements Blob without the convenience
// `.text()`/`.arrayBuffer()` readers, so content is verified the same way
// production code itself would read a Blob on the web: through FileReader.
function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function readBlobAsBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(
        result instanceof ArrayBuffer ? new Uint8Array(result) : new Uint8Array(),
      );
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("export-delivery.web", () => {
  it("delivers string content through a hidden download link and revokes the object URL after the hand-off delay", async () => {
    jest.useFakeTimers();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = jest.fn((_blob: Blob) => "blob:mock-object-url");
    const revokeObjectURLMock = jest.fn();
    // jest-expo's setup requires expo/src/winter, which lazily installs a
    // WinterCG URL polyfill over the jsdom global. Its createObjectURL
    // delegates to React Native's native BlobModule turbo module, which
    // doesn't exist under Jest and throws "Cannot read properties of
    // undefined (reading 'BlobModule')" on every call — an environment
    // shadow, not a product bug (the unmocked "delivery_failed" test below
    // exercises that real throw deliberately). Stubbed for this test only,
    // restored in finally.
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    // A ref-style container, not a bare closed-over `let`: TypeScript's flow
    // analysis doesn't see the mock's synchronous invocation inside
    // `deliver()` (a different function entirely), so a plain `let` reads
    // back as its initial `null` type at the assertions below.
    const capturedLinkRef: { current: HTMLAnchorElement | null } = {
      current: null,
    };
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        capturedLinkRef.current = this;
      });

    try {
      const client = createPlatformExportDeliveryClient();
      const result = await client.deliver({
        filename: "ovumcy-export-2026-07-18.csv",
        mimeType: "text/csv",
        content: "Date,Period\n2026-07-18,true\n",
      });

      expect(result).toEqual({ ok: true });

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      const deliveredBlob = createObjectURLMock.mock.calls[0]?.[0] as Blob;
      expect(deliveredBlob.type).toBe("text/csv");
      await expect(readBlobAsText(deliveredBlob)).resolves.toBe(
        "Date,Period\n2026-07-18,true\n",
      );

      const link = capturedLinkRef.current;
      if (!link) {
        throw new Error("expected the delivery client to click a download link");
      }
      expect(link.href).toBe("blob:mock-object-url");
      expect(link.download).toBe("ovumcy-export-2026-07-18.csv");
      expect(link.rel).toBe("noopener");
      // The link is a transient hand-off node, not a lingering page element.
      expect(document.body.contains(link)).toBe(false);

      // The object URL must stay alive long enough for the browser to pick
      // up the download before being invalidated.
      expect(revokeObjectURLMock).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500);
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-object-url");
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      jest.useRealTimers();
    }
  });

  it("delivers binary content by slicing exactly the artifact's byte window out of a shared buffer", async () => {
    jest.useFakeTimers();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = jest.fn((_blob: Blob) => "blob:mock-object-url-2");
    const revokeObjectURLMock = jest.fn();
    // Same environment shadow as the previous test; see that comment.
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      // A view with a non-zero byteOffset over a larger backing buffer:
      // proves delivery slices exactly the artifact's window rather than
      // handing the whole underlying buffer to the Blob, which would leak
      // the padding bytes on either side.
      const backing = new Uint8Array([0xff, 0x25, 0x50, 0x44, 0x46, 0xff]);
      const artifactBytes = new Uint8Array(backing.buffer, 1, 4);

      const client = createPlatformExportDeliveryClient();
      const result = await client.deliver({
        filename: "ovumcy-export-2026-07-18.pdf",
        mimeType: "application/pdf",
        content: artifactBytes,
      });

      expect(result).toEqual({ ok: true });
      const deliveredBlob = createObjectURLMock.mock.calls[0]?.[0] as Blob;
      expect(deliveredBlob.type).toBe("application/pdf");
      const deliveredBytes = await readBlobAsBytes(deliveredBlob);
      expect(deliveredBytes).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      jest.advanceTimersByTime(500);
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-object-url-2");
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      jest.useRealTimers();
    }
  });

  it("returns delivery_unavailable and never touches the DOM when a required browser API is missing", async () => {
    const originalBlob = globalThis.Blob;
    const createElementSpy = jest.spyOn(document, "createElement");

    try {
      (globalThis as { Blob?: typeof Blob | undefined }).Blob = undefined;

      const client = createPlatformExportDeliveryClient();
      const result = await client.deliver({
        filename: "ovumcy-export-2026-07-18.csv",
        mimeType: "text/csv",
        content: "irrelevant",
      });

      expect(result).toEqual({ ok: false, errorCode: "delivery_unavailable" });
      // The feature-detection guard must short-circuit before any DOM work.
      expect(createElementSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.Blob = originalBlob;
      createElementSpy.mockRestore();
    }
  });

  it("returns delivery_failed when the browser cannot hand off the blob (unmocked environment throw)", async () => {
    // Deliberately NOT mocking URL.createObjectURL here: under Jest, the
    // real (WinterCG-shadowed) implementation throws before any DOM node is
    // created, which is the realistic trigger for this catch branch, and
    // doubles as documentation for why the tests above must mock it —
    // without the mock, every delivery would land here instead of the
    // success branch.
    const createElementSpy = jest.spyOn(document, "createElement");

    try {
      const client = createPlatformExportDeliveryClient();
      const result = await client.deliver({
        filename: "ovumcy-export-2026-07-18.csv",
        mimeType: "text/csv",
        content: "irrelevant",
      });

      expect(result).toEqual({ ok: false, errorCode: "delivery_failed" });
      expect(createElementSpy).not.toHaveBeenCalled();
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
