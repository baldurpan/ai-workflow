# Design record — `@baldurpan/create-ai-workflow`

**Read this on demand, not on arrival.** It is the record of *why* the tool is shaped the way it is: the
tests that were run, the alternatives rejected, and the reasoning behind each decision. **The code is now
the authority on all of it** — where this document and the repository disagree, the repository is right
and this document is history.

Open it when you are about to change something and want to know what it cost to arrive at, or when a
`§`-number elsewhere points here. The live work is in [`PLAN.md`](PLAN.md).

It was extracted from the working implementation in `/Users/baldur/Development/baldurpan/dynjandi`, which
is still the reference for anything not covered here.

---

## 0. Scope — v1 deferred four things; v2 landed them

v1 shipped Claude Code only. The claim being tested was that this **reduces the build without changing
the design**. It held: no SKILL.md was rewritten, and the second tree cost nine lines in `managedFiles`.

| Deferred in v1 | What v2 did with it |
|---|---|
| The `.agents/skills/` tree — v1 wrote `.claude/skills/` only (§5.1) | Both trees ship, from one body. The one-line difference was already isolated in `claudeSkillTransform`, so the second tree is a `dest` and no transform |
| Coder offload. Gate 1 and Gate 2 ran in-host | `/onboard` Step 1 asks — and **tests** the §1.1 assumption per machine before writing an invocation down, rather than inheriting it |
| `/onboard`'s host and offload questions (§3.9 steps 1–3) | The host question **dissolved rather than shipped.** Both trees install unconditionally, so there is nothing to ask and nothing to branch on. Step 1 became coder dispatch; steps renumbered |
| §8.1, reviewer dispatch under a second host | Not answered — **refused, and the refusal is enforced.** No host's review command appears anywhere in the package; `/onboard` finds what the host offers and writes the choice into `executors.md`. A test fails the build if a template names a coding-agent CLI |

The last row is the one that generalises. A host's review facilities are a moving target — a subcommand,
a system skill, both, neither — so the package that hardcodes a winner is wrong on some machine on some
day, silently. Shipping the contract and asking costs one question at onboard time and never rots.

**What the deferral protected — and it held:**

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
*that* host directly. v2 stops relying on it by inheritance — `/onboard` Step 1 re-runs the test against
whatever executor is actually configured, and records the answer in `executors.md`, because the executors
that fail it are exactly the ones nobody has checked. For Claude Code the mechanism differs — `@AGENTS.md` is expanded into context at
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
- **A vendored file named `biome.json` is a live Biome config.** Biome discovers configuration by name,
  walking up from each file, so `templates/biome.json` in the standards tree configured Biome for the
  files beside it — in this repository, and in every project the tree installs into as
  `context/standards/templates/`. It is vendored and installed as `templates/biome-example.json`
  instead, which is the one deviation from upstream that is *not* undone at write time: restoring the
  name would hand the problem to every consumer. Recorded in `standards/.source`. The same reasoning
  applies to anything else vendored under a name a tool auto-discovers.

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

### 2.8 A phase row is written twice

The ledger row **opens** to `in progress` when work on the phase starts, and **closes** to `done`,
`in progress` or `blocked` when it ends. Only the closing write is bound by "as part of the same change
as the work" (§4.4); the opening one is left in the working tree and lands with the work it describes.

The two writes answer different questions. The closing write records a verdict. The opening one exists so
that a run interrupted mid-phase — context exhausted, session closed, run cancelled — leaves behind a row
that says so, because the half-finished tree it leaves behind cannot say it itself.

**This was missing from v2 as shipped.** `in progress` was a legal value that nothing ever wrote: every
mention of it across the skills and `workflow.md` was a *read* ("if it is already `in progress`, resume")
or a *retain* ("*stays* `in progress`") — and "stays" is wording that presupposes an entry-write which was
never specified. A phase therefore went `not started` → `done` in one step, `/feature-status` counted a
running phase as `not started`, and both documented resume paths were unreachable.

### 2.9 Documentation is part of the change

A plan named every source file it touched and nothing about the documentation those files made wrong. The
gates could not catch it: Gate 1 runs lint, typecheck, build and test, and a README that describes a
renamed flag passes all four. Gate 2 reviews the diff against the plan — and the plan never asked for the
doc, so its absence is not a deviation. **Docs are the only output of this workflow with nothing behind
them**, which is why the drift is invisible until someone follows the old instructions.

Fixed with three pieces, one per existing home, and no new gate:

- **Where the docs are** — a `## Documentation` section in `stack.md`, the project-owned file that already
  holds what an agent must know before touching this repo. `/onboard` Step 7 fills it: a sweep of the tree
  for READMEs, `docs/`, a docs site, an API reference, a changelog, help text in the code, **plus a
  question about what is published elsewhere.** A wiki or a docs site built from another repository is
  invisible to any sweep, and it is the surface that rots longest.
- **What this feature makes untrue** — §7 of the plan template, one row per surface, each assigned to a
  phase. Inserted before Verification, which pushed it to §8 and Open questions to §9.
- **Who carries it** — the phase named in the row, whose `Files:` line names the same path. This is the
  whole reason §7 is a table with a Phase column rather than a paragraph: a documentation item not on a
  `Files:` line is a follow-up, and follow-ups are what this failure is made of. Nothing new reconciles it
  — `/feature-status` already checks `Files:` against the repo, so a doc path lands inside a check that
  exists.

Two smaller calls worth recording:

- **An empty index is not "no docs".** The same shape as §4.4's unstated premise: a section nobody filled
  in and a project that documents itself nowhere are different facts, and a command that cannot tell them
  apart will resolve it the cheap way every time. So `/onboard` writes `none` explicitly, `/feature-plan`
  sweeps the tree when the section is empty, and a plan that changes no documentation has to say which
  surfaces it checked.
