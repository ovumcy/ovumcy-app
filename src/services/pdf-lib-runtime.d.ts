declare module "pdf-lib/dist/pdf-lib.esm.js" {
  export * from "pdf-lib";
}

declare module "@pdf-lib/fontkit/dist/fontkit.es.js" {
  import fontkit from "@pdf-lib/fontkit";

  export default fontkit;
}
