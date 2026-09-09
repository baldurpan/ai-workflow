# `@baldurpan/create-ai-workflow`

**Overlays a planning workflow onto an existing repository.** It is not a scaffolder — despite the
`create-` name, it expects a repo you already have, and it refuses to run where `context/` exists.

```bash
npx @baldurpan/create-ai-workflow      # or: npm create @baldurpan/ai-workflow
```

You get a backlog, plan documents with phase ledgers, two verification gates, and nine commands that
move work between them. Your coding agent runs the commands; you read and hand-edit the files.

---

## The three tiers

```
/roadmap "idea"  ──▶  pending                  Tier 1 — the backlog
                        │                      context/roadmap.md, notes in context/drafts/
                  /feature-plan [--activate]    writes context/plans/<NAME>-PLAN.md, then STOPS
                        ▼
                  a plan exists                Tier 2 — one plan, with a phase status ledger
                        │
                  /feature-implement           activates, then runs phases: code → verify → review
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
| `/feature-implement` | activates a planned feature and runs **one phase**, through both gates |
| `/feature-status` | read-only. Reconciles the ledger against the repo — sweeping every worktree where the project works that way — then names **exactly one** next action |
| `/feature-close` | retires a feature: a `history.md` row, a `git mv` into `archive/`, and a reviewed reference sweep |
| `/orchestrate` | one ad-hoc, commit-sized change through the same gates — no entry, no ledger |
| `/prototype` | a throwaway HTML/CSS mockup under `prototypes/`, to settle a layout question before a plan commits to it — no gates, no application code |
| `/onboard` | fills in your own stubs, adopting what the repo already documented, indexing where it documents itself, and running each verification command before writing it down |
| `/tracking-migrate` | moves an existing backlog, its drafts and its plans onto the substrate `tracking.md` names — one feature at a time, resumable, removing a file only once the issue that replaces it exists |

## What makes it different

**No document states its own status.** There is no `**Status:**` header anywhere. Whether a feature is
being worked is a marker in `roadmap.md`; whether it *has* a plan is whether its `Doc` field points into
`plans/`; where a phase stands is the plan's own ledger. Those facts are orthogonal, so none of them can go
stale against another.

**Nothing is cached, parsed, or generated.** An agent reads the hand-written ledger every time, so editing
a row by hand changes the answer immediately. There is no build step in the loop and no generated
"current state" file to disagree with its source.

**One file names a command.** `context/verify.md` holds this project's real lint, typecheck, build and
test commands. No skill, agent prompt or role file carries a copy — a hardcoded stack rots the moment the
project changes shape, and a second copy rots faster. `/onboard` **runs each candidate and writes only the
ones that exit 0.**

**Nothing commits, branches or pushes unless you said it could.** `context/git.md` holds four independent
answers — who commits, **where work lands** (the main working tree, a branch per feature, or a worktree per
feature), **whether the agent pushes and opens a pull request**, and at what granularity — and every command
that lands code reads it before closing out. Each ships as the most conservative option: *the user commits*,
in *the main working tree*, pushing *nothing*. A tool installed into a repository it knows nothing about
does not get to write that repository's history unasked.

They are four answers rather than three named modes because they are orthogonal — a worktree per feature
does not imply a pull request, and a pull request does not imply a worktree — and two facts that cannot
disagree is the same reason no document here states its own status. `/onboard` still *asks* them as three
named shapes, because that is how people think about it.

**Under the worktree answer, nothing tracks what is in flight.** `git worktree list` is the answer, and
`/feature-status` sweeps it: *"in flight" is not a status, it is the observation that a worktree exists* —
the same move as *"planned" is the observation that a document exists in `plans/`*. A file recording it
would be a cache of something git already knows, and it would be wrong in the one case you reach for it.
Merging stays outside the workflow entirely: nothing here merges a pull request, deletes a branch, or
removes a worktree.

**Documentation is part of the change.** A plan starts by finding where the project explains itself —
`context/stack.md` holds that index, `/onboard` fills it by sweeping the tree and asking what is published
elsewhere — and every plan carries a §7 naming what the feature makes untrue there. Each row is assigned to
a phase, and its path goes on that phase's `Files:` line, so the README lands with the rename rather than
after it. Docs are the one output with no gate behind them: nothing fails when a page keeps describing a
flag that no longer exists.

**A finding outlives the session that found it.** A reviewer `FAIL` or a capped gate is written to
`context/findings.md` *before* the loopback, so it survives the conversation ending. An open `P0`/`P1`
blocks its phase from being marked `done` and blocks `/feature-close`.

**Where the backlog and the ledgers live is an answer too.** `context/tracking.md` holds it, and it ships
saying *in the working tree* — `roadmap.md` for the backlog, a document under `plans/` per feature, a
`history.md` row when one retires. The second answer puts the same three tiers in **GitHub issues**: a
feature is an issue, a phase is a sub-issue, and a closed issue *is* the archive, with its plan, its whole
discussion and its pull request at an id nothing had to rewrite.

That answer exists for one reason — **several agents working several features at once.** A worktree carries
only what its ref holds, so a plan on one branch is invisible to every other tree, and there is no shared
place to claim a feature. A tracker sits outside every tree. Under it `roadmap.md`, `history.md`,
`archive/`, `drafts/` and `plans/` stop existing, and so does the `merge=union` workaround they needed.

**No skill names GitHub.** The commands ask for the *fact* they need — is this feature being worked, where
does this phase stand — and `tracking.md` alone says how this project answers it. That is what keeps a
different tracker a rewrite of one file rather than of every command.

**Changing where tracking lives is two commands, not one.** `/onboard` sets the answer; `/tracking-migrate`
carries what already exists onto it. A repository whose answer says *tracker* while its entries are still
in `roadmap.md` reads as an empty backlog to every command — so `/onboard` refuses to write that state, and
names the migration instead. The migration finishes one feature before starting the next and removes a
file only after the issue replacing it exists, which makes a run that fails partway a resumable state
rather than a repository in neither substrate. `history.md` and `archive/` are never converted in either
direction: fabricated closed issues for work shipped months ago are an audit trail that looks real and is
not.

## What gets installed

```
context/
  README.md  workflow.md  plan-template.md  plan-template.notes.md  roles/  standards/     tool-owned
  stack.md  verify.md  executors.md  git.md  tracking.md                                   yours
  roadmap.md  history.md  findings.md                                                      yours
  drafts/  plans/  archive/                                                                yours
  .state/manifest.json