- **`/feature-implement` cites the section by name, not by number.** It reads plans it did not write,
  including ones drafted against the older template where Open questions is §8. `/feature-plan` still cites
  numbers, because it writes against the template shipping beside it. A test parses the template's headings
  and fails any *titled* citation anywhere in the package that does not resolve — untitled ones like
  `// SMART-CROP-PLAN.md §7.3` are illustrations of a plan of unknown vintage and are left alone.

## 3. The commands

Eight skills. Five are the loop, one is the escape hatch, one is setup, and one — §3.10 — is a
pre-plan sketchpad that nothing else depends on.

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

**This survived the v1 scope cut (§0), and that is the whole reason v2 was cheap.** v1 emitted one tree;
a body written against `Agent`, `subagent_type` or `AskUserQuestion` by name would have had to be
rewritten seven times when the second tree arrived. It was rewritten zero times.

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
6. **Open the row.** Set the phase to `in progress`, with a Note naming what is underway, **before any
   code.** The opening write is not committed on its own; it lands with the work.
7. **Do the work.** Delegate to a coder per `executors.md` if one is configured; otherwise implement
   in-host.
8. **Gate 1 — verification.** Read `context/verify.md` and run its sections in order: Lint →
   Typecheck → Build → Test. **Never carry a copy of these commands and never invent one.** A missing
   section is skipped, never faked. Exit 0 is the verdict regardless of summary text. If `verify.md`
   does not exist, stop and say so. Docs-only changes run Lint plus a read of the diff.
9. **Gate 2 — review.** Dispatch per `executors.md`. Requires concrete evidence — file paths, command
   output — for every verdict, and a P0–P3 severity on every blocking finding. A `FAIL` is **written to
   `findings.md` first, then** looped back. Cap: 2 loops, then write a finding and escalate.
   Escalating is not a substitute for recording: the conversation ends, the file does not.
10. **Close out the row**, as part of the same change as the work. All scope landed and both gates
    passed → `done`. Some landed → stays `in progress`, Note rewritten to name exactly what remains.
    Gate capped or externally blocked → `blocked`, blocker in the Note. **Never mark `done` on a
    coder's self-report** — the gate output is the evidence — and **refuse `done` while an open P0/P1
    is tied to the phase.**
11. **When every phase is `done`, say so and name `/feature-close`.** Do not move files, stamp headers
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

*(A host question was step 1 in the v1 design. It dissolved — both trees install unconditionally, so
there is nothing to branch on. Steps renumbered.)*

1. **Coder dispatch** — in-host or offloaded. If offloaded, the invocation goes into `executors.md`, but
   **only after the §1.1 assumption is tested against that executor**: cite a path, ask for a fact only
   readable from the file, and record whether it came back. An executor that fails needs content inline,
   which is a fact about briefs that nothing downstream can guess.
2. **Reviewer dispatch** — writes Gate 2's invocation into `executors.md`. What it must *not* do is
   assume: a host commonly offers several shapes of review that do not review alike, so it finds out,
   shows the user, and lets them pick (§0).
3. **Standards source** — the bundled default or a git URL (§6.3).
4. **Verification commands** — propose candidates from `package.json` scripts or the stack equivalent,
   **run each one, and write only those that exit 0** into `context/verify.md`. This turns that file
   from someone's guess into something verified at install time, which is the F-001 failure mode caught
   at the only moment it is cheap to catch.
5. **Stack** — a few questions to seed `context/stack.md`.

Steps 1, 2 and 4 are the same move applied to three subjects: **do not write down a thing you have not
run.** That is the whole of what this command is for.

Writes placeholders, never secrets (§2.7). Does not commit.

---

### 3.10 `/prototype` — the pre-plan sketchpad

```
/prototype "<what to mock>"
```

Throwaway HTML and CSS under `prototypes/<NAME>/`, to settle a layout or look-and-feel question a plan
would otherwise argue about in prose. Ported in spirit from `aiblueprinthq/ai-blueprint`'s `/prototype`,
not in substance — that one exists to **lock a new project's look**, with `theme.css` tokens ported into a
scaffolded app's `@theme` as its durable output. This tool overlays repositories that already have a look,
so the deliverable is inverted: **borrow before inventing**, mark every invented value, and the durable
part is `NOTES.md` — what the sketch settled — not the tokens.

**It is the one stack-shaped skill, and that is defensible only because of what it is not.** It crosses no
tier, has no ledger, runs no gates, writes no application code, and nothing in the loop requires it. A Rust
CLI or a headless API never invokes it and loses nothing; the other seven stay stack-agnostic, and the
`one home for commands` test still holds across all eight. Had this been a loop step, the answer would have
been no.

**`prototypes/` at the repository root**, not under `context/`. Rejected: `context/drafts/<NAME>/`, which
reads correctly — "source material for an idea not yet planned" — but collides with §3.4's `git mv` of a
draft *file* to `plans/<NAME>-PLAN.md`; a directory cannot follow it, so the mockups would strand in
`drafts/` for a feature that is no longer there. Also rejected: `context/prototypes/`, which fixes that at
the cost of a `/feature-close` sweep line for a folder the tool does not own. The root keeps a disposable
artifact visibly disposable, and keeps `context/` documents-only.

**Committed, not ignored** — blueprint's reasoning holds unchanged: until a plan absorbs `NOTES.md`, its
conclusions live nowhere else, and an untracked folder does not survive a cleared context or a second
machine. It is short-lived in git, not throwaway that never lands.

**One conditional line in `/feature-plan` (§3.4), and nothing else in the loop.** Its research brief reads
`prototypes/<NAME>/` *if the folder exists*. Absent, the step is a no-op — which is what keeps the command
optional in fact and not just in prose. Without it the prototype's value would depend on the user
remembering to mention the folder.

