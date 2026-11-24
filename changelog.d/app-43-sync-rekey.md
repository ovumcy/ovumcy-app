### Changed

- **Self-hosted sync writes a new recovery key and its backup together.** On a server that offers
  `PUT /sync/rekey`, an upload that stores a new or replaced recovery-key package sends it with the
  backup in one request. Either both are saved or neither is, so a failed upload can no longer
  leave the old backup under a key it was not sealed with. Older servers keep the previous
  two-step upload.