.claude/skills/<nine>/SKILL.md    .claude/agents/*.agent.md                                tool-owned
.agents/skills/<nine>/SKILL.md    the same nine bodies, for hosts that read that tree       tool-owned
AGENTS.md   a delimited block, merged into whatever is already there
CLAUDE.md   a single @AGENTS.md line, and only when the file does not exist
```

Nothing is committed. Review the diff yourself.

**Onto a repository that already documents itself**, the installer only appends — your existing
`AGENTS.md` prose is left exactly where it is. `/onboard` reconciles the two afterwards: it classifies
each existing claim into `stack.md`, `verify.md`, `git.md`, `tracking.md` or `executors.md`, asks wherever a
destination is
unclear or the old text contradicts the installed workflow, and prunes the source only once the
replacement is written and shown.

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
conditional-loading table that agents actually traverse — the skills say "consult the conditional loading
table", and that is how standards get loaded per task.

**A wrong set is not inert**, because it is loaded unprompted on every task. Swap it:

```bash
npx @baldurpan/create-ai-workflow standards add <git-url>
```

That command **refuses to install a tree the skills cannot navigate**: the source's README must carry a
usable conditional-loading table, or you are offered a generated one (`--generate-index`). Whatever lands
is project-owned from that point — it drops out of the manifest, so `update` never clobbers it. Editing
the bundled tree in place has the same effect.

## `check`

```bash
npx @baldurpan/create-ai-workflow check
```

Reports structural breakage: an illegal status word, a `Depends on` naming a phase that does not exist or
a cycle, two entries marked `active`, a second phase table, a `**Status:**` header, a plan no entry points
at, a dead `Doc` or history link, a closed finding still in the file, and a backlog left in `roadmap.md`
after `tracking.md` was switched to the tracker — entries that are still well-formed and no longer read by
anything.

It **never writes** — there is no `--fix`, because the moment it can repair a ledger, a program's edit
competes with a hand edit. Nothing depends on it: no skill calls it and no git hook installs it. **Delete
it and every workflow answer is unchanged.** It reads `roadmap.md`, `plans/`, `history.md` and
`findings.md` — never `archive/`, because validating retired records against current rules is how
validators earn a reputation for crying wolf. Every message quotes the rule it enforces, so a false
positive points at the document that is out of step.

## Scope

**Both skill trees ship.** Claude Code reads `.claude/skills/`; Codex reads `.agents/skills/` and never
looks at the other one. They get the same nine bodies — the only difference is one frontmatter line,
`disable-model-invocation: true`, which is Claude Code's key and means nothing elsewhere. The bodies are
written runtime-neutral, with no runtime primitive named in any of them, and a test enforces it.

Duplication is the cost, and it is contained by construction rather than by discipline: one canonical
source lives in the package, both trees are written at install, both are hashed in the manifest, and
neither is ever hand-edited. Editing one is a conflict, not a divergence.

`AGENTS.md` is the content home, so Cursor, Copilot and Gemini CLI get the command block for free without
a tree of their own. An install made before the second tree existed gains it on the next `update`, listed
as `add` in the plan.

**No host's review command is named anywhere in the package.** Which coder or reviewer serves Gate 2 is a
per-machine fact that hosts change underneath you, so `/onboard` asks and writes the chosen invocation into
`context/executors.md`. What ships is the contract — a review happens, blocking findings carry a `P0`–`P3`
severity, a `FAIL` writes a finding before the loopback — not the command.

Each executor has **three answers**: in-host, in-host but isolated in a subagent, or offloaded to an
external CLI. The middle one is written as *"a subagent if your runtime provides one"* — described by what
it does, never by naming a runtime primitive — so a host without the mechanism reads it and falls back to
the first. For the coder it buys a caller that keeps the ledger and the gates while the implementation's
file reads stay elsewhere; for the reviewer it buys the cheapest real independence there is, a reader that
never saw the code being written. The gates do not move either way: they run in the caller, on the diff,
because **an executor that reports its own success has reported nothing.**

Requires Node 20.10 or newer. One `context/` per repository.

## Licence

The tool is MIT.

`context/standards/` is vendored from
[`baldurpan/ai-engineering-standards`](https://github.com/baldurpan/ai-engineering-standards) at the ref
recorded in `context/standards/.source`. **That repository carries no licence file**, so the terms under
which the vendored content may be redistributed are unsettled — it is bundled here on the author's own
authority and nothing more. If you are installing this into a repository where that matters, run
`standards add <git-url>` and point it at a tree whose terms you know.