**No `feature-` prefix.** That rule (§3.1) is collision-driven — `/plan` and `/status` are host built-ins.
`/prototype` collides with nothing and is not feature-tier-bound, so it is named like `/roadmap`,
`/orchestrate` and `/onboard`.

**Single file, no bundled `reference/`.** `managedFiles` ships `skills/<name>/SKILL.md` and nothing else
per skill; a reference asset means walking the skill directory in the installer and a manifest entry for
every file in it. Blueprint's `theme-variables.css` is one small example — the skill states the shape in
prose instead and pays nothing.

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

.claude/skills/<eight>/SKILL.md     tool      the shared body plus `disable-model-invocation: true`
.agents/skills/<eight>/SKILL.md     tool      the shared body, verbatim
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

### 4.4 `git.md` — who commits

The third file in the same shape as `verify.md` and `executors.md`: hand-written prose, project-owned,
read fresh at the moment it is needed. **Added after a live run, not designed in.**

The workflow never told an agent to commit. It said phases are commit-sized, that `done` means landed,
and that a ledger row is updated "in the same commit as the work" — three statements that presuppose a
commit without ever saying who makes it. An agent resolves that the only way it can, and the observed
behaviour was a commit at the end of every phase, in a repository the tool had been installed into.

That is the general failure worth naming: **an unstated premise is not neutral.** A document that
assumes an answer while declining to state it does not leave the question open — it delegates the answer
to whatever the reader infers, which is the one outcome nobody chose. Two other files exist for exactly
this reason; this one was missing.

- **Default: the user commits.** A tool that installs itself into someone else's repository does not get
  to write that repository's history unasked. It is also the answer `/onboard` already gave about its own
  edits ("Do not commit. The user reviews and commits"), so the package was internally inconsistent.
- **The invariant survives both answers.** "In the same commit as the work" became "as part of the same
  change as the work" everywhere: one commit where the agent commits, one working tree handed over where
  the user does. What must not happen — a ledger row landing separately from the code it describes — is
  unchanged.
- **`done` is a verdict about the gates, not about git.** It had been defined as "committed and
  verified", which under the default answer would be unreachable. `/feature-status` used to report an
  uncommitted `done` row as something to name; it is now the normal end state.
- **Branching and pushing are explicitly out of scope**, in the file itself. The workflow has never
  created a branch or pushed, and a file about git is exactly where someone will assume it does.
- **The absence of the file is a defined state**, like an empty `verify.md` section: an install from
  before it shipped reads as *the user commits*, said once, with `/onboard` named. `update` cannot write
  stubs — that is what makes stubs project-owned — so upgraded installs have no `git.md` and must not
  break.
- **`/onboard` Step 4 asks it**, between reviewer dispatch and the standards question, and a commit rule
  found in inherited `AGENTS.md` prose now has a destination in Step 1's routing table.
- **A test enforces it**, per §7.3's lesson: every command that lands code names `git.md`, and no
  template anywhere carries the phrase "in the same commit as the work" again.

### 4.5 `git.md` answers three more — where work lands, and whether it is pushed

§4.4 ends by saying branching and pushing are out of scope, "in the file itself." That was a real boundary,
not an oversight, and it held for exactly as long as one working tree was the only shape on offer. Three
workflows were wanted: straight to `main`, a branch per feature, and a worktree per feature with several in
flight at once.

**The answers are orthogonal, not an enum.** The obvious shape is one three-valued mode. It is wrong for
the reason §2.1 gives: branch-without-a-pull-request is real, and so is worktree-without-one, and a
three-valued field cannot represent either. `git.md` grew **two** independent sections — *Where work lands*
(the main tree, a branch per feature, a worktree per feature) and *Push and pull request* — beside the two
it had. `/onboard` still **asks** them as three named shapes, because that is how people describe their own
repository; it writes two answers. The named shapes are a question, not a data structure.

**"In flight" is not a status.** The first instinct for a repository with four worktrees is a state file in
the main checkout tracking what each one is doing, gitignored because it is momentary. That is a cache, and
§2.4 exists to refuse it. Every fact it would hold already has a live home: which features are in flight is
`git worktree list`, which phase each is on is that tree's own ledger, whether an agent is alive in one is
whatever `executors.md` names, and whether it is PR'd is the forge. **The failure mode is what settles it**
— a state file is most wrong in the one case you reach for it, a crashed run or a tree removed by hand,
because the thing it mirrors moved and it did not. A worktree's *existence* is the claim, and removing the
tree withdraws it. This is §2.1's move again, one level up: *"planned" is the observation that a document
exists in `plans/`*, and *"in flight" is the observation that a worktree exists.*

**The `active` marker did not need changing, and that is why it survived.** The proposal was to drop it in
worktree mode, since the worktree already answers what it answers. But it is already scoped to the tree that
sets it: `/feature-implement` writes it in the worktree, on the branch, and `/feature-close` deletes the
entry before that branch merges — so the default branch never observes `active` at all. It is ephemeral,
self-cleaning, and invisible to the merge, which is every property the removal was chasing. Dropping it
would have bought the same behaviour at the cost of a mode-dependent data model and an `if worktree` branch
in every skill that touches a marker. **The one-active-feature rule became "per working tree"** and git
enforces it for free — the same branch cannot be checked out twice.

**One file conflicts on every merge, and it is not the one you would guess.** Parallel feature branches all
edit `context/`. `roadmap.md` merges cleanly (each branch deletes a different entry); plans and `archive/`
are one branch each; **`findings.md` nets to zero**, because findings are raised and swept inside a single
branch's life and `/feature-close` is blocked while a `P0`/`P1` is open. Only `history.md` conflicts every
time, being pure append — `merge=union` in `.gitattributes` settles it permanently. **The same line on
`findings.md` would be a bug**: closed findings *leave* that file, and union merge resurrects the lines one
side deleted. `/onboard` offers the first and is told to refuse the second.

