# `@baldurpan/create-ai-workflow` — implementation plan

A standalone, installable planning workflow for coding agents, extracted from the working
implementation in `/Users/baldur/Development/baldurpan/dynjandi`.

**This document is self-contained.** It carries the verified findings, the decisions and the reasoning
behind them, so implementation can start from a clean context. Discard it once the tool is built.

---
## 0. Scope — v1 is Claude Code only

Codex support is deferred. That reduces the build but **does not change the design**, and the
distinction matters because two of these are cheap now and expensive later.

**Deferred to v2, not redesigned:**

- The `.agents/skills/` tree. v1 writes `.claude/skills/` only (§5.1).
- Coder offload to Codex/`agy`. Gate 1 and Gate 2 run in-host.
- `/onboard`'s host and offload questions (§3.9 steps 1–3); the standards, verification and stack
  questions remain, and the verification step is the most valuable part of that command.
- Open item §8.1, reviewer dispatch under Codex.

**Not compromised, and the reason:**

- **§3.2 runtime neutrality is non-negotiable.** Writing the seven SKILL.md bodies Claude-shaped —
  naming `Agent`, `subagent_type` or `AskUserQuestion` inline — costs nothing today and costs a rewrite
  of all seven when the second tree arrives. Write them neutral now; emit one tree.
- **`AGENTS.md` stays the content home**, with `CLAUDE.md` as a one-line `@AGENTS.md` import. The
  reference's own commit records why: the two files "used to duplicate each other and had already
  drifted, leaving standing rules that Codex, the primary Coder, had never seen." It also means Cursor,
  Copilot and Gemini CLI get the block for free, and adding Codex later migrates no content.
- **`context/executors.md` still ships**, holding Gate 2's dispatch line. It is thin in v1, but the
  skills already point at it, so adding offload later is an edit to a project-owned file rather than a
  tool update and a pointer fix.
- Everything in §1.1 holds harder: with no subprocess to inject into, standards injection is doubly dead.
- The tier model, ownership, manifest, and `check` are host-independent throughout.

One honest note on evidence: test B (§1.1) was run against Codex, so it licenses a thin `AGENTS.md` for
*that* host directly. For Claude Code the mechanism differs — `@AGENTS.md` is expanded into context at
launch, and the skills instruct their own reads explicitly rather than relying on spontaneous traversal.
The conclusion holds, but by a different route.

---


## 1. Verified findings

These were established by running tests, not by reasoning. Several design decisions below look wrong
without them, so they come first.

### 1.1 Codex reads project files unaided — the standards-injection subsystem is dead

The reference repo's `F-002` asked whether Codex can read `context/standards/` itself.
`.claude/skills/orchestrate/SKILL.md` asserted it cannot, and built a ~142-line injection subsystem
(`references/standards-injection.md`) that pastes standards into every brief. `AGENTS.md` asserted the
opposite. Two tests settled it.

**Test A — explicit path, nothing inlined.** In the dynjandi repo:

```bash
codex exec -s read-only "Read context/standards/architecture/edge-runtimes.md ...
report the verbatim bullets under '## DO NOT', the exact line count, and the last '## See Also' bullet."
```

Codex ran `awk` + `wc -l` over the file and returned all five `DO NOT` bullets verbatim, `116` lines
(matching `wc -l`), and the exact final `See Also` line. It read the file.

