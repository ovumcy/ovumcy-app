### Security

- **A sync restore that stops partway no longer lets the next upload replace the backup.** The device stays marked mid-restore until a retried restore completes; uploads refuse in the meantime and the screen says the last restore did not finish.