**A plan lands before its worktree exists.** A worktree carries only what its source ref already holds, and
a roadmap entry whose **Doc** points at a plan that is not there is `check`'s `deadLink`. So the plan is
committed to the default branch — and pushed, where the configured source ref is a remote one — *before* the
tree is created. It is the one ordering in this workflow where a document lands first and separately, rather
than with the work it describes, and `/feature-plan` §7 says so explicitly for that reason.

**Merging stayed out**, and is now the only thing that is. Nothing here merges a pull request, deletes a
branch, or removes a worktree. §4.4's lesson applies unchanged — a file about git is exactly where someone
will assume it does — so the boundary is written down rather than left to be inferred.

**The upgrade path needed no code.** Two new `##` sections in a project-owned stub is precisely what §6.2's
**Next** block was built to report, and it did, unprompted: `update` against a 0.6.0 install names both
sections and points at `/onboard`. §2.9 was that machinery's first consumer and this is its second, which is
the first evidence it generalises rather than serving the case it was written for.

**A test caught a restatement, again.** The first fix to the `AGENTS.md` block spelled out the push and
merge policy in four lines. `stays small — everything but the commands is a pointer` failed with *"the block
is not a second copy of the rules"* — correctly: that policy is `git.md`'s, and the block's job is to point
at it. The 40-line ceiling is doing §7.1's work without anybody having to remember §7.1.

### 4.6 Three answers per executor — and the subagent nobody pointed at

`executors.md` shipped with two answers each: in-host or offloaded for the coder, self-review or offloaded
for the reviewer. Both defaults are the weak one, and under Claude Code the reviewer default was weak for
no reason — **`reviewer.agent.md` was already on disk and nothing named it.**

Three roles, three different wirings, and only one of them complete:

| Role | Ships a subagent | Skill has the *"if your runtime provides one"* hook | Routed through `executors.md` |
|---|---|---|---|
| planner | yes | yes, `/feature-plan` | no |
| reviewer | yes | **no** | yes, default = self-review |
| coder | **no** | **no** | yes, default = in-host |

The planner worked because §3.2's runtime-neutral phrasing is *how* a host-specific asset gets reached
without being named: "delegate to a planner subagent if your runtime provides one" lets a host that has the
mechanism find it and a host that does not fall through. The reviewer shipped the asset and never wrote the
sentence, so the gate that matters most ran at its weakest setting by default while a purpose-built
independent reader sat three directories away.

- **The fix is the sentence, not another file.** Both dispatch sites gained the hook and both
  `executors.md` sections gained a third answer. `/onboard` Step 3 now looks for an agent this installation
  already put on disk, because that is exactly where a review contract would have been written.
- **A `coder.agent.md` was the obvious symmetric fix and is the wrong one.** `roles/coder.md` is already
  the coder's prompt; a host-specific copy needs §5.1's one-body-two-destinations machinery to stay honest,
  and it buys a discovery surface where "coder" is the single hardest description to keep from firing on
  *"write this for me"* — §3.10's problem with a much larger blast radius, and `disable-model-invocation`
  is a skill key with no agent equivalent. The hook reaches any host's generic subagent mechanism and costs
  no file, which also means Codex gets both answers, where an `.claude/agents/` file would have served one
  host.
- **Isolation does not move the gates.** They run in the caller, on the diff. An executor reporting its own
  success is what §3.5 step 11 already refuses to accept — the subagent answer changes where the work
  happens and nothing about what counts as evidence.
- **One prompt, three dispatches.** `roles/coder.md` is the system prompt whether the coder is in-host,
  a subagent, or an external CLI. That it was already runtime-neutral — §7.1 stripped the commands out of
  it — is what made a third answer free.
- **Existing installs are not told.** No `##` heading changed, so §6.2's **Next** block reports nothing:
  it detects a missing *section*, not changed guidance inside one. The third answer arrives when `/onboard`
  is re-run, which is already the standing advice after an update. A stub whose *content* a new version
  expects more of is a gap that machinery cannot see, and widening it to notice would mean recording stub
  state in the manifest — the one thing §6.2 refused.

---

## 5. Agent-agnostic distribution

### 5.1 Two skill trees, one body

**Both trees ship.** §3.2 is what made the second one cheap to reach: it arrived as a `dest` in
`managedFiles` with no transform, and not one skill body was touched.

Per §1.2 and the Claude Code equivalent, the two hosts read disjoint directories. So the same SKILL.md
body is written to both, differing only in the `disable-model-invocation` frontmatter line (§3.1).

`.agents/` is preferred over `.codex/` — both work, but `.agents/` is tool-neutral and matches the
`AGENTS.md` convention that Copilot and OpenCode also follow.

Duplication is the cost. It is contained because one canonical source lives in the package, both trees
are written at install, both are hashed in the manifest, and neither is ever hand-edited — so drift is
structurally impossible rather than merely discouraged. Editing one copy is a conflict on the next
`update`, which is the same signal as editing any other managed file, reported the same way.

An install predating a tree gains it: `update` reconciles adapters to what the running version ships
rather than to what the manifest recorded, and reports the change on its own line. The reverse holds too
— a tree this tool stops shipping falls through the no-longer-shipped branch and is removed. A skill
directory the tool did **not** write is a conflict, never an adoption: it is not in the manifest, and
that is exactly the case the manifest exists to catch.

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

#### What `update` cannot do, said out loud

The manifest is a reachability boundary, and the cost of that boundary is that a new version's tool-owned
files can expect something of a project-owned one. §2.9 shipped a `## Documentation` section in the
`stack.md` stub and four commands that read it; an existing install takes the commands on `update` and
keeps its own `stack.md`, which has no such section. The same shape as `git.md` (§4.4): an install made
before that file shipped never gets one, because a pass that writes missing stubs is a pass that can
overwrite a file someone deleted on purpose.

