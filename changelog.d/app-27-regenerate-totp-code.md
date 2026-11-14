### Fixed

- **Regenerating the recovery code works with two-factor on.** On a self-hosted server with two-factor on, *Regenerate recovery code* now asks for a current 6-digit code next to the password and explains a wrong or reused code. Before, every attempt on such an account failed with a generic error, which also blocked the recovery path the app offers when the code rotated by turning two-factor on never arrived.
