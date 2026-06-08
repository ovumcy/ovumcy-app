import { Asset } from "expo-asset";
import { File } from "expo-file-system";

export type ExportPDFFontBytes = {
  regular: Uint8Array;
  bold: Uint8Array;
};

const regularFontModule = require("../../assets/fonts/DejaVuSansCondensed.ttf");
const boldFontModule = require("../../assets/fonts/DejaVuSansCondensed-Bold.ttf");

let fontBytesPromise: Promise<ExportPDFFontBytes> | null = null;

export async function loadExportPDFFontBytes(): Promise<ExportPDFFontBytes> {
  if (!fontBytesPromise) {
    fontBytesPromise = loadFontBytes().catch((error) => {
      // Drop the cached rejection so a later export can retry instead of
      // staying broken for the rest of the session.
      fontBytesPromise = null;
      throw error;
    });
  }

  return fontBytesPromise;
}

async function loadFontBytes(): Promise<ExportPDFFontBytes> {
  const [regular, bold] = await Promise.all([
    loadFontAssetBytes(regularFontModule),
    loadFontAssetBytes(boldFontModule),
  ]);

  return {
    regular,
    bold,
  };
}

async function loadFontAssetBytes(moduleID: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(moduleID);
  // Always resolve the asset to a local file first. In a Metro dev build
  // `asset.uri` is an http(s) URL, and reading binary fonts through RN's
  // `fetch().arrayBuffer()` corrupts the bytes (the body is decoded as text),
  // so fontkit then rejects the TTF and the whole PDF export fails. Calling
  // `downloadAsync()` copies the bundled/served asset into the cache as a
  // `file://` path we can read verbatim, and it is a no-op once cached.
  if (!asset.localUri) {
    await asset.downloadAsync();
  }

  const assetURI = asset.localUri ?? asset.uri;
  if (!assetURI) {
    throw new Error("Unable to resolve bundled font asset");
  }

  if (assetURI.startsWith("file:")) {
    const bytes = await new File(assetURI).bytes();
    return new Uint8Array(bytes);
  }

  // Web (and any other non-file URI): browser `fetch` decodes binary correctly.
  const response = await fetch(assetURI);
  if (!response.ok) {
    throw new Error(`Unable to download bundled font asset: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