Nothing said so. `install` ends with "run `/onboard`"; `update` ended with *"yours, untouched — a
project-owned file is not in the manifest, so no code path here reaches it"*, which reads as reassurance
at the one moment there is something to do.

`update` now compares the `##` headings of each shipped stub against the installed file and reports what is
missing, under a **Next** heading, last:

```
Next
  ! context/stack.md has no "Documentation" section — this version's stub has one
  ! context/git.md is missing — a stub is project-owned, so update cannot write one
  Run /onboard in your agent. ...
```

- **It reports and writes nothing**, which keeps §4.1's boundary exactly where it was. The alternative —
  a stub-restore pass — is the one recorded in `PLAN.md` as reversible, and it stays rejected: writing a
  stub whose destination is missing cannot distinguish "never had one" from "deleted on purpose".
- **A note, never an error.** The exit code stays the conflict count's. Failing an update over the shape of
  a file the tool may not touch would be reporting someone else's business as its own breakage — the same
  call as the closed-finding `note` in `check` (§6.4).
- **Structural, not versioned.** It compares against what this version's stubs ship, so a future stub
  section reports itself with no changelog to maintain and no per-version list to forget to update.
- **Only the four stubs `/onboard` fills** — `stack.md`, `verify.md`, `executors.md`, `git.md`. The other
  three are written by the workflow as it runs, so a question about their shape belongs to `check`, which
  already reports a missing `roadmap.md`. Caught by demonstrating the feature rather than by reasoning
  about it: the first build examined all seven and would have answered a mangled `findings.md` with "run
  `/onboard`", a command that never opens that file. The two validators now split on who writes the file —
  `update` covers what a person supplies, `check` covers what the loop produces.
- **Rejected: recording stub state in the manifest** to tell "this version added it" from "you deleted
  it". It would sharpen one line of output at the cost of the property that makes the boundary legible —
  *a project-owned file is not in the manifest* — and the fix is `/onboard` either way. A user who removed
  a section on purpose sees one line saying so, which is true.
- **Headings are compared without backticks or case**, and headings inside fences or HTML comments are not
  headings. The stubs sketch a layout in a fenced block and carry their guidance in comments, so a naive
  scan reports gaps nobody can close.
- `/onboard` now says it is what an update's **Next** block is asking for, and that adding a named section
  means adding the heading — not rewriting the prose someone already wrote around it.

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

**Moved to [`PLAN.md`](PLAN.md)**, which is the live list. Keeping a second copy here is exactly the
drift this design exists to prevent. For anything that cites this section by number: §8.1 (reviewer
dispatch under Codex) and §8.4 (`agy` untested against §1.1) are now under *v2* there; §8.2 (publish) and
§8.3 (licensing) have entries of their own.

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

9. The second adapter tree and the executor questions v1 deferred (§0).

**Steps 1–7 and 9 shipped.** Step 8 is the first item in [`PLAN.md`](PLAN.md): the loop has been run by
hand, following each SKILL.md literally, but not yet under a live agent — and that verification now has
two trees to cover, not one.

---

## 10. The tracking substrate — an issue tracker as the shared home

**This section is at the end because §-numbers are cited from source comments and from every skill, and
§3.7 refuses to rewrite them.** Read it after §2 and §4.5; it changes where the things those sections
describe are *stored*, and almost nothing about what they mean.

### 10.1 The hole: `git worktree list` is a single-machine answer

