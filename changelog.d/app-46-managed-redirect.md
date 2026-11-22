### Security

- **Ovumcy Cloud requests can no longer be redirected to another host.** On Android and iOS the app's network layer now refuses any redirect before following it, so a redirect can no longer carry your session token, password, two-factor code or encrypted data to a foreign server. A response from another origin is treated as a network failure.
