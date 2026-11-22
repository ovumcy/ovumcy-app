// Byte cap enforced by the platform file pickers BEFORE the file content is
// read into memory. 20k sanitized day logs serialize to well under this bound,
// so any larger file cannot be a legitimate Ovumcy export. Kept apart from
// import-service so the pickers do not load the import walker.
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