§4.5 settled "what is in flight" without a state file: *"which features are in flight is `git worktree
list`, and 'in flight' is the observation that a worktree exists."* That is correct, and it is correct only
inside one clone. Worktrees share a `.git`, which is what lets git enforce one-checkout-per-branch and what
made the one-active-feature rule free. **That enforcement ends at the clone boundary.** Two agents in two
containers, two clones, both start `payment-retry`, and nothing anywhere notices.

The `active` marker cannot fill the gap, and §4.5 is the reason why: it is set inside the worktree and
never reaches the default branch, which the section correctly presents as a virtue — ephemeral,
self-cleaning, invisible to the merge. The consequence is that **no shared location in the design says a
feature is claimed.** For one agent that is not a defect; it is the point. For several it is the missing
primitive, and nothing already on disk can supply it.

An issue tracker is not wanted here for visibility. It is wanted because it is the only thing in the
picture that sits **outside every worktree and is writable by all of them.**

### 10.2 Why the plan document cannot stay in the tree

The first draft of this decision kept `plans/<NAME>-PLAN.md` as a tracked file and mirrored the phases into
sub-issues. Every argument for that is a **single-writer** argument — it diffs, it reviews inside the pull
request, `git mv` archives it with its history — and each one inverts under several worktrees:

- A plan file lives on a branch. Another agent cannot read it without fetching that branch.
- The sharp case is not visibility but **correctness**: when a phase reveals the plan was wrong and the
  agent amends it, the amendment is branch-local. There is now no single plan, and no way to notice.
- §4.5's *"a plan lands before its worktree exists"* — the plan committed and pushed to the default branch
  before the tree is created, "the one ordering in this workflow where a document lands first and
  separately" — was already the design straining against its substrate. It exists only because a tracked
  file cannot be seen by a tree that does not have it yet. Move the plan out of the tree and the exception
  disappears rather than being worked around.

### 10.3 What collapses

| Today | Under the tracker answer |
|---|---|
| a `roadmap.md` entry | the issue |
| `drafts/<NAME>.md` | the issue body, before it has phases |
| `plans/<NAME>-PLAN.md` | the issue body, after — **same id**, edited in place |
| a ledger row | a sub-issue, one per phase |
| the `active` marker | the assignee |
| `archive/` + a `history.md` row | the closed issue |

Six things become two. **The four files that conflict on parallel branches stop existing**, and with
`history.md` goes the `merge=union` line §4.5 prescribes for it — a workaround for exactly the contention
this removes. `/feature-close`'s reference sweep goes too: no path moves, so nothing links to a moved path.

Keeping the issue id across the draft → plan transition is strictly better than the `git mv` it replaces
(§2.3). A `git mv` carries the file and discards the discussion, the original wording, and everyone
subscribed; editing the body in place keeps all three.

**`drafts/` does not map to anything — it stops existing.** §2.1's table has three pre-plan states:
`pending` with no document, `pending` with a `drafts/` document, and `pending` with a plan. The first two
collapse here, because the issue body always exists and *an idea* versus *an idea with pasted material* is
only a question of how much body there is. Nothing is lost: that same table already reads both as **an
idea**, and no command has ever branched on which one it was.

**One rule dissolves rather than porting.** `roadmap.md` opens with *"High-level by design: depth belongs
in the plan document, not here"* — a constraint that existed because **one file held every entry**, so
depth in it made the file unreadable. That is also why the draft and the plan had to be separate documents
at all. An issue list has no such pressure: the list view is titles, and depth sits inside each issue
behind a click. The rule was a property of the file, not of the tier, which is what makes §10.3's
same-id transition possible in the first place.

### 10.4 The primitive map — two labels, and everything else observed

§2.1's test is the one that decides each primitive: **does it let a fact be observed, or does it require a
stored copy someone must maintain?** *"Planned" is the observation that a document exists in `plans/`* is
the same move, one substrate down.

| Fact | Primitive | |
|---|---|---|
| idea, or has a plan | **whether it has sub-issues** | observed |
| being worked | **assignee** | observed |
| phase `done` | **sub-issue closed** | observed |
| phase `in progress` | **sub-issue assigned** | observed |
| retired, and its outcome | **closed, with GitHub's state reason** | observed |
| phase `blocked` | `workflow:blocked` | **stored → label** |
| whether this issue is the workflow's at all | `workflow:feature` | **stored → label** |

**Two labels, and both earn it by having no structural home.** `blocked` is needed because phase selection
takes *the lowest-numbered phase that is not `done` and whose `Depends on` are all `done`* — open/closed
cannot express *stuck*, so without a marker an agent picks a blocked phase up, fails, and re-blocks it. The
ownership label is needed because a repository's tracker also holds bug reports, questions and Dependabot,
and nothing structurally separates "a feature this workflow manages" from "someone filed a bug."

Every other label anyone will reach for — `draft`, `planned`, `in-progress`, `done` — is a second place for
a fact that already has one, and `draft` is the sharpest: **an issue with sub-issues is a plan.** GitHub's
*issue types* would serve the ownership label natively but are org-scoped, which is dead for a personal
repository and would make the workflow depend on org configuration. A label is portable.

**The namespace is load-bearing, and `feature` is §2.6's word rather than a kind.** *"If you would want a
`history.md` row for it, it is a feature"* — a bug large enough for that row is a feature in the only
vocabulary this workflow has. `workflow:feature` says *a feature in the workflow's sense*, which is the
claim being made; a bare `feature` would both assert a taxonomy the design does not hold and collide with
the enhancement label most repositories already carry. **The stub has to say this outright**, because
someone will otherwise see the label on a bug report and read it as a miscategorisation.

**The workflow does not distinguish features from bugs, and must not start.** §2.6 already partitions the
work — *does it deserve a record* — and a kind-taxonomy laid across it produces a 2×2 the loop only ever
reads one axis of, which is §2.2's warning about two vocabularies in a new place. The repository's tracker
already has that taxonomy, usually better tuned than anything a stub could ship, and under this substrate
the workflow **inherits it for nothing**: an issue keeps every label it already had, and one orthogonal bit
is added on top.

**The two close reasons match `/feature-close`'s two modes exactly** — shipped is *closed as completed*,
`--dropped` is *closed as not planned*. Native, queryable, no label, and it removes the Outcome column from
what `history.md` used to carry. The *Why* becomes the closing comment.

**The assignee is the claim and the status in one write.** In the file design those are two facts that can
disagree; here there is nothing to disagree with. That is the strongest single argument for this substrate
and it is not a visibility argument at all.

**No issue states its own status, and the body is where someone will try.** §2.1 bans a `**Status:**`
header anywhere under `context/`, and that rule has to survive the move intact — an issue body looks like a
natural home for a line reading *in progress*, and one written there is a second answer that goes stale
against the assignee within a phase. **The body holds content and never a claim about where the work
stands**: the problem before planning, the plan after. Everything else is read off the structure.

#### Draft or plan — the test, and the transition that has to hold it

**An issue with sub-issues is a plan.** That is §2.1's move one substrate down — *"planned" is the
observation that a document exists in `plans/`* becomes *"planned" is the observation that phases exist* —
and nothing stores it, so nothing can drift. `workflow:planned` is refused for the usual reason: a label
shadowing an observable fact, wrong the first time someone adds phases without relabelling.

**It is a stronger test than the directory it replaces.** §2.3 claims a misfiled document "breaks a link
loudly rather than lying quietly", but nothing actually cross-checks a file against its directory — a draft
moved into `plans/` looks exactly like a plan until someone opens it. Here both failure modes are
checkable against the body, and both resolve to §2.4's existing instruction to stop and say so:

| Observed | Means |
|---|---|
| body names phases, no sub-issues | an interrupted `/feature-plan` |
| sub-issues exist, body names no phases | someone attached one by hand |

**The window is real, and the fix is to split the ledger rather than move it.** Phases come from the plan,
so the body is written before the sub-issues can exist, and a run that dies between them leaves a complete
plan that reads as a draft forever.

**So the body keeps the phase list and the sub-issues keep the status.** The ledger does not move wholesale:
its `#`, `Phase`, `Depends on` and `Files:` stay in the body — the authoritative answer to *which phases
exist, in what order, depending on what* — and only the Status column becomes the sub-issues, which answer
*where each one stands*. Those are different facts, so this is §2.1 rather than a violation of it, and the
Status column is **dropped** from the body precisely so it cannot become a second home.

