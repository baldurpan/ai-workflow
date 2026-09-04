# `@baldurpan/create-ai-workflow` — what is left

**The tool is built and tested. This file is the live list.** Everything below is work that has not
happened yet, plus the handful of calls that are cheap to reverse now and annoying later.

Why the tool is shaped the way it is lives in [`DESIGN-RECORD.md`](DESIGN-RECORD.md) — 786 lines of
tests, rejected alternatives and reasoning, **superseded by the code and read on demand, not on arrival.**
Every `§`-number below points into that document.

## Start here

1. Read this file. It is the whole of what is outstanding.
2. `npm test` — 66 tests. Four of them guard *content* invariants rather than code, and they are the
   fastest way to see what the design refuses to let rot: runtime neutrality, one home for commands, no
   self-declared status, and every relative link resolving after install.
3. `README.md` is the user-facing description of what the tool does.
4. Open `DESIGN-RECORD.md` only when a *why* is actually in question.

**State:** v0.1.0, unpublished. 127 tracked files. Installs a `context/` tree, seven skills into
`.claude/skills/`, two subagents, a merged `AGENTS.md` block and a manifest that draws the ownership
boundary.

---

## What is left

### 1. Run the loop under a live agent — do this before publishing

The dogfood was executed **by hand**: install into a scratch repo with a real `package.json`,
`/onboard`'s run-each-candidate pass, then `/roadmap` → `/feature-plan` → `/feature-implement` (both
phases, both gates) → `/feature-close`, with `check` clean at every step and correctly reporting four
planted breakages afterwards.

That proves the documents are **executable and mutually consistent**. It does not prove the part that
matters most in practice:

- **Do the descriptions fire correctly?** `/roadmap` must match "/roadmap" and must *not* match "plan out
  a feature for me". This is §3.1's whole premise and it is untestable from outside a real session.
- **Does `disable-model-invocation: true` actually suppress auto-matching?** It is asserted, not verified.
- **Does a real session pick the right phase unprompted**, and stop when the ledger disagrees with the
  repo?

Install into a scratch repo and try to trip each of the seven skills, both ways: invoke it explicitly,
then describe the same work in prose and confirm it stays quiet.

### 2. Licensing for the vendored standards — a confirmed gap, not a hypothetical

`baldurpan/ai-engineering-standards` has **no LICENSE file** — `git ls-files | grep -i licen` returns
nothing. So the terms under which 78 vendored files may be redistributed into arbitrary repositories are
unsettled. They ship on the author's own authority and nothing more.

`README.md` says this plainly and points at `standards add <git-url>` for anyone who needs known terms.
**The cheap fix is upstream:** add a LICENSE to that repo and this closes. Until then it is the one thing
in the package that could not be defended to a third party.

### 3. Publish

`npm whoami` returns E401 on this machine; `npm login` is required first. Nothing is published.

`npm pack` produces a working 139 kB / 115-file tarball — verified by installing it into a clean repo and
running `install`, `check` and `update --dry-run` against it. Do that again after any change to
`templates/`.

### 4. v2 — the second adapter tree and Codex support

Deferred deliberately (§0), and the design already accommodates it. What v2 adds:

- **`.agents/skills/`** — the same seven bodies, written without the `disable-model-invocation` line.
  They are runtime-neutral today and a test enforces it, so this is a directory to write, not a rewrite.
  The one-line difference is already isolated in `claudeSkillTransform` (`src/layout.ts`).
- **Coder and reviewer offload** — `/onboard` steps 1 and 2, currently marked deferred in the skill, and
  the dispatch lines they write into `context/executors.md`.
- **Reviewer dispatch under Codex.** Codex ships both `codex review` and a
  `review-agent` system skill; either may serve Gate 2. **Do not hardcode the winner** — `/onboard`
  writes the chosen invocation into `executors.md`. What ships is the contract, not the command.
- **`agy` is untested** against §1.1. The evidence that an executor reads project files unaided covers
  Codex only. Anything assuming it should degrade safely when it is false.

---

## Decisions that are cheap to reverse now

Three places the design left the call open and the build had to make one.

| Decision | Why | To reverse |
|---|---|---|
| A closed finding in `findings.md` is a **`note`**, not an error — printed, but it does not fail the exit code | §6.4 says `check` "reports" it, and a finding legitimately sits in *Closed* until `/feature-close` sweeps it. An error would turn `check` red during ordinary work — the crying-wolf failure §6.4 warns against | one `level: 'note'` → `'error'` in `src/check/rules.ts` |
| An edited `context/standards/` file hands over **the whole tree**, not that file | §6.2 says a hash mismatch is a conflict; §4.1 says standards are ours only "while unmodified". The tree is an interface — the README's conditional table and the files it names have to agree, so a half-managed tree is one where an update replaces a file the user's own table no longer points at | the tree-level branch in `src/commands/update.ts` |
| Subagents use **`model: inherit`** | The package installs into other people's accounts and assumes nothing about model access. The reference pinned `opus` and `sonnet` | one line in each `templates/claude/agents/*.agent.md`. Note that pinning after install makes it a conflict on the next `update` — which is the correct signal |

---

## Findings from the build — worth not re-learning

- **npm silently refuses to publish a file named `.gitignore`.** The vendored standards carry one, so the
  package would have shipped 77 of upstream's 78 files while `standards/.source` claimed a ref the
  installed tree did not match. It now ships as `templates/_dot_gitignore` and the dot is restored at
  write time. **Anything vendored in future needs the same check** — `npm pack --dry-run` against the
  source tree, not a file count.
- **Importing the CLI module executed it.** A test that imported `parseArgs` ran the installer into this
  repo. The entry point is split: `src/cli.ts` exports, `src/bin.ts` runs. Keep that split.
- **The stubs' commented-out examples parsed as real content.** `check` strips HTML comments so it was
  never fooled, but an agent or a one-off script would be. Examples now sit in blockquotes above the
  `---`, outside the sections anything scans, and three tests assert the stubs parse to zero entries,
  zero findings, zero history rows.
- **Two links were correct at their destination rather than their source** — `plan-template.md`'s
  `../roadmap.md` (correct once copied into `plans/`) and `/feature-close`'s archived-header example
  (correct once written into `archive/`). The link test knows about the first; the second is now a fenced
  block, which reads better as "write this" anyway.
