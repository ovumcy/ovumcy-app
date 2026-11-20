### Security

- **Invite secret travels only on the verified https link.** The owner device no longer appends the invite secret to a custom-scheme (`ovumcy://`) invite URL, which any installed app could claim; such a URL is refused. Opening an `ovumcy://` invite link still works.