The split is what turns a careful ordering into a checkable one. The body is the expected set and the
sub-issues are what exists, so every run compares **count and names** before writing:

| Body says | Sub-issues | Verdict |
|---|---|---|
| 5 phases | none | a draft |
| 5 phases | 5, names match | a finished plan |
| 5 phases | 3, all listed | an interrupted run — create the missing two |
| 5 phases | one naming no listed phase | stop; the two disagree |

**The first draft of this section had the ledger becoming sub-issues outright**, which loses the
authoritative list and leaves *"is this a draft or a half-written plan"* answerable only by judgement. Rows
three and four are the whole point: the interrupted state has to be able to say what it is, which is §2.8's
argument at the tier boundary instead of inside the ledger.

#### Adoption — how an issue the workflow did not create gets in

That inheritance is only real if an existing issue can enter the loop, and under the file substrate it
could not: a bug report and a `roadmap.md` entry are unrelated objects, and the only path in is retyping
one as the other — the duplication this whole design refuses. Here they are the same object, so
**`/roadmap` has a second mode: apply `workflow:feature` to an issue that already exists.** Nothing is
copied, the reporter stays subscribed, and the discussion that produced it stays attached to the work.

- **§2.6 still decides, unchanged.** An issue too small for a `history.md` row is not adopted at all — it
  is `/orchestrate` work, closed by `Closes #N` on the commit, and it never enters the loop. The workflow
  staying out of the ordinary tracker flow is the correct behaviour, not a gap in it.
- **A promoted finding (§10.5) arrives by this same door**, and loses its `P0`–`P3` on the way. That
  severity meant *does this block the phase*; outside the branch that raised it, it blocks nothing.


### 10.5 What stays in the working tree, and why it is not arbitrary

`verify.md`, `executors.md`, `git.md`, `stack.md` and `standards/` do not move. **Each is read at gate time
and must match the commit being gated** — a `verify.md` fetched from a tracker could describe a build this
branch does not have, which is the one way to make Gate 1 lie.

`findings.md` does not move either, and the reason is different: a finding is **branch-scoped by
construction** and nets to zero within one branch's life (§4.5), so it is never the thing two agents
contend over. The escape hatch is written down rather than inferred — **a finding that outlives its branch
is promoted to its own issue**, which is also the only way a cross-cutting defect becomes visible to agents
working elsewhere.

### 10.6 Claiming, and the lock with no TTL

Two things are genuinely new here. Neither exists in the tree-based design because with one agent neither
is a problem.

**Claiming is optimistic, because assignment is not compare-and-swap.** GitHub assignment is
last-write-wins, so two agents can both read *unassigned* and both assign. The rule: **assign, re-read,
confirm you are the sole assignee, and back off if you are not.** Cheap, and it closes the window that
actually matters.

**A heartbeat, because an assignee is a lock with no expiry.** An agent that dies holding a claim leaves
the issue assigned forever and nothing reclaims it. This is §2.8's argument moved up a level: the opening
ledger write exists because *"the half-finished tree it leaves behind cannot say it itself"* — and under
several agents that evidence must also be readable **from a machine that is not the one that died.** So the
agent comments on the issue at each phase boundary, naming the phase and the commit. That makes staleness
*observable* — "phase 2 in progress, last activity six hours ago" — without a state file, which §2.4 would
refuse anyway.

**Both live in the skills, not in `tracking.md` (§10.8).** A project chooses its tracker and its labels; it
does not choose a different backoff rule or a different write order. Putting either in a project-owned file
would freeze it at install time, reachable only by re-running `/onboard` — and a defect in a claim protocol
is exactly the kind of thing `update` has to be able to repair.

**The dead claim is not solved, and that is deliberate.** A TTL, a supervisor, or a lease would each be a
mechanism this design has no other use for. The heartbeat makes the condition visible and leaves the
reclaim to a person or to whatever `executors.md` names. Recording that it is unsolved is the point:
§4.4's lesson is that an unstated premise gets answered by whoever reads it next.

### 10.7 Rejected — Projects, milestones, and why cost decided nothing

Availability was checked rather than assumed, and it settles nothing: issues, labels, milestones and
Projects are on every plan including Free, private repositories included; sub-issues are GA at 100 per
parent and eight levels of nesting, with no plan restriction. **The decisions below are design decisions,
not budget ones.**

**Projects are refused**, on four grounds:

- A `Status` field is **stored state duplicating the assignee and open/closed** — the first real drift risk
  anyone would introduce here, and precisely what §2.1 exists to refuse.
- **Membership is a second thing to maintain.** An issue exists whether or not it is on a board, so the
  workflow would have to remember to add it, and *"is it on the board"* becomes a failure mode with no
  structural answer.
- **GraphQL.** Everything else here is reachable from `gh issue`, sub-issues included — `gh issue create
  --parent`, `gh issue edit --add-sub-issue`. Projects v2 needs node ids for the project, the field *and*
  the option, which is per-installation machinery and therefore `executors.md`'s business (§4.3), not a
  skill's.
- It buys a **view, not a fact.** Everything a board shows is derivable from the issues, and a user can
  point a Project at the repository themselves, with auto-add, without the workflow knowing.

**Milestones are left alone**, and not merely as unneeded. The three-tier model has no tier one maps to —
a feature is an issue, a phase is a sub-issue, and there is no release tier. The operative reason is that
**an issue belongs to at most one milestone**: a workflow that claims that slot spends the user's only one
on something it does not need. Left alone, milestones stay available for release planning, assigned by
asking for it in the moment — the tracker's version of §4.1's *anything else you add is yours forever.*

