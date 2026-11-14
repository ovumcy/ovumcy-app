# Contributing to Ovumcy App

Thanks for contributing.

## Development

Setup, scripts, and testing are described in [README.md](README.md) and
[TESTING.md](TESTING.md). In short:

```bash
npm install
npm run typecheck
npm run lint
npm test
```

Security issues should not be reported publicly. Use [SECURITY.md](SECURITY.md).

## Translations

Copy lives in typed catalogs under `src/i18n/` (one module per surface, for example
`day-log-copy.ts` and `stats-copy.ts`), with one entry per supported language: en, ru, de, fr,
es, it. There is no external catalog file to edit. The compiler requires every language to be
present in each catalog, so a missing translation fails `npm run typecheck`. Language resolution
is described in the i18n runtime section of [docs/architecture.md](docs/architecture.md).

- Keep the existing register of each language. Russian addresses the reader formally
  («вы», «сохраните»), never informally.
- Russian counts use the helpers in `src/i18n/ru-plural.ts` instead of hand-written plural
  rules.
- Do not put secrets or health data into copy, and keep wording free of medical advice.

## Pull Request Rules

- Keep changes scoped and atomic.
- Add or adjust tests for behavioral changes.
- Keep the local-first, zero-knowledge posture honest: no telemetry, no
  plaintext health-data transport, and no secret or PII exposure in logs, deep
  links, or notification payloads.

## Contribution Licensing

By submitting a contribution to this repository (for example, a pull request),
you agree that:

- your contribution is licensed to the project and its users under the
  repository's license, the PolyForm Noncommercial License 1.0.0; and
- you additionally grant Ovumcy a perpetual, worldwide, non-exclusive,
  royalty-free, irrevocable license to use, reproduce, modify, distribute, and
  relicense your contribution under any terms, including commercial terms and
  inclusion in Ovumcy's proprietary products (such as Ovumcy Managed).

You confirm that you are legally entitled to grant these rights and that, to
your knowledge, the contribution is your original work.
