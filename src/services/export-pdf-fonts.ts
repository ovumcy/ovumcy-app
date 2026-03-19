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
    fontBytesPromise = loadFontBytes();
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
  let assetURI = asset.localUri ?? asset.uri;
  if (!assetURI) {
    const resolved = await asset.downloadAsync();
    assetURI = resolved.localUri ?? resolved.uri;
  }
  if (!assetURI) {
    throw new Error("Unable to resolve bundled font asset");
  }

  if (assetURI.startsWith("file:")) {
    const file = new File(assetURI);
    const bytes = await file.arrayBuffer();
    return new Uint8Array(bytes);
  }

  const response = await fetch(assetURI);
  if (!response.ok) {
    throw new Error(`Unable to download bundled font asset: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
