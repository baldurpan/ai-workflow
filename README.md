# ai-workflow

A tiered planning workflow — roadmap, plans, phase ledgers, verification gates, release notes — that
coding agents run against a repository you already have.

```bash
npx @baldurpan/create-ai-workflow      # or: npm create @baldurpan/ai-workflow
```

## Layout

This is an npm workspaces monorepo. Everything publishable lives under `packages/`; anything with a
front end — a landing site, hosted documentation — belongs in `apps/`.

| Path | What it is | Published |
| --- | --- | --- |
| [`packages/create-ai-workflow`](packages/create-ai-workflow) | The installer CLI, and the templates it writes | [`@baldurpan/create-ai-workflow`](https://www.npmjs.com/package/@baldurpan/create-ai-workflow) |

Read [`packages/create-ai-workflow/README.md`](packages/create-ai-workflow/README.md) for what the
workflow actually does — the three tiers, the commands, and the files it writes.

## Working on it

```bash
npm install        # installs every workspace
npm test           # runs each workspace's tests
npm run build      # compiles each workspace
```

Scoping to one package works the usual way:

```bash
npm test -w @baldurpan/create-ai-workflow
```

## Releasing

Releases are cut by CI; nothing is published from a laptop, and there is no release form to fill in.

**Every change to the package carries a release note** — one file in [`.changeset/`](.changeset), written
with the change it describes. Merging it ships nothing; the note lands and waits.

**To release**, on a `release/*` branch:

```bash
npm run changeset:prepare-release   # consumes the notes, moves the version, writes the CHANGELOG
```

Open that as a pull request and merge it. [`publish.yml`](.github/workflows/publish.yml) sees the version
move and does the rest: test, build, publish to npm over OIDC trusted publishing with a provenance
attestation, push the `vX.Y.Z` tag, and write the GitHub Release with the changelog entry as its body.
There is no npm token in this repository.

`npm run changeset:status` reports what is pending. [`release-note.yml`](.github/workflows/release-note.yml)
asks the same question on every pull request, and exempts `release/*` branches — a release branch has just
consumed its notes and legitimately has none.

**A prerelease is a version with a hyphen.** `0.14.0-rc.1` publishes under the `next` dist-tag and marks the
GitHub Release as a prerelease; nothing else has to be remembered, and there is no checkbox left to
disagree with the version it was shipping.

Two things not to break. **This workflow's filename and its `release` environment are pinned in npm's
trusted publisher connection**, which cannot be edited — only deleted and recreated — so renaming either
401s every publish until someone re-registers it. The connection does not pin the trigger, which is why the
`on:` block is free to change. And **the tag and the release are cut inside the publishing job on purpose**:
events raised with the default `GITHUB_TOKEN` do not start new workflow runs, so a release created by one
workflow can never wake another one. Doing it in a single job is what keeps this repository free of a
personal access token.

`Run workflow` re-runs it by hand, skipping the version diff and re-attempting only what is missing — an
already-published version, an existing tag and an existing release are each detected and stepped over. It
is the way to finish a release that half-landed.

## Planning documents

[`PLAN.md`](PLAN.md) is the live worklist. [`DESIGN-RECORD.md`](DESIGN-RECORD.md) is the record of
decisions already made and why — read it before reopening a settled question.

## License

MIT — see [LICENSE](LICENSE).
