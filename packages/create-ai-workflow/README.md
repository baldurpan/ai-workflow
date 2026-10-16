# `@baldurpan/create-ai-workflow`

**Overlays a planning workflow onto an existing repository.** It is not a scaffolder — despite the
`create-` name, it expects a repo you already have, and it refuses to run where `context/` exists.

You get a backlog, plan documents with phase ledgers, two verification gates, and ten commands that move
work between them. Your coding agent runs the commands; you read and hand-edit the files.

## Quickstart

```bash
npx @baldurpan/create-ai-workflow      # or: npm create @baldurpan/ai-workflow
```

Nothing is committed — read the diff. Then, in your coding agent:

| | |
|---|---|
| `/onboard` | **first, and once.** Writes your own answers: the real lint, typecheck, build and test commands, who commits and where work lands, where the backlog lives, what a change announces |
| `/roadmap "an idea"` | puts it on the backlog |
| `/feature-plan` | turns one backlog entry into a plan with a phase ledger — then **stops** |
| `/feature-implement` | runs the next phase: code, verify, review. One phase a run, or `--all` |
| `/orchestrate "fix the X"` | one commit-sized change through the same gates, with no plan |

Those four are the daily set. Five more commands — `/feature-status`, `/feature-close`, `/release`,
`/prototype`, `/tracking-migrate` — are below, and
[what makes it different](https://github.com/baldurpan/ai-workflow/blob/main/packages/create-ai-workflow/INVARIANTS.md)
is its own document.

---

## The three tiers

```
/roadmap "idea"  ──▶  pending                  Tier 1 — the backlog
                        │                      context/roadmap.md, notes in context/drafts/
                  /feature-plan [--activate]    writes context/plans/<NAME>-PLAN.md, then STOPS
                        ▼
                  a plan exists                Tier 2 — one plan, with a phase status ledger
                        │
                  /feature-implement [--all]   activates, then runs phases: code → verify → review
                        ▼
                  /feature-close               ──▶ context/archive/ + a context/history.md row
```

Every boundary is crossed by an explicit command, never as a side-effect. Every command finds its own
starting point — nothing has to be looked up first.

## The commands

| Command | Does |
|---|---|
| `/roadmap` | prints the backlog, or appends one `pending` entry — capturing any material you supply as a draft |
| `/feature-plan` | turns an entry into a plan document and **stops**. Planning is not activation |
| `/feature-implement` | activates a planned feature and runs **one phase** through both gates — or phase after phase with `--all`, which stops at a `blocked` phase, a capped gate or a ledger that disagrees with the repo, and never at `/feature-close` |
| `/feature-status` | read-only. Reconciles the ledger against the repo — sweeping every worktree where the project works that way — then names **exactly one** next action |
| `/feature-close` | retires a feature: a `history.md` row, a `git mv` into `archive/`, a reviewed reference sweep, and the release note where `release.md` says one is owed |
| `/orchestrate` | one ad-hoc, commit-sized change through the same gates — no entry, no ledger. With `--pr` the run ends at a pull request instead of in the working tree: the flag is the permission, it never creates a worktree, it stops rather than branching off the default branch itself, and nothing merges it |
| `/release` | consumes every note waiting on the default branch: makes the release branch `executors.md` names, runs what `release.md`'s *Bump* wire names — exactly once, and after Gate 1, because it cannot be run twice — and ends at a pull request for a person to approve. The one command that moves a version, and only when typed |
| `/prototype` | a throwaway HTML/CSS mockup under `prototypes/`, to settle a layout question before a plan commits to it — no gates, no application code |
| `/onboard` | fills in your own stubs, adopting what the repo already documented, indexing where it documents itself, running each verification command before writing it down, and asking per path what a change announces |
| `/tracking-migrate` | moves an existing backlog, its drafts and its plans onto the substrate `tracking.md` names — one feature at a time, resumable, removing a file only once the issue that replaces it exists |

## What makes it different

Sixteen properties, each of them a test:
[`INVARIANTS.md`](https://github.com/baldurpan/ai-workflow/blob/main/packages/create-ai-workflow/INVARIANTS.md).
No document states its own status; nothing is cached, parsed or generated; one file names a command;
nothing commits unless you said it could; a defect the gate found has one home; no skill names GitHub, a
release tool, or a host's reviewer.

## What gets installed

```
context/
  README.md  workflow.md  workflow.notes.md  plan-template.md  plan-template.notes.md      tool-owned
  <stub>.notes.md — one beside each of the six stubs below      roles/  standards/         tool-owned
  stack.md  verify.md  executors.md  git.md  tracking.md  release.md                       yours
  roadmap.md  history.md                                                                   yours
  drafts/  plans/  archive/                                                                yours
  .state/manifest.json
.claude/skills/<ten>/SKILL.md     tracker.md beside five    .claude/agents/*.agent.md      tool-owned
.agents/skills/<ten>/              the same bodies, for hosts that read that tree           tool-owned
AGENTS.md   a delimited block, merged into whatever is already there
CLAUDE.md   a single @AGENTS.md line, and only when the file does not exist
```

Nothing is committed. Review the diff yourself.

**What a command reads is split by when it is needed.** The issue-tracker half of five skills sits in a
`tracker.md` beside the body, read only where `tracking.md` names the tracker. The reasoning behind
`workflow.md` is in `workflow.notes.md`, which no command cites. Each stub's guidance — what its sections
take, and the alternative answers written out — is in a notes file beside it that `/onboard` reads once. A
repository on the working-tree answer never loads the tracker half, and nothing in the loop loads a notes
file.

**Onto a repository that already documents itself**, the installer only appends — your existing
`AGENTS.md` prose is left exactly where it is. `/onboard` reconciles the two afterwards: it classifies
each existing claim into `stack.md`, `verify.md`, `git.md`, `tracking.md`, `release.md` or
`executors.md`, asks wherever a destination is unclear or the old text contradicts the installed workflow,
and prunes the source only once the replacement is written and shown.

### The ownership boundary is a data structure, not a rule

`context/.state/manifest.json` lists every tool-owned file with its hash. `update` walks that manifest —
and a project-owned file is not in it, so **no code path reaches it.** Anything else you add under
`context/` (`decisions.md`, `glossary.md`, `ops-notes.md`) survives by the same property, with no feature
required to protect it.

```bash
npx @baldurpan/create-ai-workflow update --dry-run   # print the plan, change nothing
npx @baldurpan/create-ai-workflow update             # conflicts stop it; nothing is written
npx @baldurpan/create-ai-workflow update --force     # back up edited files (.bak) and take ours
```

| On disk | `update` does |
|---|---|
| matches the manifest | replaces silently |
| differs | reports a conflict; `--force` backs up and replaces |
| missing | restores |
| not in the manifest | nothing — it cannot reach it |

**Run `/onboard` after an update.** That last row is the whole reason: a new version's tool-owned files can
expect something of a project-owned one — a section of `context/stack.md` that every plan now reads, a
`context/git.md` older than the file itself — and the updater is forbidden to write either. So it ends by
naming each gap and stops:

```
Next
  ! context/stack.md has no "Documentation" section — this version's stub has one
  ! context/git.md is missing — a stub is project-owned, so update cannot write one
  Run /onboard in your agent. It is re-runnable, and it is the only thing that
  reaches these files — the commands above now read them.
```

It is a note, not a failure — the exit code is the conflict count's to set. A tool that failed an update
over the shape of a file it may not touch would be calling someone else's business its own breakage.

## Standards

`context/standards/` ships a vendored default, and `context/standards/README.md` holds a
conditional-loading table that agents actually traverse. The planner traverses it once, with the research
in hand, and writes each phase's share of it onto that phase's `Standards:` line; the coder and the reviewer
load those files and not the table. `/orchestrate` has no plan, so it reads the table itself.

**A wrong set is not inert**, because it is loaded unprompted on every task. Swap it:

```bash
npx @baldurpan/create-ai-workflow standards add <git-url>
```

That command **refuses to install a tree the skills cannot navigate**: the source's README must carry a
usable conditional-loading table, or you are offered a generated one (`--generate-index`). Whatever lands
is project-owned from that point — it drops out of the manifest, so `update` never clobbers it. Editing
the bundled tree in place has the same effect.

## `release-init`

`context/release.md` is the one stub whose answer can be **false**: *a change is announced by writing a
note* is a lie in a repository where nothing records one, so `/onboard` Step 9 refuses to write it and names
the gap instead. This is the command that closes the gap.

```bash
npx @baldurpan/create-ai-workflow release-init [--private-packages version|ignore] [--dry-run]
```

It sets up a note-per-change mechanism — `.changeset/`, the devDependency, and three scripts named
`changeset:add`, `changeset:prepare-release` and `changeset:status` — then tells you to run `/onboard`,
which records what it found. **`prepare-release` prepares one; nothing here publishes one.** **It does not write `context/release.md`.** One writer per file: the installer installs, `/onboard`
answers, the same way `standards add` does not write `stack.md`.

**`/release` is what runs the middle script, and only when you type that command.** Nothing in the workflow
reaches for it otherwise: the skill reads the *Bump* wire `/onboard` wrote into `context/release.md`, so the
command works the same against a hand-maintained changelog or another vendor's tool, and refuses where that
wire is empty. It cuts the branch `context/executors.md` names, runs the script once — after Gate 1, because
the script cannot be run twice — and stops at a pull request for you to approve.

**What it sets up is a gate, and the gate is not only for publishing.** The event it makes available is the
merge of the pull request where `changeset:prepare-release` ran — the one `/release` opens — and that one
merge is what ships a published package and a deployed app alike — each on the condition that its own version moved in it. That is
why the question below is the one thing this command will not guess, and why `.changeset/README.md` says a
feature's merge ships nothing.

**The same answer decides what that merge leaves behind.** Versioning a deployed app and tagging it are one
decision: the tag is the record of which commit went live, and a release page is built from it. Answer
`version` and both are on. A repository that only deploys still runs the publish command to get them — it
publishes nothing where every package is private and cuts tags only, which is the one thing about this
mechanism that nobody deduces, so the command says it on its way out.

**It is the only command here that names a vendor, and the only one that touches `package.json`.** That is
deliberate and it is a boundary, not an exception. The rule that no template may name a release tool is a
rule about `templates/` — that prose is inherited by every install, including the Go and Python ones, so a
skill named after a JavaScript tool would be nonsense in half of them. A subcommand is a program you choose
to run, and it refuses where it does not apply. Two tests hold the line from both sides.

**The answer it will not guess** is whether a private package here is deployed. The tool's default is not to
version private packages, so a deployable app recorded as private accumulates notes, never bumps, and
anything that deploys on a version change silently does nothing forever — or gets wired to every merge
instead, which is worse. It asks on a terminal and **refuses** without one, naming the flag — the one number
in the setup that is expensive to get wrong.

**It writes files and runs nothing**: no `npm install`, no `git` anything, no CI workflow — neither the
publish nor the deploy, which are one gap rather than two. Accumulating notes and versioning them is uniform;
the last step plus its credentials depends on branch protections, registry auth and who is allowed to press
the button, and a generated workflow there does damage. The scripts are what yours would call, and the event
either job keys on is the merge described above.

## `check`

```bash
npx @baldurpan/create-ai-workflow check
```

Reports structural breakage: an illegal status word, a `Depends on` naming a phase that does not exist or
a cycle, two entries marked `active`, a second phase table, a `**Status:**` header, a plan no entry points
at, a dead `Doc` or history link, and a backlog left in `roadmap.md` after `tracking.md` was switched to
the tracker — entries that are still well-formed and no longer read by anything.

It reports one thing that is **not** breakage, as a `note` rather than an error: a plan over the size
budget in `tracking.md`. The document is well-formed and every answer it gives is right — what it says is
that the feature is more than one feature. A note fails nothing, and the split is `/feature-plan`'s to
propose.

It **never writes** — there is no `--fix`, because the moment it can repair a ledger, a program's edit
competes with a hand edit. Nothing depends on it: no skill calls it and no git hook installs it. **Delete
it and every workflow answer is unchanged.** It reads `roadmap.md`, `plans/` and `history.md` — never
`archive/`, because validating retired records against current rules is how validators earn a reputation
for crying wolf. Every message quotes the rule it enforces, so a false
positive points at the document that is out of step.

## Scope

**Both skill trees ship.** Claude Code reads `.claude/skills/`; Codex reads `.agents/skills/` and never
looks at the other one. They get the same ten bodies — the only difference is the Claude Code copy's frontmatter:
`disable-model-invocation: true`, and a `model` and `effort` per command, keys that mean nothing elsewhere.
The bodies are written runtime-neutral, with no runtime primitive named in any of them, and a test enforces
it.

**Every command's own orchestration runs on `sonnet`**, except `/onboard`, which runs once on `opus`; the
planner and reviewer subagents are pinned to `opus`. Picking a ledger row, writing a brief, running the
gates and writing the row back is bookkeeping, and the planner and the reviewer are where the judgment
lives. A skill's model holds for the turn it was invoked in and your session model resumes on your next
prompt, so a command that stops to ask — the approval checkpoint, the bump confirmation — continues on the
session model. Run the session on `sonnet` if you want the tier to hold across the ask.

Duplication is the cost, and it is contained by construction rather than by discipline: one canonical
source lives in the package, both trees are written at install, both are hashed in the manifest, and
neither is ever hand-edited. Editing one is a conflict, not a divergence.

`AGENTS.md` is the content home, so Cursor, Copilot and Gemini CLI get the command block for free without
a tree of their own. An install made before the second tree existed gains it on the next `update`, listed
as `add` in the plan.

**No host's review command is named anywhere in the package.** Which coder or reviewer serves Gate 2 is a
per-machine fact that hosts change underneath you, so `/onboard` asks and writes the chosen invocation into
`context/executors.md`. What ships is the contract — a review happens, every item in it is blocking or it
is not, and a `FAIL` is looped back on — not the command.

Each executor has **three answers**: in-host, in-host but isolated in a subagent, or offloaded to an
external executor, a CLI or a tool. **The subagent answer is what ships** — the coder on `sonnet`, with the
tier written in `executors.md` as an alias the runtime resolves — and it is written as *"a subagent if your
runtime provides one"*, described by what it does and never by naming a runtime primitive, so a host without
the mechanism reads it and falls back to in-host and to reviewing its own diff. For the coder it buys a
caller that keeps the ledger and the gates while the implementation's file reads stay elsewhere; for the
reviewer it buys the cheapest real independence there is, a reader that never saw the code being written.
The gates do not move either way: they run in the caller, on the diff, because **an executor that reports
its own success has reported nothing.** An executor you wired yourself — a CLI, a tool — is a line in
`executors.md`, which `update` cannot reach and a re-run of `/onboard` reports and leaves alone.

Requires Node 20.10 or newer. One `context/` per repository.

## Licence

The tool is MIT.

`context/standards/` is vendored from
[`baldurpan/ai-engineering-standards`](https://github.com/baldurpan/ai-engineering-standards) at the ref
recorded in `context/standards/.source`. **That repository carries no licence file**, so the terms under
which the vendored content may be redistributed are unsettled — it is bundled here on the author's own
authority and nothing more. If you are installing this into a repository where that matters, run
`standards add <git-url>` and point it at a tree whose terms you know.
