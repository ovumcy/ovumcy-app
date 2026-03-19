import fontkit from "@pdf-lib/fontkit/dist/fontkit.es.js";
import { PDFDocument, PageSizes, rgb } from "pdf-lib/dist/pdf-lib.esm.js";

export const fontkitRuntime = fontkit;
export const PDFDocumentRuntime = PDFDocument;
export const PageSizesRuntime = PageSizes;
export const rgbRuntime = rgb;
