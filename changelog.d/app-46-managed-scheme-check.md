### Security

- **A plaintext managed sync address is refused.** The built-in sync address must use https, or
  plain http only to a local-network host; a public http address now fails closed instead of
  being treated as secure.
