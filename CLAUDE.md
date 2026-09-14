# Working in this repository

This repo builds `@baldurpan/create-ai-workflow` — a tool that installs an agent workflow into *other*
repositories. **It runs the release half of that workflow and none of the rest**: notes are recorded here
the way the tool teaches, but there is no `context/`, no skill tree, and `PLAN.md` is hand-maintained
rather than a document under `plans/`. Do not go looking for the loop, and do not install it here to make
the repository consistent with its own product — the release answer was adopted on its own merits, and the
rest has not been.

## Every change to the package carries a release note

**If you changed anything under `packages/`, write a note before you finish.** One file in `.changeset/`,
named anything — the names are random on purpose, so two branches never conflict on one:

```md
---
"@baldurpan/create-ai-workflow": patch
---

What changed, for somebody deciding whether this affects them.
```

**Write the file directly. Do not run `changeset add`.** It has no flag for package selection or for the
bump level, so `-m` still drops into an interactive picker, and with stdin closed it hangs on an unsettled
await and writes nothing. The file is the documented format and writing it by hand is the only path that
works unattended. `npm run changeset:add` exists for a human at a terminal.

**One or two sentences.** The note is read by someone deciding whether to upgrade, not reviewing the diff.
The reasoning goes in `DESIGN-RECORD.md` and the commit body, which is where this repository puts it.

**Pick the level deliberately** — `major` breaks someone's install, `minor` adds, `patch` fixes. A change to
`templates/` is a change to what every install inherits, so it is rarely a patch.

**A change that touches no package needs no note**, and the check knows: `.github/`, `README.md`, `PLAN.md`
and `DESIGN-RECORD.md` are not the package. Say that you checked and that none was owed, rather than
staying silent about it.

**`release-note.yml` asks the same question on every push to `main`**, comparing against the last release
tag. A red run there means a note is owed for something already landed — nothing is broken and nothing is
blocked. Write the note and push.

**Re-entering work does not write a second note.** If a note for this change is already in `.changeset/`,
update it. Two files describing one change do not conflict and are both counted, which is the one case
where doing the right thing twice is the failure.

## Releasing — read this before touching a version

**Landing a change ships nothing.** Its note lands in `.changeset/` and waits there. Notes accumulate on
`main` until somebody decides to release.

**This repository does not use pull requests.** Work goes straight to `main`, so there is no branch, no
review step and no merge — which means the note you write is the only description of the change that ever
reaches a reader, and nobody is going to ask you for it.

**When asked to cut a release**, and only then:

1. `npm run changeset:prepare-release`, on `main`. It eats every pending note, moves the version and writes
   `packages/create-ai-workflow/CHANGELOG.md`. **It cannot be run twice** — the notes are gone afterwards.
2. Read the diff. The version bump and the changelog text are the whole of it, and the changelog text is
   what the release page will say.
3. Commit and push. **That publishes** — `publish.yml` sees the version move and tests, builds, publishes
   to npm over OIDC, pushes the `vX.Y.Z` tag and writes the GitHub Release with the changelog entry as its
   body.

Cutting a release in the same commit as the change it ships is fine and is the old habit here; the notes
change what the changelog says, not how many commits you make.

**Never hand-edit `version` in a package manifest.** `changeset:prepare-release` owns it, and a hand-typed
bump pushed to `main` publishes to npm with no second confirmation — there is no release form and no draft
state left in this pipeline.

**A prerelease is a version with a hyphen** — `0.14.0-rc.1` goes out under the `next` dist-tag and the
GitHub Release is marked as a prerelease. Nothing else selects that.

`publish.yml`'s **filename** and its `environment: release` are pinned inside npm's trusted publisher
connection, which cannot be edited — only deleted and recreated. Renaming either breaks every publish with
a 401. The connection does not pin the trigger. The file's header comment has the rest.

**The one place this repository differs from what the tool installs.** Everywhere `create-ai-workflow`
lands, these answers live in `context/release.md` and the skills read it before closing out work. There is
no `context/` here — this repo builds the tool rather than running the workflow — so the answers are in
this file instead. Keep them in one place: if a rule here needs changing, change it here, and do not
restate it in `.changeset/README.md` or in a workflow comment.

## Before you finish

- `npm run check`, `npm run build`, `npm test` — all three, from the root.
- **`test/templates.test.ts` guards content, not code.** It asserts things the prose must keep saying, so a
  failure there usually means an invariant was dropped, not that the test is stale. Read what it was
  protecting before changing it.
- **After any change under `templates/`**, pack the tarball and install it into an empty repo, then run
  `check` and `update --dry-run` against it. PLAN.md item 3 says why.
- `dist/` is build output and is not committed. Never edit it by hand.

## Writing things down

- **`PLAN.md` is the live list** — what is outstanding, and the state of the current version.
- **`DESIGN-RECORD.md` is why**, including rejected alternatives. Read the relevant `§` before reopening a
  settled question, and add to it when a decision is made rather than explaining it in a commit alone.
- Claims in either file are load-bearing. If you verify something against a real tool, say that it was
  verified and against what version; if you read it in documentation, say that instead. The two have
  already disagreed once, and the documentation lost.

## Git

- **Never commit or push unless the current instruction says to.**
- No `Co-Authored-By` and no "Generated with" lines in commits or pull request descriptions.
