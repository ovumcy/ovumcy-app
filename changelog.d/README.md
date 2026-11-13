# Changelog fragments

Every pull request adds one fragment, `changelog.d/<slug>.md`, instead of editing
[CHANGELOG.md](../CHANGELOG.md). The slug is the branch name without its type prefix, any
further slashes turned into hyphens: `fix/ci-parity` adds `changelog.d/ci-parity.md`,
`fix/sync/retry` adds `changelog.d/sync-retry.md`. A file per branch has no shared anchor, so
concurrent pull requests do not conflict on the `[Unreleased]` section. Dependabot pull requests
are exempt.

A fragment holds the text that would go under `[Unreleased]`: a Keep a Changelog section header
plus the entry.

```markdown
### Fixed

- **Short summary.** What changed, and what a user notices.
```

- Valid headers: `### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed`,
  `### Security`, `### Internal`, `### Dependencies`. Several sections may appear in one fragment;
  each needs at least one `- ` entry.
- A change with no user-visible effect adds a fragment whose first line is exactly `none`;
  anything below that line is ignored, so the reason can follow.
- The `changelog-fragment` CI check (`scripts/check-changelog-fragment.mjs`) fails a pull request
  that adds no fragment, names it differently from the branch slug, or writes an invalid one.
- Fragments are folded into CHANGELOG.md by hand when a release is cut, and then deleted.
