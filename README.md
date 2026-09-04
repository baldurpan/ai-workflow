# ai-workflow

A tiered planning workflow — roadmap, plans, phase ledgers, verification gates — that coding agents
run against a repository you already have.

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

Releases are cut by CI; nothing is published from a laptop. Change `version` in the package's own
`package.json` and push to `main` — [`tag-on-version-change.yml`](.github/workflows/tag-on-version-change.yml)
creates the matching `vX.Y.Z` tag. Publishing that tag as a GitHub release triggers
[`publish.yml`](.github/workflows/publish.yml), which authenticates to npm over OIDC trusted
publishing and attaches a provenance attestation. There is no npm token in this repository.

Marking the GitHub release as a pre-release publishes under the `next` dist-tag instead of `latest`.

## Planning documents

[`PLAN.md`](PLAN.md) is the live worklist. [`DESIGN-RECORD.md`](DESIGN-RECORD.md) is the record of
decisions already made and why — read it before reopening a settled question.

## License

MIT — see [LICENSE](LICENSE).
