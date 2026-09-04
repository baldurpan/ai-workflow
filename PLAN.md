# `@baldurpan/create-ai-workflow` — what is left

**The tool is built and tested. This file is the live list.** Everything below is work that has not
happened yet, plus the handful of calls that are cheap to reverse now and annoying later.

Why the tool is shaped the way it is lives in [`DESIGN-RECORD.md`](DESIGN-RECORD.md) — 837 lines of
tests, rejected alternatives and reasoning, **superseded by the code and read on demand, not on arrival.**
Every `§`-number below points into that document.

## Start here

1. Read this file. It is the whole of what is outstanding.
2. `npm test` — 72 tests. Six of them guard *content* invariants rather than code, and they are the
   fastest way to see what the design refuses to let rot: runtime neutrality, one home for commands, one
   home for dispatch, no self-declared status, inert stubs, and every relative link resolving after
   install — in both skill trees. `ci.yml` runs them on every push and pull request against `main`, plus
   an `engines-floor` job that builds on Node 20.10.0 and runs the packed CLI there — the suite itself
   cannot, since it executes `.ts` directly and that needs type stripping.
3. `README.md` is the user-facing description of what the tool does.
4. Open `DESIGN-RECORD.md` only when a *why* is actually in question.

**State:** v0.3.0, published. An npm workspaces monorepo — the installer lives in
`packages/create-ai-workflow/`, and `apps/*` is reserved for a landing site or hosted documentation.
Installs a `context/` tree, the seven skills into **both** `.claude/skills/` and `.agents/skills/`, two
Claude subagents, a merged `AGENTS.md` block and a manifest that draws the ownership boundary — 99
tool-owned files, 6 project-owned stubs.

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

**This is now two runs, not one.** `.agents/skills/` ships as of v0.2.0 and has never been exercised by
the host that reads it. §1.2 proved that tree is *discovered*; nothing has yet proved a skill in it fires
on the right prompt and stays quiet on the wrong one. That host has no `disable-model-invocation`
equivalent, so the second and third questions above are open there in a way they are not under Claude
Code — the description text is the only thing holding the line.

### 2. Licensing for the vendored standards — a confirmed gap, not a hypothetical

`baldurpan/ai-engineering-standards` has **no LICENSE file** — `git ls-files | grep -i licen` returns
nothing. So the terms under which 78 vendored files may be redistributed into arbitrary repositories are
unsettled. They ship on the author's own authority and nothing more.

`README.md` says this plainly and points at `standards add <git-url>` for anyone who needs known terms.
**The cheap fix is upstream:** add a LICENSE to that repo and this closes. Until then it is the one thing
in the package that could not be defended to a third party.

### 3. Publish — done, and the pipeline is proven

v0.2.0 was published by hand, because a trusted publisher cannot be configured for a package that does
not exist yet. v0.3.0 then went out through CI end to end: a version change on `main` tags `vX.Y.Z`, and
publishing that tag as a GitHub release runs `publish.yml`, which authenticates over OIDC and attaches a
provenance attestation. **There is no npm token in this repository.**

The prerelease branch of that workflow — a GitHub pre-release publishing under the `next` dist-tag — has
never run. It is the one path in the release pipeline still unexercised.

**Item 1 below was supposed to happen before this.** It did not. The live-agent run is now the
outstanding risk against a package other people can already install.

`npm pack` produces a working 141.9 kB / 116-file tarball — verified by installing it into a clean repo
and running `install`, `check` and `update --dry-run` against it, with the standards tree landing 78
files and `standards/templates/.gitignore` restored from `_dot_gitignore`. Do that again after any change
to `templates/`.

### 4. Try an offloaded executor for real

`/onboard` Step 1 now tests the §1.1 assumption per machine — cite a path, ask for a fact only readable
from that file, record whether it came back — and Step 2 refuses to name a reviewer, asking instead. Both
are **written but unexercised**: no external coder or reviewer has been configured through them end to
end. The path from a `FAIL` verdict through a written finding to the loopback has only ever run in-host.

`agy` in particular remains untested against §1.1. That is no longer a claim the package makes on its
behalf — Step 1 tests it rather than assuming it — but it does mean the branch where an executor needs
content inline has never been taken.

---

## Decisions that are cheap to reverse now

Four places the design left the call open and the build had to make one.

| Decision | Why | To reverse |
|---|---|---|
| `update` reconciles adapters to **what the running version ships**, not to what the manifest recorded — so a v0.1 install silently gains `.agents/skills/` | It is the only way an existing install ever reaches a new tree, and the alternative is a flag nobody knows to pass. The seven files are reported as `add`, visible under `--dry-run`, and a directory the tool did not write is still a conflict rather than an adoption | `const adapters = DEFAULT_ADAPTERS` → `manifest.adapters` in `src/commands/update.ts`, plus a way to opt in |
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
- **The host question dissolved instead of shipping.** §3.9 step 1 was "which host?", deferred from v1.
  Once both trees install unconditionally there is nothing to ask and nothing to branch on — a deferred
  question that turned out to have no answer worth collecting. Worth checking for on any other deferral:
  the cheap resolution is sometimes deletion.
- **A ban is only real if a test enforces it.** "Do not hardcode the reviewer invocation" is the kind of
  rule that survives exactly as long as the person who wrote it. It is now a test: no template may name a
  coding-agent CLI, with `CLAUDE.md` and `.claude/` exempted as paths this tool writes rather than
  commands it runs. It passed on the first run, which means v1 had already been living by it.
- **Two links were correct at their destination rather than their source** — `plan-template.md`'s
  `../roadmap.md` (correct once copied into `plans/`) and `/feature-close`'s archived-header example
  (correct once written into `archive/`). The link test knows about the first; the second is now a fenced
  block, which reads better as "write this" anyway.