**Test B — no path in the brief at all.** A task-shaped prompt only ("add a new HTTP route handler to
the CDN worker; do not write code; list which instruction files you would consult"). Unprompted, Codex
read `AGENTS.md` → `context/standards/README.md`, then followed that file's conditional-loading table
and read **11 standards files in full**, plus `verify.md`, `roadmap.md`, `workflow.md`, `stack.md`,
`findings.md`, `template.md` and `CLAUDE.md`.

**Consequences, all load-bearing below:**

- Standards injection does not ship. Briefs cite paths.
- The conditional-loading table in `standards/README.md` is a real interface that agents actually
  traverse — which is why §6.3 constrains what `standards add` may install.
- `AGENTS.md` can be a thin pointer file (§5.2). The reference inlines ~80 lines of rules on the
  premise that "a pointer is not a guarantee that they get read"; test B falsifies that premise.

**Caveat:** Codex CLI 0.152.0, one repo, one prompt. Strong but singular, and untested for `agy`.
Injection remains necessary for any executor with genuinely no filesystem access.

### 1.2 Codex discovers project-local skills

A scratch git repo was planted with three skills. `codex exec` listed its own skill catalog:

| Planted at | Discovered |
|---|---|
| `.agents/skills/pingtest/SKILL.md` | yes |
| `.codex/skills/pongtest/SKILL.md` | yes |
| `.claude/skills/zaptest/SKILL.md` | **no** |

Asked to use them, Codex opened `.agents/skills/pingtest/SKILL.md` and returned its payload; it
reported `zaptest: NOT AVAILABLE`. The binary resolves skills from `$CODEX_HOME/skills`, plugin roots,
and these project directories.

This is why "agent-agnostic" needs no CLI shim and no prose procedures — it needs a second directory.

### 1.3 Packaging facts

- `@baldurpan/create-ai-workflow` and `@baldurpan/ai-workflow` are both unregistered. Unscoped
  `ai-workflow` is taken (0.1.19).
- `npx @baldurpan/create-ai-workflow` resolves: `libnpmexec/lib/get-bin-from-manifest.js` uses the sole
  `bin` entry when there is exactly one, else strips the scope and matches a bin named
  `create-ai-workflow`.
- `npm create @baldurpan/ai-workflow` maps to the same package —
  `npm/lib/commands/init.js:113` rewrites `@user/project` → `@user/create-project`.
- `npm whoami` returns E401 on this machine; `npm login` is required before publishing.
- **npm refuses to publish a file named `.gitignore`.** It is stripped from the tarball with no warning.
  The vendored standards tree carries one (`templates/.gitignore`), so the published package would have
  shipped 77 of upstream's 78 files while `standards/.source` claimed a ref the installed tree did not
  match. It ships as `templates/_dot_gitignore` and the leading dot is restored at write time; the
  installed tree now diffs clean against upstream `git ls-files`. Anything else vendored in future needs
  the same check — `npm pack --dry-run` against the source tree, not a file count.

---

## 2. The tier model

Three tiers. Every boundary between them is crossed by an **explicit command, never as a side-effect**.

```
/roadmap "idea"  ──▶  pending                      Tier 1 — the backlog
                        │                          context/roadmap.md
                  /feature-plan [--activate]        writes context/plans/<NAME>-PLAN.md, then STOPS
                        ▼
                  a plan exists                     Tier 2 — one plan, with a phase status ledger
                        │
                  /feature-implement                activates, then runs phases: plan → code → verify → review
                        ▼
                  /feature-close                    ──▶ context/archive/ + a context/history.md row
```

### 2.1 One source of truth per fact

| To know | Read |
|---|---|
| whether a feature is being worked | the `pending` / `active` marker in its `roadmap.md` heading |
| whether a feature has a plan | whether its `Doc` field points into `plans/` |
| where a phase stands | the plan's own status ledger |
| what a retired feature's outcome was | its `history.md` row |

**No document states its own status.** There is no `**Status:**` header anywhere under `context/`.
Both archived plans in the reference repo shipped while their own headers still read "proposal" and
"Plan of record"; that is what this rule exists to prevent.

**"Planned" is not a status.** It is the observation that a document exists in `plans/`. The marker
answers *is it being worked*; the `Doc` path answers *does it have a plan*. The two facts are
orthogonal, so neither can go stale against the other.

| Marker | `Doc` points at | Means |
|---|---|---|
| `pending` | nothing, or `drafts/` | an idea |
| `pending` | `plans/` | planned, not being worked |
| `active` | `plans/` | being worked |

### 2.2 The two status vocabularies stay distinct

| Tier | Lives in | Values |
|---|---|---|
| Feature | `roadmap.md`, in the entry heading | `pending`, `active` |
| Phase | the plan's ledger, Status column | `not started`, `in progress`, `blocked`, `done` |

They are not synonyms. They previously differed by a single hyphen (`not-started` vs `not started`),
which is the worst case — neither clearly the same nor clearly different.

### 2.3 The directory says what a document is

```
drafts/  ──/feature-plan──▶  plans/  ──/feature-close──▶  archive/
notes                        a phase ledger              retired
```

One `git mv` per transition. `plans/` means "has an executable ledger" and nothing more — it does not
imply activity. Misfiling breaks a link loudly rather than lying quietly.

### 2.4 Nothing is cached, parsed, or generated in the loop

An agent reads the hand-written ledger every time, so hand-editing a row changes the answer
immediately with no regeneration step. There is no build step in the planning loop and no generated
"current state" file. The one program that touches these files, `check` (§6.4), validates shape and
answers no workflow question.

### 2.5 The invariant, stated once

> **At most one roadmap entry is `active`. Any command that sets the marker checks this first.**

This lives in `workflow.md`. `/feature-plan --activate` and `/feature-implement` **cite** it rather
than each restating it — two independently-worded copies of one rule is the drift this design exists
to prevent.

### 2.6 Feature or task?

> **If you would want a `history.md` row for it, it is a feature — use the roadmap flow.
> If you would not, it is a task — use `/orchestrate`.**

Checkable, and it keeps `/orchestrate` from becoming the way to skip planning.

### 2.7 Credentials

> **Never transcribe a credential into a tracked file.** A DSN, token or key is described and pointed
> at the secret store, never copied.

Standing rule in `workflow.md`, cited by every command that writes. The sharp cases are `/roadmap`
capturing supplied material, `/feature-plan` carrying a draft's specifics forward, and `/onboard`,
which collects shell commands — the most likely place a token appears inline — and writes them into
tracked files. `/onboard` writes `$SENTRY_DSN`-style placeholders and names where the real value lives.

---

## 3. The commands

Seven skills. Five are the loop, one is the escape hatch, one is setup.

Every command **finds its own starting point**. Nothing has to be looked up first, and
`/feature-status` is never a prerequisite for anything.

### 3.1 Frontmatter contract

Skill descriptions auto-match. One described loosely as "planning" fires on every "plan out X" prompt.
Every description is narrow, names the files it owns, and ends with an explicit-invocation clause:

```yaml
---
name: feature-plan
description: "Promote one item from the Tier-1 backlog in context/roadmap.md into a Tier-2 plan
  document under context/plans/, then stop without implementing. Explicit invocation only — run this
  when the user types /feature-plan. Do NOT match on 'plan out X', 'how should we build X', or any
  general planning or design request."
disable-model-invocation: true    # .claude/ copy only
---
```

`disable-model-invocation: true` is Claude Code's actual switch for this, and is the **only**
difference between the `.claude/` and `.agents/` copies of a skill — verified against
create-ai-blueprint, whose entire adapter diff across 23 skills is that one line. Prose in the
description is a hint; the flag is a switch. Use both.

**Name collisions:** `/plan` and `/status` are taken by Claude Code built-ins, which is why the
commands are `/feature-plan` and `/feature-status`. Keep the `feature-` prefix for anything new.

### 3.2 Runtime neutrality

The SKILL.md body is shared verbatim between both adapter trees, so it must not assume a runtime.
Codex has no `Agent` tool and no `subagent_type`. Every delegation is written as **optional**:

> Delegate to a planner subagent if your runtime provides one; otherwise draft the plan inline.

Host-specific dispatch lines live in `context/executors.md` (§4.3), never in a skill.

**This survives the v1 scope cut (§0).** v1 emits one tree, but a body written against `Agent`,
`subagent_type` or `AskUserQuestion` by name is a body that has to be rewritten when the second tree
arrives. Neutral costs nothing now.

### 3.3 `/roadmap` — Tier 1

```
/roadmap              # print the backlog, read-only
/roadmap "some idea"  # append one pending entry
```

Appends `pending` entries only; never promotes, never writes a plan, never marks anything `active`,
never removes an entry (entries leave only via `/feature-close`, which records why).

Checks for a near-duplicate first, and checks `history.md` — an idea previously `dropped` has a
recorded reason that must be addressed rather than ignored.

**Capture beats summarise.** When the user supplies reference material — a screenshot, a pasted setup
guide, a URL, a long explanation — it is written to `context/drafts/<NAME>.md` and linked from the
entry's `Doc` field, not compressed into a one-line entry and lost. Record the specifics that are
expensive to re-derive (exact package names, version constraints, config keys, error wording), where
it came from and when, and what it means for *this* repo. Never transcribe a credential (§2.7).

The entry itself stays one or two lines regardless. A third paragraph means the idea is ready for
`/feature-plan`, not that the entry should be longer.

### 3.4 `/feature-plan` — Tier 1 → a plan document

```
/feature-plan                        # rank the pending entries and ask which to plan
/feature-plan "<name>"               # plan a named entry
/feature-plan "<name>" --activate    # plan it, and mark it active
```

Produces `context/plans/<NAME>-PLAN.md` from `context/plan-template.md`, then **stops**. It never
implements anything and never marks a phase `done` — every phase in a new plan is `not started`.

**No active-feature refusal.** Planning is not activation, so several features can hold plans at once.
This is the change that makes planning ahead possible.

If the entry's `Doc` names a draft in `drafts/`, `git mv` it to `plans/<NAME>-PLAN.md` and build on its
content — do not create a second file and do not leave the draft behind. The draft is the most
valuable input available; carry its specifics forward rather than summarising them away, and mark
anything unverifiable as an open question instead of dropping it.

**Ranking**, when no name is given: has a draft (dominates — half-researched is better and cheaper) →
unblocked by something with a `history.md` row → smaller first → backlog order. Offer the top four via
the host's question mechanism, best first, each with a one-line reason. Exactly one `pending` entry:
state it and proceed. None: say the backlog is empty and name `/roadmap`.

**Already planned → start a conversation, not a refusal.** Say it is already planned, show it, and ask
whether to iterate on the plan. Iterate freely while every phase is `not started`; **warn first** if
any phase is `in progress`, `blocked` or `done` — rewriting a plan under work that already happened is
the "ledger disagrees with the repo" hazard arriving by a new route.

**`--activate`** marks *that item* `active` in `roadmap.md`, subject to §2.5. If another feature holds
the slot: write the plan, skip the activation, and name the feature that holds it. The plan is
valuable and harmless on its own — discarding it over a marker would undo the point of the split.

What it produces is **a reviewable skeleton plus open questions**, not a finished plan of record. Say
so plainly rather than presenting the draft as ready to execute.

### 3.5 `/feature-implement` — the execution loop

```
/feature-implement            # resolve or choose a feature, then run the next phase
/feature-implement "<name>"   # a named feature
```

Absorbs the reference's `/orchestrate` phase loop. Owns the Tier 2 → Tier 3 transition **and** the
phases within it.

1. **Resolve the feature.** If one is `active`, that is it. Otherwise rank the entries whose `Doc`
   points into `plans/` and ask which to activate — by open questions resolved, dependencies shipped,
   then size. None planned: name `/feature-plan`. Subject to §2.5 before setting the marker.
2. **The approval checkpoint.** Before activating, **surface the plan's Open questions and require
   acknowledgement**, and re-check that the files the plan cites still exist. Under the old design this
   checkpoint was structural — `/feature-plan` stopped and you typed `/orchestrate` — so it must now be
   explicit here or it is lost. A plan drafted a month ago against a since-changed tree is a state that
   can now exist and could not before.
3. **Pick the phase.** Read the ledger; take the lowest-numbered phase that is not `done` and whose
   `Depends on` entries are all `done`. **State which one you picked before starting.** If it is
   already `in progress`, read its Note and resume — do not restart.
4. **Check `findings.md`.** An open P0/P1 tied to this phase *is* the work.
5. **Stop on disagreement.** If the ledger's claim contradicts the repo — a phase marked `done` whose
   files do not exist, or the reverse — say so and stop. Never silently re-do or skip a phase.
6. **Do the work.** Delegate to a coder per `executors.md` if one is configured; otherwise implement
   in-host.
7. **Gate 1 — verification.** Read `context/verify.md` and run its sections in order: Lint →
   Typecheck → Build → Test. **Never carry a copy of these commands and never invent one.** A missing
   section is skipped, never faked. Exit 0 is the verdict regardless of summary text. If `verify.md`
   does not exist, stop and say so. Docs-only changes run Lint plus a read of the diff.
8. **Gate 2 — review.** Dispatch per `executors.md`. Requires concrete evidence — file paths, command
   output — for every verdict, and a P0–P3 severity on every blocking finding. A `FAIL` is **written to
   `findings.md` first, then** looped back. Cap: 2 loops, then write a finding and escalate.
   Escalating is not a substitute for recording: the conversation ends, the file does not.
9. **Close out the row**, in the same commit as the work. All scope landed and both gates passed →
   `done`. Some landed → stays `in progress`, Note rewritten to name exactly what remains. Gate capped
   or externally blocked → `blocked`, blocker in the Note. **Never mark `done` on a coder's
   self-report** — the gate output is the evidence — and **refuse `done` while an open P0/P1 is tied to
   the phase.**
10. **When every phase is `done`, say so and name `/feature-close`.** Do not move files, stamp headers
    or sweep references. That is a tier boundary and crossing it is an explicit command.

### 3.6 `/feature-status` — read-only

Writes nothing, commits nothing, invokes no other agent. **Never a prerequisite.**

Reads `roadmap.md` → the active plan's ledger → `findings.md` → `git status --short` and recent
commits. Nothing is cached and nothing is parsed by a script.

**Reconcile before trusting the ledger.** Report and stop on: a phase `done` whose files or commits do
not exist; a phase `not started` whose work is plainly in the tree; an `active` entry pointing at a
missing document; an entry `active` for a feature that already has a `history.md` row; **a document in
`plans/` that no roadmap entry points at.** Do not resolve a discrepancy yourself and do not pick a
next action off a ledger you have just shown to be stale.

Two things that are *not* discrepancies: every phase `done` while the entry still reads `active` is the
normal state before `/feature-close`; and a `done` row with changes still in the working tree is a
phase finished but not committed — name it, do not stop on it.

Report format — short, then **exactly one** next action, the first that applies:

```
Feature:  <name> — <status>        (or: none active)
Plan:     <path>
Phases:   <n> done · <n> in progress · <n> blocked · <n> not started
Findings: <n> open (<severities>)

Next: <exactly one action>
```

1. Open P0/P1 → fix it, quoting the ID and its closing condition.
2. A phase `in progress` → resume it, quoting its Note.
3. A phase `blocked` with all others `done` → report the blocker; the next action is the user's.
4. A phase `done` with a next unblocked phase → `/feature-implement`, naming the phase it will pick.
5. Every phase `done` → `/feature-close`.
6. No active feature, ≥1 entry with a plan → `/feature-implement`.
7. No plans, ≥1 `pending` → `/feature-plan`. **Do not pick a candidate** — that command ranks and asks.
8. Nothing at all → `/roadmap "some idea"`.

List only the phases that are not `done`, one line each. A list of three things to consider is what
this command exists to replace.

### 3.7 `/feature-close` — Tier 2 → retired

```
/feature-close                                # retire the active feature as shipped
/feature-close "<name>"                       # retire a named feature
/feature-close "<name>" --dropped "<why>"     # retire one that will not be built
```

Resolves the target from `active` **or** from any entry holding a plan — an abandoned plan is now a
droppable state.

**Refuse first**, and say so plainly: every phase must be `done`, and no open P0/P1 may be tied to the
feature. A refusal here is the workflow working. If the user overrides after being told, say what is
being overridden and proceed.

Then, as one reviewed change: remove the entry from `roadmap.md` and append a one-line `history.md`
row (date, name, outcome, why, link into `archive/`) — that file **indexes** depth, it does not
duplicate it. `git mv` the plan to `archive/`, not `mv`; its history is the record of how the feature
was built. Rewrite the document header to point at the history row — **do not stamp the outcome and
date into the document**, which is the mistake §2.1 exists to prevent. Then sweep every reference:

```bash
grep -rn "<old-path>\|<OLD-FILENAME>" --include='*.md' . | grep -v node_modules
```

Rewrite links, minding depth. **Leave §-number citations alone** — source comments cite plan sections
without a path (`// SMART-CROP-PLAN.md §7.3`); those survive the move and must not be "helpfully"
rewritten into paths that will rot. **Show the full list of edits before committing** — that review is
why this is an explicit command rather than a side-effect.

Finally, move closed findings tied to the feature out of `findings.md` into the archived plan's log.
`findings.md` must not grow for the life of the project.

`--dropped` has no ledger check; unfinished phases are expected. Record the user's reason verbatim in
substance — that row is what stops the idea being re-proposed, so a vague reason makes it worthless.
If the entry never had a document, nothing moves.

### 3.8 `/orchestrate` — the ad-hoc escape hatch

```
/orchestrate "<what to do>"
```

A gated one-shot pass over a scope you name. No roadmap entry, no ledger, no tier boundary crossed.

It exists because the valuable part of the reference's orchestrate was never the phase loop — it was
the **gate machinery**: Gate 1 reading `verify.md`, Gate 2's reviewer, failures landing in
`findings.md` before loopback. That is worth having for unplanned work too, arguably most of all,
since that is where fixes get cowboyed. Without it, the only route to a verified reviewed change is to
file a roadmap entry, and people will route around the workflow for small things.

**Guards, or it becomes the way to skip planning:**

- **Refuses anything that is not commit-sized.** A phase is a commit-sized unit with a checkable
  outcome, not a category of activity.
- **Refuses anything an existing roadmap entry already covers**, naming `/roadmap` and `/feature-plan`.
- Applies §2.6 as the test.

Runs the same Gates 1 and 2 as `/feature-implement`. Findings it raises are recorded with
`Tied to: ad-hoc`. Because those belong to no feature, nothing would ever retire them and
`findings.md` would grow forever — so **`/orchestrate` sweeps closed ad-hoc findings when it starts**,
and `check` reports any closed finding still in the file.

*Naming note: `/orchestrate` now sounds larger than `/feature-implement` while being the smaller of
the two. `/task` is the rename to reach for if that grates; every other candidate was worse.*

### 3.9 `/onboard` — setup

Re-runnable. Fills the project-owned stubs that `init` deliberately leaves empty, by **asking**.
Asking is not guessing; `init` guessing a project's test command recreates the exact rot this design
removes.

1. ~~**Host agent**~~ — deferred (§0). v1 is Claude Code.
2. ~~**Coder offload**~~ — deferred (§0). Gate 1 and Gate 2 run in-host.
3. **Reviewer dispatch** — writes Gate 2's invocation into `executors.md`. One line in v1.
4. **Standards source** — the bundled default or a git URL (§6.3).
5. **Verification commands** — propose candidates from `package.json` scripts or the stack equivalent,
   **run each one, and write only those that exit 0** into `context/verify.md`. This turns that file
   from someone's guess into something verified at install time, which is the F-001 failure mode caught
   at the only moment it is cheap to catch.
6. **Stack** — a few questions to seed `context/stack.md`.

Writes placeholders, never secrets (§2.7). Does not commit.

---

## 4. What gets installed

```
context/
  README.md              tool      the directory, the boundary, the rules
  workflow.md            tool      the tier model, the invariants (§2.5, §2.6, §2.7)
  plan-template.md       tool      the bare Tier-2 skeleton, copied verbatim
  plan-template.notes.md tool      prose about the template
  roles/coder.md         tool      the coder system prompt — no commands in it
  standards/             tool*     vendored default; see §6.3
  stack.md               project   STUB — runtime, layout, conventions, index of your own files
  verify.md              project   STUB — section headings, no commands
  executors.md           project   STUB — coder and reviewer dispatch
  roadmap.md             project   STUB — empty Features list
  history.md             project   STUB — header and empty table
  findings.md            project   STUB — contract and empty Open section
  drafts/  plans/  archive/         project   .gitkeep
  .state/manifest.json   tool      version, adapters, sha256 per managed file

.claude/skills/<seven>/SKILL.md     tool      when the host includes Claude Code
.agents/skills/<seven>/SKILL.md     tool      DEFERRED to v2 — see §0
.claude/agents/*.agent.md           tool      Claude subagent definitions (planner, reviewer)

AGENTS.md    a delimited block, merged (§5.2)
CLAUDE.md    created as a single `@AGENTS.md` line only when absent
```

`*` `standards/` is managed only while it is ours and unmodified — see §6.3.

### 4.1 Ownership

| In the manifest — replaced on `update` | Absent from it — unreachable by the updater |
|---|---|
| `README.md`, `workflow.md`, `plan-template*.md`, `roles/coder.md` | `stack.md`, `verify.md`, `executors.md` |
| both skill trees, `.claude/agents/` | `roadmap.md`, `history.md`, `findings.md` |
| the `AGENTS.md` block | `drafts/`, `plans/`, `archive/` |
| `standards/` while ours and unmodified | `CLAUDE.md`; `standards/` once swapped or edited |

The boundary is enforced by the data structure, not by a rule someone has to remember: `update` walks
the manifest, and a project-owned file is not in it, so no code path reaches it. `update` prints both
columns when it runs — a visible boundary beats a documented one.

**Anything else you add under `context/` is yours forever**, by the same property. `context/decisions.md`,
`context/glossary.md`, `context/ops-notes.md` — all survive by default, no feature required.

Because of that, the tool-owned `README.md` lists **only what the tool installs**, ends with a line
saying anything else under `context/` is project-owned and untouched, and points at `stack.md` as the
place to index your own additions. Indexing them in `README.md` would lose them on the next update.

### 4.2 `verify.md` — the stub

Ships with section headings and no commands, plus the rules that make an empty section safe:

- **A missing entry is skipped, never faked.** Gate 1 skips an empty section and says so; it does not
  substitute a command it invented.
- **Docs-only changes run Lint only**, plus a read of the diff.
- **Exit 0 is the verdict**, regardless of what any summary text claims.
- Keep it in step with CI. If a command here fails while CI is green, this file is the one that is wrong.

This file is the single home for every command in the project. Nothing else — no skill, no agent
prompt, no role file — ever names one. The reference violated this in four places; three of its four
hardcoded gate commands could not succeed against its own tree (§7.1).

### 4.3 `executors.md` — the new project-owned file

Hand-written prose, read fresh at dispatch time, exact parallel to `verify.md`. Holds the coder and
reviewer invocations for this project and host, written by `/onboard`.

This is where `--add-dir "$HOME/Library/pnpm"` and `--add-dir "$HOME/.cache"` belong. The reference
hardcodes both into its skill, baking a pnpm-on-macOS assumption into the tool — the exact failure
mode the "no skill hardcodes a path or command" rule exists to stop.

It also carries the operational lessons that are genuinely portable:

- **Exit code alone proves nothing.** `codex exec` exits 0 after hitting a usage limit mid-run, having
  completed most but not provably all of a brief. Grep captured output for `You've hit your usage
  limit` and `ERROR:` before trusting a summary; check `git status` and acceptance criteria
  individually on a hit.
- Model selection comes from the CLI's own config where one exists (`~/.codex/config.toml`), so there
  is one place to update when models turn over. A hardcoded `-m` flag silently broke the reference
  pipeline: Codex rejected the model and still exited 0, writing nothing.
- **No blanket permission-bypass flag.** Scope permissions in the CLI's own config instead. A standing
  bypass-everything instruction in a committed file is persistent privilege escalation.

---

## 5. Agent-agnostic distribution

### 5.1 Two skill trees, one body

**v1 emits `.claude/skills/` only (§0).** The rest of this section is the v2 target, and §3.2 is what
keeps it cheap to reach.

Per §1.2 and the Claude Code equivalent, the two hosts read disjoint directories. So the same SKILL.md
body is written to both, differing only in the `disable-model-invocation` frontmatter line (§3.1).

`.agents/` is preferred over `.codex/` — both work, but `.agents/` is tool-neutral and matches the
`AGENTS.md` convention that Copilot and OpenCode also follow.

Duplication is the cost. It is contained because one canonical source lives in the package, both trees
are written at install, both are hashed in the manifest, and neither is ever hand-edited — so drift is
structurally impossible rather than merely discouraged.

**Rejected: a thin CLI** (`npx <name> feature-plan` printing a procedure). It puts a Node process
between an agent and a hand-written file it can already open, becomes a second home for the procedure,
and cannot be reached by the host's own skill machinery.

**Rejected: prose-only in `AGENTS.md`** as the primary path. It works — test B proves pointer-following
works — but it loses the invocation affordance. It stays as the fallback tier for hosts with neither
directory.

### 5.2 `AGENTS.md` — minimal, and merged not owned

Never own the file. Write a delimited block:

```
<!-- ai-workflow:start -->
...
<!-- ai-workflow:end -->
```

- **No markers, file exists** → append the block.
- **No file** → create it containing just the block.
- **Markers present** → `update` replaces what is between them, leaving everything outside untouched.
  It replaces; it never appends twice.
- **Content edited inside the block** → the same conflict class as any managed file. The manifest hashes
  the block: unmodified replaces silently, edited reports a conflict, `--force` takes ours.
- **Duplicate markers** (a double paste) → refuse and report.
- **Markers malformed or unclosed** → refuse and report. Never re-append blindly.

**Keep the block small.** The test: *does an agent need this to know the commands exist?* Command names
are undiscoverable — nothing tells you `/feature-implement` is a thing — so the command table is inline.
Everything else is a pointer, with `workflow.md` first so the rules are one hop away. Roughly 15–20
lines, against the reference's ~80.

That reduction is licensed by test B. The reference inlines its rules on the stated premise that "a
pointer is not a guarantee that they get read"; Codex followed the chain unprompted through eleven
standards files. The caveat in §1.1 applies, and the mitigation is that this block is the cheapest
thing in the system to grow later — one file, one `update`.

`CLAUDE.md` gets exactly one line, `@AGENTS.md`, and only when the file does not already exist. If it
exists without the import, offer to add that one line and touch nothing else.

---

## 6. The installer

```
npx @baldurpan/create-ai-workflow                      # overlay onto this repo
npm  create @baldurpan/ai-workflow                     # same thing, shorter
npx @baldurpan/create-ai-workflow update [--dry-run] [--force]
npx @baldurpan/create-ai-workflow standards add <git-url>
npx @baldurpan/create-ai-workflow check
```

Single `bin`, named `create-ai-workflow`. Bare invocation scaffolds — the `create-*` convention — so
there is no `init` subcommand. The README's first line says **overlay onto an existing repo**, not
scaffold; `create-*` conventionally implies an empty directory and this tool does not.

### 6.1 Install

- **Refuse loudly if `context/` already exists.** Do not merge. `context/` stays a fixed directory name:
  making it configurable would turn every skill's literal `context/roadmap.md` into install-time
  generated text, reintroducing the generation step §2.4 exists to delete. It is deliberately
  vendor-neutral — the point of moving off `.claude/` — and the dotfile alternatives hide the thing
  whose whole value is that a human reads and hand-edits it.
- Scaffold project-owned files as **stubs**. Never detect, never guess a command.
- Write both skill trees per the chosen host, the `AGENTS.md` block, and the manifest.
- **Do not commit.** The user reviews and commits.
- One `context/` per repository. No monorepo sub-scoping.

### 6.2 Update

Borrowed from create-ai-blueprint, whose mechanism is the right one. The manifest holds
`{schemaVersion, version, adapters, managedFiles: {path: sha256}}`.

| On-disk state | Action |
|---|---|
| hash matches the manifest | replace silently |
| hash differs | conflict — report; `--force` backs up and replaces |
| missing | restore |
| not in the manifest | untouchable |

`update` is the upgrade path for everything tool-owned, including the `AGENTS.md` block. `--dry-run`
prints the plan and changes nothing.

### 6.3 Standards

The bundled default is vendored from `baldurpan/ai-engineering-standards`. A `.source` marker records
the origin and ref so `update` can report when upstream has moved.

**The conditional-loading table is the interface, not the files behind it.** `context/standards/README.md`
holds a table of the form

| If the task involves… | Load… |
|---|---|
| TypeScript code | `typescript/rules.md`, `typescript/anti-patterns.md` |

and test B proved agents actually traverse it — Codex read that file and then pulled exactly the eleven
files it pointed at, with no path anywhere in the brief. The skills say "consult the conditional loading
table in `context/standards/README.md`."

So `standards add <git-url>` must guarantee that file does its job:

1. Use the source repo's table when it has a conforming one.
2. Offer to generate one from the directory structure when it does not.
3. **Refuse** rather than install a tree the skills cannot navigate.

Whatever lands is project-owned from that point — it drops out of the manifest, so `update` never
clobbers it.

*Argued and overruled, recorded for the record:* shipping a TypeScript/React/PHP set into a Rust repo is
not inert, because agents load from that table unprompted — a wrong set is loaded on every task. The
decision is to ship the default and make swapping easy and visible.

### 6.4 `check`

Reports structural breakage. Never writes — no `--fix`, because the moment it can repair a ledger a
program's edit competes with a hand edit. Nothing depends on it: no skill calls it, no git hook installs
it (a pre-commit hook is a build step in the loop under another name, and it blocks commits). CI is
opt-in and the user's call.

The test it must pass: **delete it and every workflow answer is unchanged.** `scripts/next.ts` was cut
from the reference because it *derived* the answer to "what's next", which can disagree with its source
and which agents then read instead of the ledger. `check` derives nothing.

Rules, all of them already stated verbatim in `workflow.md` or `plan-template.md`, each error message
quoting the rule it enforces so a false positive points at the doc that is out of step:

- ledger column set differs from the template's
- an illegal status word (`not-started` vs `not started`)
- a `Depends on` naming a phase that does not exist, or a cycle
- more than one entry marked `active`
- a `**Status:**` header anywhere under `context/`
- two phase tables in one plan
- a document in `plans/` with no roadmap entry pointing at it
- a `Doc` field or `history.md` link pointing at a missing file
- a closed finding still sitting in `findings.md`

**Reads `roadmap.md`, `plans/`, `history.md`, `findings.md` only — never `archive/`.** Retired plans
encode whatever format was current when they were written; validating historical records against current
rules is exactly the false-positive machine that makes validators get ignored.

Keep the rule set small and derivative. A validator that cries wolf after a template change is worse
than none, because people start editing valid documents to satisfy it.

---

## 7. Corrections to the reference — do not copy these

The reference was built in one project against one stack. These are the parts that are local habit or
live bugs rather than principle.

### 7.1 `coder.md` carries a fourth copy of the dead commands

`.claude/agent-prompts/coder.md` still tells the coder that verification is `pnpm biome ci .`,
`pnpm --filter <pkg> build`, and `pnpm exec nx run-many --target=test` — naming the same non-existent
`nx` that finding F-001 documented. F-001 was closed by pointing `/orchestrate`'s Gate 1 at `verify.md`,
but this copy survived the fix and is still wrong in the repo today.

That is the single-source-of-truth rule failing in the wild. In this tool, `verify.md` is the only file
that names a command — role prompts included. Strip them from `roles/coder.md`; what remains (output
contract, loopback rules, coding principles) is generic, which is what makes it tool-owned.

### 7.2 `template.md` is a document *about* a template with the skeleton fenced inside it

Copying it means extracting a fenced block and stripping italic guidance. That will ship a plan with the
guidance still in it at least once. Split into `plan-template.md` (bare, copied verbatim) and
`plan-template.notes.md` (the prose).

### 7.3 "Explicit invocation only" is under-implemented

The reference relies on prose in the skill description. Claude Code has an actual switch,
`disable-model-invocation: true`. Use both (§3.1).

### 7.4 The archived plans disagree on ledger columns

`context/archive/CLOUDFLARE-PLAN.md` §11.1 is `| # | Phase | Status | Note |` — no `Depends on`.
`SMART-CROP-PLAN.md` §7.1 has it. The phase-selection rule *is* "lowest-numbered not-`done` phase whose
`Depends on` are all `done`", so a plan missing that column silently degrades the rule. `check` catches
this at write time (§6.4).

### 7.5 Phase file lists become mandatory

`/feature-status`'s reconciliation is the highest-value step in the workflow and the least specified —
"check the ledger against reality" is only executable if each phase section names the files it touches.
The template says that advisorily in §6.2; make it required, because it is what turns reconciliation
from judgement into a check.

### 7.6 Smaller

- **`docs/` phrased neutrally.** The reference reserves `docs/` for itself; an arbitrary repo already
  uses it for something. Say "planning artifacts live in `context/`, wherever else your docs live."
- **Standards injection deleted entirely** (§1.1). Briefs cite paths; `references/standards-injection.md`
  does not ship.
- **`findings.md`'s `Tied to:`** accepts a phase *or* `ad-hoc` (§3.8).

---

## 8. Open items

1. **Reviewer dispatch under Codex — deferred with the rest of Codex support (§0).** Codex ships `codex review` as a
   subcommand and a `~/.codex/skills/.system/review-agent/SKILL.md` described as "Use when another agent
   delegates review of uncommitted changes, a base-branch diff, a commit, or custom review
   instructions." Either may serve Gate 2. Do not hardcode the winner — `/onboard` writes the chosen
   invocation into `executors.md`, and what ships is the **contract**: a review happens, it returns a
   verdict with a P0–P3 severity, and a `FAIL` writes a finding before the loopback. With no independent
   reviewer configured, Gate 2 degrades to the host reviewing the diff against the plan's review
   checklist — weaker, but still a gate, and it says so.

2. **`npm login`** is required before the first publish; this machine returns E401. Nothing is
   published. `npm pack` produces a working 139 kB / 115-file tarball, verified by installing it into a
   clean repo and running `install`, `check` and `update --dry-run` against it.

3. **Licensing for the vendored standards — checked, and it is a real gap.**
   `baldurpan/ai-engineering-standards` has **no LICENSE file** (`git ls-files | grep -i licen` returns
   nothing). So the terms under which 78 vendored files may be redistributed into arbitrary repositories
   are unsettled; they are bundled on the author's own authority and nothing more. The README says so
   plainly and points at `standards add <git-url>` for anyone who needs known terms. **The cheap fix is
   upstream:** add a LICENSE to that repo and the item closes. Until then this is the one thing in the
   package that could not be defended to a third party.

4. **`agy` is untested** against §1.1. The F-002 result covers Codex only. Anything that assumes an
   executor can read project files should degrade safely if it cannot.

5. **The dogfood was run by hand, not under a live agent.** §9 step 8 was executed by following each
   SKILL.md literally — install into a scratch repo with a real `package.json`, `/onboard`'s
   run-each-candidate pass, `/roadmap` → `/feature-plan` → `/feature-implement` (both phases, both
   gates) → `/feature-close`, with `check` clean at every step and correctly reporting four planted
   breakages afterwards. That proves the documents are *executable* and mutually consistent. It does
   **not** prove the descriptions fire correctly, that `disable-model-invocation` suppresses
   auto-matching, or that a real session picks the right phase unprompted. **Run the loop under Claude
   Code before publishing**; description auto-matching (§3.1) is the part least testable from here and
   the part most likely to be wrong.

6. **Two findings from the build, both fixed, both worth not re-learning.**
   - Importing the CLI module executed it: a test that imported `parseArgs` ran the installer into the
     tool's own repo. Entry point is now split — `cli.ts` exports, `bin.ts` runs. Any future entry point
     keeps that split.
   - The stubs' commented-out example entries were parsed as real content by a naïve scan. `check`
     strips HTML comments so it was never fooled, but an agent or a one-off script would be. Examples
     now sit in blockquotes above the `---`, outside the sections anything scans, and three tests assert
     the stubs parse to zero entries, zero findings, zero history rows.

---

## 9. Build order

1. Package skeleton, `bin`, template tree, manifest read/write, `check` — the parts with no agent in
   the loop and real unit tests.
2. `install` and `update`, including the `AGENTS.md` block merge and its five edge cases (§5.2).
3. The seven SKILL.md bodies, written runtime-neutral (§3.2), emitted to `.claude/skills/` only.
4. `context/` tool-owned documents: `README.md`, `workflow.md`, `plan-template.md` + notes,
   `roles/coder.md`.
5. Project-owned stubs.
6. `/onboard`, including the run-and-keep-what-exits-0 verification pass (§3.9 step 5).
7. `standards add` (§6.3).
8. Dogfood: install into a scratch repo, run the full loop — `/roadmap` → `/feature-plan` →
   `/feature-implement` → `/feature-close` — under Claude Code.

Steps 1–7 are built and tested (66 tests). Step 8 is done by hand and not yet under a live agent — see
§8.5.

---

## 10. Decisions taken during implementation

Three places where the plan left the call open and the build had to make one, plus a note on what the
test suite actually guards. Recorded because each is cheap to reverse now and annoying later.

### 10.1 A closed finding is a `note`, not an error

§6.4 lists "a closed finding still sitting in `findings.md`" among the rules, and §3.8 says `check`
"**reports**" it. The build takes that word literally: `check` has two levels, and this rule is the only
one at `note` — printed, but it does not fail the exit code.

The reason is §6.4's own closing paragraph. A session that closes a finding legitimately leaves it in
the *Closed* section until `/feature-close` sweeps it, so an error-level rule would turn `check` red
during the normal window between those two events. "A validator that cries wolf after a template change
is worse than none" applies just as hard to one that cries wolf during ordinary work.

**To reverse:** change the one `level: 'note'` in `src/check/rules.ts` to `'error'`.

### 10.2 The standards tree is adopted whole, not per file

§6.2's table says a hash mismatch is a conflict; §4.1 says `standards/` is tool-owned only "while ours
and unmodified". Those disagree for standards specifically. The build follows §4.1: **one edited file
under `context/standards/` hands the entire tree to the project** — every standards entry drops out of
the manifest, `update` reports the adoption rather than a conflict, and nothing there is ever written
again, `--force` included.

Per-file adoption was rejected because the tree is an interface, not a bag of files: the README's
conditional table and the files it names have to agree, and a half-managed tree is one where an update
replaces a file the user's own table no longer points at.

### 10.3 Subagent definitions use `model: inherit`

The reference pins `model: opus` on its planner and `model: sonnet` on its reviewer. The package ships
into other people's accounts, so it assumes nothing about model access: both `.claude/agents/*.agent.md`
use `inherit`. Pinning is a one-line edit in a file the user owns after install — and it is in the
manifest, so pinning it makes it a conflict on the next `update`, which is the correct signal.

### 10.4 Tests guard the invariants that would otherwise rot silently

Four of the 66 are not testing code; they are testing that the *content* still holds its own rules, and
they exist because the reference violated exactly these:

- **No skill body names a runtime primitive** (§3.2) — the guard that keeps the v2 tree a directory to
  write rather than a rewrite of seven files.
- **Only `verify.md` names a verification command** (§4.2, §7.1) — scans every template, and would have
  caught all four of the reference's copies.
- **Nothing carries a `**Status:**` header** (§2.1).
- **Every relative link resolves after install** — this one found two real cases where a link is correct
  at its *destination* rather than its source: `plan-template.md`'s `../roadmap.md` (correct once copied
  into `plans/`) and `/feature-close`'s archived-header example (correct once written into `archive/`).
  The second is now a fenced block, which is clearer for the agent anyway.
