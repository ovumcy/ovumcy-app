### Fixed

- **A recovery-code regenerate that loses its answer now warns you.** The server replaces the code before it answers, so when the answer never arrives (a network drop or an unreadable server reply), Account security now says the old code may already be dead and asks you to generate a new one again. Before, it showed only a plain network error.