**One convention worth fixing now:** the phase number goes in the sub-issue title — `[2] Wire the retry
queue`. Sub-issue order is preserved in the parent, but a title that sorts survives someone dragging them.

### 10.8 It ships as an answer, not a mode

`context/tracking.md` is the fifth file in the shape of `verify.md`, `executors.md` and `git.md`:
hand-written prose, project-owned, absent from the manifest, read fresh. It ships with **in the working
tree** as the first answer, which is what every existing install already does, so §4.5's rule holds
unchanged — *if the file is missing, the answer is the first one in every section.*

**`/onboard` asks it, and states the precondition in the question**: the tracker answer requires the
project to be a git repository with a GitHub remote. Where it is not, the question says so and the answer
is not offered — the same shape as Step 2's *"offer this only where the host has such a mechanism."*

**It holds the answer and its parameters — never the protocol.** Which substrate, which tracker, which
labels, which remote: those are this project's choices and belong in a project-owned file. The claim
protocol (§10.6), the heartbeat, and `/feature-plan`'s body-before-sub-issues ordering (§10.4) are **not**
choices — they are how the workflow works, and a project that picked its own would simply be wrong. They
stay in the skills, which are tool-owned, so `update` can repair a defect in one. The ownership boundary
§4.1 draws is the whole argument: a project-owned file is unreachable by the updater **by construction**,
so anything written there is frozen until someone re-runs `/onboard`. That is right for an answer and wrong
for a mechanism.

It also keeps the file the size of `git.md` rather than twice it, and it is what makes the primitive map
(§10.4) the *only* GitHub-shaped thing in the installation.

**Under the tracker answer, five installed stubs have nothing to write to them**, and `install` cannot know
— it writes all seven stubs and all three directories before the tracking question is ever asked. So
`/onboard` names them and **offers to remove them, only where they are empty**, in Step 8's existing shape:
shown as a diff, applied on confirmation, and nothing removed that cannot be pointed at.

| Removed if empty | Stays under both answers |
|---|---|
| `roadmap.md`, `history.md` | `findings.md` (§10.5) |
| `drafts/`, `plans/`, `archive/` | `verify.md`, `executors.md`, `git.md`, `stack.md`, `standards/` |

**Empty is the discriminator, and it is observed rather than stored** — a non-empty `history.md` is the
frozen prior-era record below, and is never offered. The parser that answers it already exists: `check`
reads these files for shape, and three tests already assert exactly this property of the shipped stubs —
*the roadmap stub contains no parseable entry*, *the history stub has a table and no rows*.

**This is the first genuine dependency between two `git.md` answers, and it is recorded rather than
discovered.** §4.5 insisted the answers are orthogonal, not an enum. The tracker answer breaks that: the
atomicity rule — *the ledger row lands with the work* — is preserved by putting `Closes #N` in the commit
or pull request, so the forge performs the closing write as part of the change. That only fires on the
default branch, so **the tracker answer presupposes the push-and-pull-request answer.** Defensible, since
nobody wants shared tracking and a repository they never push, but it is a real weakening of a property
§4.5 built on purpose, and `/onboard` refuses the pair rather than writing two answers that cannot both be
true.

**`/onboard` sets the answer; it does not migrate the work.** Switching substrates is a data migration —
every roadmap entry becomes an issue, every plan an issue with a sub-issue per phase — and `/onboard` is a
configuration command whose every step asks something and writes it into a stub, reviewable as a diff
before anything lands. Running a migration off the back of question five is a **side-effect**, which is the
one thing the tier model refuses everywhere else: *every boundary is crossed by an explicit command, never
as a side-effect of running something else.*

The concrete failure behind the principle is that a file write lands or does not, while twenty issue
creations are twenty non-atomic remote writes. Fail at twelve and the repository is in **neither**
substrate. Idempotency is reachable by observation rather than by a state file — *does a `workflow:feature`
issue with this name already exist* — so §2.4 is not the obstacle; the obstacle is that it is real work and
it is not this command's.

- **Refuse to switch while anything is in flight**, in `/feature-close`'s refuse-first shape: name the
  active feature and every entry holding a plan, and stop. The alternative is an agent in a worktree
  reading a substrate that moved underneath it mid-phase — §2.4's read-fresh model assumes the answer does
  not move, and that is the one moment it would.
- **From a clean state the switch is free**, because there is nothing to migrate. That is also the
  realistic moment for it: on adoption, or between features. A pending backlog with no plans is cheap to
  re-create, one `/roadmap` per entry.
- **A real backlog migration is its own command if it is ever wanted.** Nothing here needs it to exist.

**`history.md` and `archive/` are never converted, in either direction.** Fabricating closed issues for
features shipped months ago produces wrong dates, empty discussion threads, and an audit trail that looks
real and is not. The files **stay, frozen, as the record of the era before the switch** — §4.1 already
guarantees it, since anything under `context/` is project-owned forever, so it costs nothing. New closures
become closed issues; the old ones stay where they happened. That is not two homes for one fact (§2.1), it
is two eras, each honest about what it covers.

**The switch is not symmetric.** Tracker → files loses discussion, reporters and cross-links that no
markdown file can hold; files → tracker loses nothing. Worth stating, because the reverse direction reads
like an undo and is not one.

**A second tracker is an answer, not a rewrite.** The rows in §10.4 are facts, and only the right-hand
column is GitHub-shaped. Jira, Linear and ClickUp each answer the same seven rows with their own
primitives — a parent/child link, an assignee, a resolution — so adding one is a section in this stub and a
dispatch line in `executors.md`, not a mode in eight skills. Nothing in the loop is to name GitHub
directly: the skills describe the *fact* they need, and `tracking.md` says how this project answers it.
That is §3.2's runtime neutrality applied to the forge, and it is what keeps the second integration cheap.
