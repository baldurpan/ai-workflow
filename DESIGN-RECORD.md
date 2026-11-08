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
                  /feature-implement [--all]        activates, then runs phases: plan → code → verify → review
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
description is a hint; the flag is a switch. Use both. **§30 later takes the flag off `/roadmap`**,
the one command an agent may run; every other still carries it.

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
/feature-implement --all      # keep going, phase after phase, until the stop list says otherwise
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
4. **Check `findings.md`.** An open P0/P1 tied to this phase *is* the work. **(§12: the file is gone —
   the step reads the phase's own row, and `blocked` is what it looks for.)**
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
12. **`--all` goes back to step 3 instead of stopping**, and keeps going until the stop list below
    ends it.

**`--all` is legitimate because phase to phase is not a tier boundary.** This command already owns
"activation, and the phases within a plan", so a loop over its own steps crosses nothing §2 protects —
and it stops dead at the last `done` phase and names `/feature-close`, which is still the user's
explicit command. Step 2 is not re-run: the checkpoint, the branch or worktree and the marker are once
per feature, which is what makes this a loop over steps 3–11 rather than a second invocation.

What the flag actually removes is the pause where a user reads a phase's report before the next phase
builds on it. That pause was doing real work, so it is replaced by a written stop list rather than by
nothing: a phase that ended `blocked` or part-landed, a gate at its two-loop cap, an open P0/P1 tied to
the phase, step 5's disagreement, and nothing runnable. A `PASS WITH NOTES` continues, and so does
a `FAIL` that passes on its loopback — only the cap stops.

**Two answers are stated before the first phase rather than assumed.** Which reviewer `executors.md`
gives, because the shipped answer is the host reading its own diff and four unattended phases of that
compound in a way one phase does not; and who commits, because under `git.md`'s shipped *the user
commits* the flag **runs one phase and declines the continuation, naming that answer as the reason.**
*One commit per phase* is that file's answer about the shape the tree is left in, and a tree carrying
four phases at once cannot be cut back into four commits. This is `--activate`'s behaviour when the
slot is held (§3.4): do the valuable part, skip the flagged part, say which answer stopped it.

**The flag is cheap because the survivability machinery already exists.** A run that dies four phases
deep is the same state as a run that dies one phase deep — the opening ledger row (step 6) says which
phase was underway, and under the tracker answer the per-boundary comment says it from outside the
process that died. Without those, `--all` would have needed them.

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
`findings.md` must not grow for the life of the project. **Superseded by §12 — the file is deleted.** The
sweep was not the defect; the file was. A blocking defect lives in the phase's ledger row, and this step no
longer exists.

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
and `check` reports any closed finding still in the file. **Superseded by §12 — the file is deleted.** A
capped `/orchestrate` gate now hands the change back rather than recording it.

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

**A design-guidance skill is reached for on the invent side only, and it is not named.** The borrow/invent
split is what decides when one applies. Anthropic's `frontend-design` plugin skill — read on 2026-09-22 at
commit `c447c3207a4`, not from documentation — opens by asking for "deliberate, opinionated choices about
palette, typography, and layout" specific to the brief, and lists warm-cream-and-serif and the SaaS-card kit
among the tells to design away from. That is right for a blank page and wrong for a repository whose
stylesheet is already the answer: on the borrow side it would have an agent improve on the tokens it was
sent to copy, which is why the line says the project's real values win. On the invent side the command
previously said nothing beyond "mark it," and that is the gap the guidance fills. **Rejected: naming the
plugin, and having the skill look for it on disk.** §3.2 forbids the first — the body ships verbatim to a
host with no plugins — and the second reimplements a discovery the host already performs, against a path
that carries the plugin's commit sha and a marketplace name (`claude-plugins-official`) that is not the
repository it is distributed from. A capability named the way §3.2 names subagents costs nothing when it
is absent.

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
  findings.md            project   STUB — deleted in §12; an install no longer writes one
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
are one branch each; **`findings.md` nets to zero** (§12: it no longer exists), because findings are raised and swept inside a single
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

### 4.7 The answers were not permission — and the worktree command had nowhere to live

§4.4 and §4.5 settled *what the workflow's commands do about git*. The field report behind this section is
a different failure and the four answers do not touch it: **agents creating worktrees and branching without
being asked, and committing.** Not while closing out a phase — while doing anything.

**The scope was implicit, and an implicit scope reads as a grant.** Every answer in `git.md` is written from
inside a command: *the agent commits* means `/feature-implement` closes a phase it just ran; *a worktree per
feature* means a **planned feature's** first phase gets a tree. Nothing said so. A file headed "who commits"
that answers "the agent" reads, to a reader looking for permission, as *the agent may commit* — and §4.4's
own lesson applies to itself here. An unstated premise is not neutral, and *these answers cover this command
at this point, and nothing else* was exactly as unstated as *who commits* had been.

**Staging was absent from every list for four versions.** "Nothing commits, branches or pushes", "leave the
change in the working tree" — all satisfiable by an agent that runs `git add -A` first. `git add` is the
first half of a commit and it edits what the user's own `git commit` would capture, so the handover is now
specified as *unstaged*, in the stub, in `workflow.md`, and in both commands that hand a tree over.

**Permission is not inferred, and the sharpest case is self-granted.** The rule enumerates what does not
authorise: an approved plan, "ship it", a production incident, and — the one worth naming explicitly — a
user choosing between approaches whose option text mentioned committing. That last one is the agent writing
the consent it then reads back. A user picking an option for its other merits has not agreed to the verbs
buried in its description, and an agent that wrote those verbs is not entitled to treat them as a request.

**Three operations are never standing policy**, whatever the four answers say: force-pushing, pushing to the
default branch, and rewriting published history. They join `git reset --hard`, `git clean` and stashing
someone else's changes, which are not pushes at all but share the property that matters — uncommitted work
has no second copy. `/feature-close` is the only command that pushes, and it now stops rather than force-push
a branch that will not fast-forward.

**Where it lives is decided by which files `update` can reach.** The rule is invariant — it is not a
per-project answer, so it does not belong in a stub the way *who commits* does. It went into `workflow.md`
and the `AGENTS.md` block, both tool-owned, so an existing install gets it on `update` with no `/onboard`.
`git.md` keeps only the half that is genuinely about its own answers — **What no answer here authorises** —
as a new `##` heading, because a heading is what §6.2's gap report can see and the same words inside an
existing section would reach nobody. Verified against a published 0.17.0 install: `update --dry-run` names
both new sections unprompted and points at `/onboard`. That is the third consumer of that machinery.

**`/onboard` writes that section instead of asking about it.** Every other thing Step 4 touches is a
question, and making this one a question would let it be negotiated away in exactly the sessions that most
need it. It is written as shipped and *reported* in a line — because a user who has just chosen *the agent
commits* has every reason to think they authorised more than they did, and that is the moment to say
otherwise.

#### The worktree command had no home, which is why one got invented

`git.md` said how a worktree is created "is `executors.md`'s business." `/onboard` Step 4 said to "collect
the invocation and record it there." **`executors.md` had a Coder section and a Reviewer section and
nothing else.** Two files pointed at a destination that did not exist, so nothing on disk ever named a
worktree command — and an agent told to make a worktree with no command recorded reaches for
`git worktree add`, which is the observed behaviour and is not really the agent's mistake.

So `executors.md` gains **Branch and worktree**, the third thing this project dispatches. It ships **Not
configured — the workflow creates no branch and no worktree**, and that is a real answer rather than a gap:
under the main-working-tree answer it is correct, and everywhere else an empty section means *stop and ask*,
never *improvise*. The refusal is written at the point the temptation occurs — in the stub, and again in
`/feature-implement` step 4, which is the one place a command would reach for it.

**Why a bare `git worktree add` is wrong even though it works.** It produces a directory that is a worktree
and is missing everything around it: the gitignored env files a real setup copies, the naming convention,
the predictable parent directory, the editor or agent the tree is handed to. The result looks right and
fails later, which is the worst shape of wrong. That reasoning is portable; the command that embodies it is
not, which is why only the reasoning ships.

**Rejected — naming the CLI in the templates.** `@northguild/worktree` is what these repositories actually
use, and hardcoding `worktree branch <name>` into `git.md` would be the most direct enforcement available.
It was refused for §4.3's reason, which is the reason `executors.md` exists at all: a skill that names a
command bakes one machine's setup into a tool that installs everywhere, and this is the same shape as the
`--add-dir "$HOME/Library/pnpm"` the reference baked into its skill. What ships is the *rule* — a worktree
is made by the recorded command or not at all — and `/onboard` names `@northguild/worktree` as a known
option while accepting anything. A recommendation inside a question is not an execution path: the user
overrides it by answering, and nothing runs it unless they wrote it down. A test enforces the boundary —
the invocation may appear in `/onboard` and nowhere else in `templates/`.

**The one thing this bought beyond the rule.** `worktree list --agents` answers "is an agent session live in
this tree", which §4.5 left as a question `/onboard` asks and `/feature-status` reports when it can. The new
section is where that probe is recorded, so a gap named a version ago now has a slot rather than a mention.

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
the origin and ref so `update` can report when upstream has moved. **(§25: no longer vendored. This package is the source, and the bundled
`.source` is gone.)**

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

**A correction to vendored content belongs upstream, not here.** 0.20.1 fixed ten references to a scope
that no longer exists — `@northguild/gmt` and `@northguild/worktree`, still written as `@burglekitt/*` in
`tooling/dates.md`, `tooling/ci.md` and `docs/SPEC.md`, so every link and import in them was dead. The fix
was correct and was shipped, but it was held only in this repository's copy while upstream kept the old
name. That is the one shape of divergence `.source` cannot express: the marker claims a ref, `update`
compares refs to report when upstream has moved, and neither notices that the tree is *ahead* of the ref it
names. A faithful re-vendor — copy the tree, bump the ref — would then have put the dead scope back into
every install, undoing a released fix with nothing to catch it.

So two things, and the second is the one that holds: the rename was pushed upstream (`c39e58b`), and
`standards.test.ts` asserts no file under `templates/standards/` mentions the old scope. The test is not
redundant now that upstream agrees — it is what makes the agreement checkable, and it fails loudly the next
time a re-vendor reaches for an older tree. **Where a vendored file has to change, change it upstream and
re-vendor; where it has already been changed here, push it up.** A local-only correction is a regression
scheduled for whenever someone does the vendoring correctly.

**And it happened again, one commit later.** Re-vendoring the Date-ban rewrite copied `tooling/biome.md`
over wholesale, reverting the `biome-example.json` rename and leaving three links to a file this tree does
not contain. The rule above was already written down and was not enough, because the failure is mechanical:
a copy cannot know which lines were ours. `links.test.ts` excludes `standards/` as third-party, so nothing
caught it. **The guard is now in `standards.test.ts`**, which resolves every relative link inside the
vendored tree — the cheapest check that distinguishes a clean re-vendor from one that clobbered a local
correction, because a reverted rename almost always leaves a dangling path.

Two other invariants sit beside it: **no file names the renamed-away `@burglekitt` scope**, and **no code
example outside `tooling/dates.md` writes a banned `Date` form**. The second is scoped to fenced code
blocks, not prose, because the prose has to be able to say `z.coerce.date()` in order to forbid it — and
it is the examples that get copied, which is how six documents came to contradict the ban in the first
place. Content guards on a vendored tree are not a violation of its third-party status: they assert what
this repository ships, whatever upstream happens to say this week.

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

The two findings rules this list used to carry went with the file (§12).

**Reads `roadmap.md`, `plans/` and `history.md` only — never `archive/`.** Retired plans
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
- **`findings.md`'s `Tied to:`** accepts a phase *or* `ad-hoc` (§3.8). **(§12: deleted.)**

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

> **Superseded in part by §10.10.** The phase-level primitives below — a sub-issue per phase, and
> `workflow:blocked` — were replaced by the ledger's Status column in the issue body, because the closing
> write they were chosen for cannot fire before the branch merges. The test this section applies, and
> everything it concludes about the feature-level primitives and the ownership label, still holds.

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

`findings.md` does not move either (§12: it is deleted), and the reason is different: a finding is **branch-scoped by
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

> **Superseded in part by §10.11.** Issue types have since reached user-owned repositories, and the
> workflow now sets one and reads none. Projects and milestones are still refused, on the grounds below.

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

### 10.9 The migration — built, because §10.8 predicted the failure and shipped neither guard

§10.8 settled two things and 0.8.0 implemented neither: that `/onboard` **refuses to switch while anything
is in flight**, and that **a real backlog migration is its own command if it is ever wanted**. The second
sentence ended *"nothing here needs it to exist"*, which was true of the design and false of the second
repository the tracker answer met.

**What actually happened.** `/onboard` Step 5 wrote *in an issue tracker* over a repository holding four
roadmap entries — one `active` with a seven-phase plan — three retired features in `archive/`, a draft, and
a `history.md` with rows. It created the two labels and stopped, correctly by its own prose: it removes a
dead path *only where it is empty*, and none of these were. Every command in the workflow then read the
tracker, found nothing, and reported an **empty backlog**. The repository's own `tracking.md` ended up
documenting a *"the rule is by date"* split — features from before the switch read from the tree, features
after it read from the tracker — which is a coherent sentence and a substrate no skill implements.

**The entries were not lost. They were unreachable, which is worse**, because a lost file is a visible
failure and an unreachable one reads as a clean install. This is §2.1's *one home per fact* inverted: not
two homes disagreeing, but one home nothing opens.

**The defect is a class, not an instance:** *a configuration write that strands data is not a configuration
write.* Setting an answer and moving the work are two acts, and a command that performs the first while
silently declining the second ships a broken repository that reports as a working one. It is the same shape
as the 0.8.1 fix one level up — there, a step that asked nothing said nothing; here, a step that moved
nothing said nothing about what it had left behind.

**§10.8's argument for keeping them separate survives intact, and is why the fix is two commands rather
than a bigger Step 5.** Every `/onboard` step asks something and writes it into a stub, reviewable as a
diff before anything lands. Twenty issue creations are twenty non-atomic remote writes, and a remote write
is not a diff anyone can read first. Running that off the back of question five is a **side-effect**, which
§1's tier model refuses everywhere else.

What was missing was not the separation. It was that **nothing named the second half**, so the split became
permanent by default.

#### `/onboard` Step 5 now has three outcomes, and only one writes the answer alone

It reads `roadmap.md`, `drafts/` and `plans/` **before** writing anything, and reports what it found —
always, including *nothing*, on the 0.8.1 principle that a conditional step needs an unconditional output.

| The tree holds | Step 5 does |
|---|---|
| nothing | writes the answer. The switch is free, which is §10.8's *"from a clean state the switch is free"* — now observed rather than assumed |
| entries, drafts or plans | writes the answer, **names `/tracking-migrate` as the required next step**, and records the split in `tracking.md`. Removes nothing |
| a phase `in progress` | **refuses the tracker answer** and leaves the working-tree answer standing |

The refusal is narrower than §10.8's *"anything in flight"*, deliberately. An entry holding a plan is not a
hazard — it is data, and data is what the migration is for. A phase `in progress` is a hazard: an agent may
be inside it in another tree right now, and §2.4's read-fresh model assumes the substrate does not move
underneath a running phase. Refusing over a plan would have made the migration unreachable in exactly the
case it exists for.

**Step 5 never writes the answer and removes the tree files in one run.** Removal is the irreversible half,
and `/onboard` has no way to show a remote write as a diff beforehand.

#### `/tracking-migrate` — per-feature atomicity is what answers §10.8's objection

§10.8's concrete argument against migrating was: *"a file write lands or does not, while twenty issue
creations are twenty non-atomic remote writes. Fail at twelve and the repository is in **neither**
substrate."*

That is true of a bulk migration and false of this one, because the unit is the feature and the removal is
last. Per feature: create the issue, create its sub-issues, set their states, assign if `active`, and
**only then remove that feature's `roadmap.md` entry and its document.** Steps one to four are additive and
a partial issue is visibly partial; step five cannot happen before the thing replacing it exists. Fail at
feature twelve and twelve are migrated, eight are not, and **every one of the twenty is in exactly one
substrate.** A partial run is a valid state rather than a corrupt one.

**Resumption is by observation, not by a state file**, which §10.8 had already noted was reachable — *does
an issue with this name already exist*. It is `/feature-plan`'s body-versus-sub-issues reconciliation
(§10.4) one level up, with the same five verdicts and the same refusal to guess past a disagreement. A
progress file would have been a second home for a fact the tracker already answers (§2.1), and §2.4 forbids
caching workflow state anyway.

**One direction only.** §10.8 already recorded that the switch is not symmetric; the command enforces it.
Tracker → tree would discard a thread, a reporter, subscribers and cross-links that no markdown file holds,
so the honest reverse is to change `tracking.md` back and leave the issues standing as the record of that
era — exactly what `history.md` does in the forward direction.

**`history.md` and `archive/` are never converted**, unchanged from §10.8 and now stated in three files:
the migration, `/onboard`, and the stub. A test asserts all three say why, because this is the rule most
likely to be "helpfully" relaxed by whoever runs the migration next.

#### `check` is the detector, and it is the part that generalises

Nothing in the workflow could notice the split. The entries stayed well-formed, `roadmap.md` stayed where
it was, and every command behaved correctly given what `tracking.md` told it — the state was invisible
precisely because no single file was wrong. `check` now faults it: the tracker answer plus a non-empty
`roadmap.md` is two installed files disagreeing about which substrate holds the backlog.

That is shape, not a workflow question (§2.4). It is the same family as *a plan no entry points at* and
*a dead `Doc` link* — a cross-file structural disagreement — and it obeys §6.4's rule that every message
quotes the rule it enforces and names what resolves it. It is an **error** rather than a note, unlike a
closed finding: a finding legitimately sits in the file during ordinary work, and an unreachable backlog
never legitimately sits anywhere.

**The general form is worth keeping:** every answer this workflow writes into a project-owned file makes
some other file's content reachable or unreachable, and the moment an answer can be set independently of
the data it governs, `check` is the only thing standing between a wrong pair and a silent one.

#### What it cost

One skill, a rewritten Step 5, a paragraph in `workflow.md` and one in the stub, and eight tests. The
`AGENTS.md` block reached its 40th line, which PLAN.md had flagged as needing *"something removed, or the
ceiling argued up"*. Neither, in the end: **the ceiling was wrong, not the block.** A flat line count made
the block's one legitimate growth — a row per command, which is the whole reason it inlines the table —
indistinguishable from the failure it guards, which is the block turning into a second copy of the rules.
It is now a budget on the prose, `lines - SKILL_NAMES.length < 32`, and the prose budget is byte-identical
to what it was at eight commands.

### 10.10 Superseded — the phase ledger comes back into the body, and the sub-issues go

> **Qualified by §10.15.** The reversal below is sound and stands. Two of the costs it states — the lost
> progress view, and *"weaker as an observation"* — were priced at zero against the agent as reader, and
> are not zero against a person scanning the issues list. **The `2 of 5` view was also not where this
> section placed it**: sub-issue progress renders on an issue's own page, in `gh issue view` and in an
> opt-in Projects field, and never on the issues list. So the backlog was never legible there under either
> design, and §10.15 adds the label that makes it so.

§10.4 decided that the ledger's Status column becomes one sub-issue per phase, on the right test:
**does this let a fact be observed, or does it require a stored copy someone must maintain?** Sub-issue
state is observed, a Status column is stored, and on that test the sub-issues win. **The reasoning holds.
The mechanism it chose cannot run**, and finding that out is the risk PLAN.md §5 named and left open:
*"nothing here has been run by a live agent, and that is now the whole of the risk."*

#### The deadlock

Four decisions, each defensible alone:

| Where | What it says |
|---|---|
| `/feature-implement` step 11 | `done` → `Closes #<sub-issue>` on the commit, and **do not close the sub-issue by hand** |
| `/onboard` Step 5 | that trailer fires **only when the commit reaches the default branch** |
| `/feature-implement` step 12 | **a phase never pushes** — the push is once, at `/feature-close` |
| `/feature-close` | refuses unless **every sub-issue is closed** |

Inside a feature's branch, no phase can ever read `done`. Phase 2 with `Depends on: 1` is never runnable;
step 3 re-picks phase 1, finds it assigned, and resumes it forever; `--all` stops on *nothing is runnable*.
The merge that would close the sub-issues sits behind `/feature-close`, which those same sub-issues block.
`/feature-status` already argues with itself about this — *"a sub-issue closed while its commit is still
unpushed is not a discrepancy"* assumes an agent that closes the sub-issue directly, which step 11 forbids
in the same sentence that explains why sub-issues were chosen at all.

**It is not a wording slip.** Under the tree substrate the closing write is a line in a file that travels
in the commit, so §4.4 costs nothing. The tracker substrate has no write that rides a commit except a
trailer, and a trailer fires on merge — after the work, not with it. §10.4 reached for the one primitive
that looked atomic and it is atomic against the wrong event.

#### The repair that was available, and why taking it empties the design

The deadlock is fixable in place: let the agent close the sub-issue at the end of the phase. One sentence,
and every other part of §10.4 survives.

**It survives as a mechanism with no argument under it.** *The closing write rides the same change as
the work* — §4.4's binding, carried onto this substrate by `Closes #N` — was the whole of why a sub-issue
beat a row. An agent closing an issue by hand after the commit is a second write after the commit, which is
exactly what a Status column is. The two designs then differ in cost and in nothing else, and the costs are
not close:

- **N+1 remote writes per plan instead of one**, each able to fail — which is where the interrupted-run
  window comes from in the first place.
- **The reconciliation apparatus that window requires**: `/feature-plan`'s body-versus-sub-issues verdict
  table, `/tracking-migrate`'s resume-by-observation table, and `/feature-status`'s stop on a phase list
  that disagrees with its sub-issues. All of it exists to detect a plan half-written across two kinds of
  object.
- **A ledger with two shapes**, described twice in every skill, held in the head of every reader.
- **Sub-issues are issues.** They are in `/issues`, `gh issue list`, notifications and search. Repository
  saved views are in public preview and cannot be made the default view, so `no:parent-issue` is a
  discipline reapplied per surface rather than a property of the repository.

**So the Status column comes back into the body and the sub-issues go.** The ledger is one table with one
shape under both answers — `#`, `Phase`, `Depends on`, `Status`, `Note`, and the `Files:` line beneath it.

#### What that costs, stated plainly

**The closing write no longer rides the commit under this answer.** It cannot: a body edit is not a commit.
It is a second write immediately after, and the window is real. What replaces the atomicity is evidence —
**a closing row names the commit that carried the phase.** A `done` row whose sha is in the branch is
checkable against the repository, which is the property the atomicity was buying, and it is the move
`Files:` already makes for §2.4. A `done` row with no sha is a disagreement to stop on.

**The `2 of 5` progress view is lost.** By §10.7's own criterion that does not buy a primitive: it is a
view, not a fact, which is the ground Projects were refused on.

**A phase loses its permalink.** The heartbeat already comments each phase boundary on the parent issue, so
the thread survives; only the anchor moves.

**One risk is new.** A body edit is a read-modify-write of text a person may be editing at the same time —
someone refining the plan while an agent flips a row. Sub-issue state touched no shared text. Re-read the
body immediately before writing, and write only the row.

#### What is untouched, and the one primitive that goes with them

Claiming (§10.6), the heartbeat, the two close reasons, `/roadmap`'s adoption mode, the never-convert rule
for `history.md` and `archive/`, and `findings.md` staying a file: all unchanged. Contention is between
features, never inside one — *what must not happen is two agents on one feature* — so a body has exactly
one writer at a time, the assignee, and sub-issue assignment was buying no concurrency the parent assignee
did not already provide. **That is the sentence worth keeping: the multi-writer argument that justifies
this entire substrate never reached below the feature, and §10.4 built phase-level machinery as though it
did.**

**`workflow:blocked` goes too.** §10.4 gave it a label because *open/closed cannot express stuck* — a fact
about issue state, and the only stored primitive that existed for a reason other than ownership. A Status
column expresses `blocked` the way it expresses the other three. **The primitive map is now one label**,
`workflow:feature`, which earns its place by having no structural home at all.

#### One dependency dissolves along with the trailer

`tracking.md` records that the tracker answer **requires** `git.md`'s *the agent pushes and opens a pull
request*, and `/onboard` Step 5 refuses the other pair. The stated reason was the mechanism: *"a phase
closes its sub-issue through `Closes #N` on the commit, which only fires when the branch reaches the
default branch — without the push, a phase would never close its own row."* That is the deadlock of the
previous subsection, written down as a requirement.

**With the row back in the body, no part of phase status needs a push**, and neither does the close: an
agent that can edit an issue can close one. So the pairing becomes a **recommendation with a different
reason** — this substrate exists for several agents in several trees, and work that is never pushed is
visible to exactly one of them. Pairing the two answers is still right; *refusing* the other pair is no
longer something the mechanism can justify, and a requirement whose stated reason has been deleted is
precisely the inheritance §4.5 warned about when it made each of `git.md`'s answers independent.

#### The draft-or-plan test, restated

*An issue with sub-issues is a plan* becomes **an issue whose body holds a phase ledger is a plan.** Weaker
as an observation — a table in text, rather than the existence of linked objects — and it does not matter,
because the failure it was hardened against can no longer occur. §10.4's window was *body written,
sub-issues not yet*; a single atomic body write has no such intermediate state. The reconciliation is not
lost, it is unneeded.

**That is the honest shape of this reversal.** The machinery was correct, and it was guarding a hazard that
only existed because the design had split one fact across two objects to reach a primitive that turned out
to be unreachable.

### 10.11 Issue type — set by the workflow, read by nobody in it

§10.4 refused GitHub's issue types on two grounds and one of them has expired. They were *"org-scoped,
which is dead for a personal repository and would make the workflow depend on org configuration"* — and
they now resolve on a user-owned repository: `repos/OWNER/REPO/issue-types` returns `Task`, `Bug` and
`Feature`, enabled, and `type` is a documented body parameter on both create-an-issue and update-an-issue.
The premise moved, so the conclusion is re-taken rather than inherited.

**The other ground stands, and this does not cross it.** *"The workflow does not distinguish features from
bugs, and must not start"* is a refusal about the loop **reading** kind — a taxonomy laid across §2.6's
does-it-deserve-a-history-row partition produces a 2×2 the loop only ever reads one axis of. Setting a
field nothing consults is a different act: it makes the user's tracker well-formed and leaves the
workflow's own vocabulary untouched. **The test that keeps it honest is that no refusal, no ranking and no
report may branch on the type.** The moment one does, §10.4's objection lands and this section is wrong.

That is also why §2.1 does not bite. Its question is whether a stored fact needs maintaining, and this one
does not: nothing depends on it being right, so nothing can go stale against it.

**It is set twice, for a different reason than a phase row is (§2.8).** `/roadmap` sets a guess from the
one or two lines it has when it opens the issue; `/feature-plan` corrects it once the research exists. A
phase row is written twice so that an interruption is legible; a type is written twice because **kind
legitimately improves with information** — the guess made from a sentence is worse than the one made from a
plan, and both beat leaving the field empty for as long as the item sits in the backlog.

**Never overwrite a type that is already there.** §10.4's adoption argument is the whole reason: an issue
keeps everything it already carries, and a workflow that re-types someone's bug report has started
asserting the taxonomy this section just promised not to.

**It is best-effort, and one of its failures is silent by design.** A project with no types configured gets
nothing. GitHub **drops the type without erroring** where the caller lacks push access, so the write can
never be assumed to have landed. Neither case is worth a refusal — it is metadata, not a gate — and both
are worth saying once.

**`tracking.md` names the primitive, never a skill** (§10.8): a row in the primitive map — *the kind of
work → the issue's type* — where a project without them says *nothing*, which keeps a different tracker a
rewrite of that one file. It is also the only reachable place. `gh` exposes no `--type` flag on `issue
create` or `issue edit`, so setting it is a raw API call, and a skill naming one fails the test that no
skill names a forge command.

#### The word `Task` means the opposite thing here

GitHub's default set is `Task`, `Bug`, `Feature`. §2.6's vocabulary uses **task** for work too small for
the loop — *if you would not want a `history.md` row for it, it is a task, and `/orchestrate` handles it*.
An issue typed `Task` is still a workflow **feature**: it is in the loop and it will get a history row.
This is §2.2 in a new place, and the stub has to say it outright, because a reader who does not know will
see the type and reach for the wrong command.

### 10.12 Priority — not a new axis, the one the tracker answer silently dropped

Start with the hole, because it decides the shape.

`/feature-plan` ranks the backlog on four keys: **has a draft → unblocked by what shipped → smaller first →
backlog order.** Its *Under the tracker answer* table remaps exactly one of them, *has a draft*. The fourth
has no analogue and nothing said so. **An issues list has no manual order** — issues cannot be dragged into
a sequence outside a Project board, and the issue number is creation order, which is not priority. So the
tracker answer shipped with its final tiebreak undefined.

**That is what makes priority a replacement rather than a duplicate.** Under the working-tree answer,
importance is expressed by moving a line in a file, and a Priority field there would be a second home for
position — §2.1's drift, and it stays refused there. Under the tracker answer there is no position for it
to be a second home for. **So priority is a tracker-only primitive**, which is exactly what `tracking.md`
exists to hold: one substrate's answer to a question the other answers structurally.

**Unlike the type (§10.11), it is read.** All four ranking keys are proxies for *cheap and ready*; none of
them is *important*, and a stored human judgement is the one input the ranking has never had. It sits
**above `has a draft`**: overriding the default order is the entire purpose of marking something urgent, so
a field that only broke ties among equally-prepared entries would not do the job it was added for.

**The cost of that placement is real and belongs in writing.** `has a draft` dominates today because
half-researched is cheaper, and *"a plan that can be executed beats one that gets admired."* Putting
priority above it means the ranking can now recommend an unresearched feature. What keeps that safe is that
**the ranking recommends and never takes** — `/feature-plan` with no argument offers its top candidates,
each with a one-line reason drawn from the ranking, and asks. An urgent-but-unresearched recommendation
arrives with its reason attached, and declining it costs one word.

#### Two priority vocabularies, and the gap they close

`Urgent`/`High`/`Medium`/`Low` now sits beside `findings.md`'s `P0`–`P3`, and §2.2 says the two must not
blur. They do not, because their scopes do not overlap: **a `P`-severity asks whether this blocks the
phase**, inside one branch's life; **a priority asks what gets planned next**, across the backlog.

They meet at exactly one point, and it is a gap being closed. §10.4 says a promoted finding *"loses its
`P0`–`P3` on the way, because that severity meant does this block the phase — outside the branch that
raised it, it blocks nothing."* True, and it left the promoted issue carrying no statement of importance at
all. It now lands as a priority, which is the backlog-scoped claim the severity was never able to make.

#### What it is written on, today

Native issue fields are **org-scoped** — `orgs/{org}/issue-fields` is the only endpoint and it 404s for a
user account, which is where issue types sat before they moved. So priority is a **`Priority:` line in the
issue body**, exactly as `Size:` already is under `/tracking-migrate`'s mapping. A body line is this
substrate's answer for a fact with no primitive: cheap, legible, and swapped for a native field by editing
one row of the primitive map on the day fields reach personal repositories.

**Four `workflow:priority-*` labels are refused**, for §10.4's reason unchanged: every label beyond the
ownership bit is a second home for a fact, and four of them is a taxonomy inside a namespace kept
deliberately small.

**Size and priority are orthogonal and both stay.** Size is effort and feeds ranking key three; priority is
importance and now leads. A field conflating them would answer neither question.

### 10.13 The body's ceiling — a limit that turned out to be a measurement

An issue body holds 65,536 characters. The obvious reading is that this is a defect of the tracker answer:
the working-tree answer has no limit at all, so the substrate that does is the weaker one, and the skills
should work around it. **The reading taken here is the opposite.**

A filled plan is a few thousand characters. §6 of the template is a ledger and a short section per phase;
§1–§5 are a problem, its constraints, its decisions and its risks. Reaching sixty-five thousand means the
design, the phases and the risks of **more than one piece of work** were written into one document.

> **Corrected by measurement in §20.1 — that first sentence is false.** Across 23 plans in four installs
> the median is 48,893 characters and six are over the ceiling. The conclusion below stands and the
> premise does not: the ceiling is a real scope check, but it is a boundary real work crosses rather than
> a rare backstop, and the "nothing in the tree ever says so" this section notes two sentences on was
> left unbuilt for eleven versions. §20 builds it. That is
already a defect under the working-tree answer — §2.6 defines a feature as work you would want one history
row for, and a plan that size describes several — and nothing in the tree ever says so. **The tracker
answer is the first thing that notices.** So the ceiling is not a constraint to route around; it is a
scope check the substrate gives for free, and the design's job is to make sure the workaround is refused.

#### The three workarounds, and why each is worse than the split

Each one looks reasonable at the moment it is reached, which is why they are named in the skill rather than
left to judgement:

| Workaround | What it costs |
|---|---|
| Trim the plan until it fits | Discards exactly the research the plan exists to hold, to satisfy a limit that was telling the truth. And a trimmed plan reads identically to one that was small enough, so nothing downstream can tell them apart |
| Continue the plan into comments | The plan stops having a single home, and a reader cannot tell which half is current — the property §10.10 spent a version restoring |
| Link out to a gist or a file | The same, plus a second object to keep in step, which is the failure the sub-issues were removed for |

**The split is the only answer that loses nothing.** The phases are already the seam: they are commit-sized
units with real `Depends on` values, so a cut across a dependency boundary is one the research has already
justified. The plan's own structure is the split proposal.

#### It asks, and it keeps the id

Two decisions inside the split, both borrowed from decisions already made elsewhere.

**It proposes and asks.** §10.12's argument, applied at a larger scale: `/feature-plan` already asks which
entry to plan, because writing a plan is a commitment. Splitting one feature into three is a bigger
commitment than that, and a command that takes it silently is deciding the shape of the backlog.

**The issue being planned keeps the first chunk, and the rest become new backlog issues.** §10.4's adoption
argument unchanged — the thread, the reporter and everyone subscribed are why adoption does not open a
second issue about one thing, and they are equally why a split does not abandon the first one. **No parent
issue.** A hierarchy over the chunks would put the phase ordering back into a second home by exactly the
route §10.10 closed.

#### Room to spare, not room to fit

The check is not *does the plan fit*. The body is edited for the feature's whole life: every row moves to
`in progress` and then to `done`, gaining a commit sha and a note as it closes (§10.10). **A plan that only
just fits has already failed** — by the last phase it would not. `/feature-plan` measures with that room
included, and measures **before** the write, since the body is one write and a failed one is the worst
possible moment to learn the plan was too big.

#### Where overflow arrives and a split is not available

Two commands can meet the ceiling somewhere a scope decision cannot be made, and each needs its own answer.

**`/tracking-migrate` refuses.** It moves data and never redesigns it — the same reason it refuses a ledger
that disagrees with the repo. A plan that will not fit is named, with the margin, alongside every other
refusal that fired, and the split happens in the tree first. **A plan that arrives shorter than it left has
not been migrated.**

**`/feature-implement` shortens its own Note and writes the row anyway.** Here the priority order is not
close: the Status column is the phase's only home, and a row that never lands is state that is simply gone,
while a note is commentary that can be re-derived from the commit it names. So the row wins, the note gives
way, and the body being at its limit is reported. It never deletes anyone else's text to make space and
never moves a row out of the body — that would be workaround two, arriving at the other end.

#### The number lives in the stub

`65,536` is a GitHub fact, so it is a row in `tracking.md`'s primitive map and appears in no skill — the
same rule as the forge command (§10.8) and the issue type (§10.11). The skills ask *how large a body may
be*. A tracker with a different limit, or none, is a row edit.

### 10.14 `blocked by` — the fourth field report, and the fact this substrate had no reader for

**The report:** *"Neither roadmap or feature-plan guys make use of the github issues relationship feature
to add blocked by. I always have to tell them to do this manually. It helps so much in my human overview
so I can see clearly what to tackle next."*

This is the first report from the tracker answer itself, which PLAN.md item 5 has called unrun since
0.8.0 — and what it found is not a defect in anything §10 built. It is a fact §10 never had a place for.

#### The hole

**Order between features is written down nowhere, under either answer.** A phase has `Depends on` and it
resolves inside one plan. A feature has `Size:`, `Priority:` and a type, and none of them says *this one
cannot start until that one lands*. The closest thing in the workflow is `/feature-plan`'s second ranking
key — *unblocked by what just shipped*, which reads `history.md` — and that is a different fact wearing
the same word: it can only be true **after** the blocker ships. A backlog of eight pending entries where
three are waiting on the other five looks, to every command and every reader, like eight equal candidates.

Under the working-tree answer that is a limitation with nowhere to go. Under the tracker answer it is a
primitive that was sitting there unused.

#### Why it passes §10.4's test where sub-issues failed

The test that chose and then unchose sub-issues is *does this let a fact be observed, or does it require a
stored copy someone must maintain?* A `blocked by` relationship is observed: `gh issue list --json
blockedBy` returns every backlog entry's blockers in **one query**, so nothing caches it, nothing
regenerates it, and hand-editing it in the UI changes what the next command does, immediately.

**The four costs that killed the sub-issues (§10.10) are all absent:**

| §10.10's cost | Here |
|---|---|
| N+1 remote writes per plan | one write per **edge**, and only where somebody asserts one |
| reconciliation between body and objects | nothing in the body restates it, so there is nothing to reconcile |
| a ledger with two shapes | the ledger is untouched — this is not phase state |
| sub-issues are issues, in every list and every search | a relationship is not an object; no new row appears anywhere |

And the property whose loss forced the reversal — *the closing write rides the same change as the work* —
is not being reached for. Nothing here rides a commit, because nothing here is phase state. A relationship
is set once, when a person says one feature waits on another, and cleared by the blocker closing.

#### The hard part is not the write, it is who may assert one

A wrong relationship is not cosmetic: a blocked entry drops out of what `/feature-plan` offers and what
`/feature-implement` ranks, so **a guess hides work and tells nobody why.** That fixes who writes one:

- **`/roadmap` records only what the user's own wording names** — *after the export API*, *once auth
  lands* — matched against the backlog it has already read for the duplicate check, plus the order between
  entries when one invocation becomes several. It may not infer a dependency from the domain. This is the
  same line §10.11 draws around the type, held one notch tighter, because the type is read by nothing and
  this is read by two commands.
- **`/feature-plan` corrects it with research behind it**, exactly as it corrects the type — and it is also
  the command that *removes* one the research disproves. Its split now records its own edges: a cut along
  a dependency boundary has just established which chunk waits on which, which is the strongest dependency
  this workflow ever knows about.
- **`/feature-implement` and `/feature-status` only read.** Discovering a dependency at the moment work
  starts means the plan was wrong about its own ground; that is a report, not a quiet edit.

#### What reading it buys, which is the half the report was actually about

*What do I tackle next* has two halves, and the workflow only ever answered one. Ranking says what is
**best**; nothing said what is **unavailable**. So `/feature-plan` no longer offers a blocked entry and
lists what it left out and why; `/feature-implement` stops at its step-2 checkpoint rather than starting
work on ground that has not landed; and `/feature-status` gains a `Waiting:` block — the line the question
is usually about, and one the working-tree answer cannot produce at all.

**Two states become visible that nothing could see before**, and both are stops rather than rankings: an
*assigned* issue with an open blocker, which is work under way on ground that has not landed, and a
**cycle**, where no ranking will ever explain why nothing is runnable.

#### Two refusals

**No `Depends on:` field is added to `roadmap.md`.** The symmetry is tempting and it is exactly the
stored copy §10.4's test rejects: a line in a file that no structure backs, that nothing observes, and that
goes stale the moment a feature is closed. The working-tree answer keeps `history.md` and the honest
statement that it can only know afterwards. **`Priority:` is the precedent** (§10.12) — a field that exists
under one answer only, because the substrate is what made it necessary.

**A dropped blocker is named, and its relationship is left alone.** Closing an issue satisfies whatever it
was blocking, whatever the close reason — so `--dropped` frees work that was waiting on something nobody
is going to build, and the dependents' plans may assume it. `/feature-close` says which issues those are;
it does not edit them, and it does not remove the edge, because the closed issue and its reason are the
only explanation a person opening one of them next month will find.

#### Verified, not read

Against **`gh` 2.100.0** and the live API on **2026-09-15**: `gh issue edit --add-blocked-by` /
`--remove-blocked-by` / `--add-blocking`, `gh issue create --blocked-by`, and `blockedBy` as a JSON field
on both `gh issue view` and `gh issue list` — the last is what makes the whole-backlog read one call.
`GET /repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by` returns `200` with `[]` on a repository
with no dependencies while a bogus sibling route under the same path returns `404`, which is the existence
test that matters. GitHub's documentation supplies the rest: available on Free, Pro, Team and Enterprise
Cloud, and **triage permission** is the bar to create one — so it is best-effort in the same way the type
is, and never a gate.

### 10.15 The backlog is observable and not legible — the reader §10.10 did not have in frame

> **Decided and built.** One label, `workflow:planned`, written by `/feature-plan` and `/tracking-migrate`,
> created by `/onboard`, reconciled by `/feature-status`, and **read by nothing**. *Verified, not read* at
> the end carries the checks that gated it — including the one that corrected this section's own first
> draft, which had the refusal below going stale in 0.10.0 when it had never rested on that ground at all.

**A second field report, and like §10.14's it is not about a mechanism.** Somebody with the tracker answer
installed opened `github.com/OWNER/REPO/issues?q=label:workflow:feature` and could not tell which entries
had plans and which were still ideas. Nothing was broken. Every fact the tier model defines was precisely
where this document says it is — and **the one distinction the model turns on was the only one the page
could not show.**

| Fact | Where it lives under the tracker answer | On the issues list |
|---|---|---|
| in the backlog at all | the `workflow:feature` label | **shown** |
| being worked | the assignee | **shown** |
| **has a plan** | **a phase ledger inside the issue body** | **nothing** |
| where its phases stand | that ledger's Status column | nothing |
| what matters more | a `Priority:` line in the body | nothing |
| how big it is | a `Size:` line in the body | nothing |

The tier boundary this entire workflow is built around — Tier 1 is an idea, Tier 2 is an idea with a plan —
is invisible from the one surface a person actually looks at, and is recoverable only by opening each issue
and scrolling past the description to see whether a table is there.

#### Observability and legibility came apart, and no rule here distinguishes them

Under the working-tree answer the two are the same property and there was never a reason to separate them.
`roadmap.md` is one document; `**Doc:** plans/<NAME>-PLAN.md` sits on the line under the entry's heading,
next to its marker and its size. *Planned* is observed — it is the existence of a file, stored nowhere — and
it is **legible in the same act that observes it**, because observing it means reading the backlog, and
reading the backlog is one `cat`.

The tracker answer kept the first property exactly and dropped the second without anyone pricing it. A
ledger in a body is every bit as observable as a file in `plans/`. It is not remotely as legible, because
the act that reads the backlog — loading the issues list — is no longer the act that reads the entry.

#### §10.10 priced the loss, and applied a sound test to the wrong reader

It is written down, in the costs §10.10 stated plainly:

> **The `2 of 5` progress view is lost.** By §10.7's own criterion that does not buy a primitive: it is a
> view, not a fact, which is the ground Projects were refused on.

**The criterion is right and the reader is wrong.** §10.7 refused Projects partly because a board *"buys a
view, not a fact"* — an argument about what the **workflow** should depend on, and correct there: a board
is derivable from the issues, so making the loop read one adds a dependency and buys no new truth.

§10.10 reused that sentence to price the *loss* of a view. Those are different questions. That a view is
derivable is a reason not to make the workflow depend on it; it is not a reason the view is worthless,
because **someone still has to do the deriving**, and the sentence quietly assumes that someone is the
agent. For the agent the loss genuinely is zero — it reads the body on every command, so a ledger and a
badge are equally visible to it. The person reading the list derives nothing, sees seven identical rows,
and is the reader who was never in the frame.

§10.10 said the same thing one line further on and drew no conclusion from it:

> **Weaker as an observation** — a table in text, rather than the existence of linked objects — **and it
> does not matter**, because the failure it was hardened against can no longer occur.

The failure it was hardened against was an interrupted write. That reasoning holds completely. *Weaker as
an observation* was true about something else as well, and the sentence closed over it.

#### The refusal rested on drift, and the legibility question was never asked

§10.4 refused a `workflow:planned` label, in one clause:

> `workflow:planned` is refused for the usual reason: a label shadowing an observable fact, wrong the first
> time someone adds phases without relabelling.

**The first draft of this section had that refusal going stale in 0.10.0** — sound while *has a plan* was
the existence of sub-issues, which GitHub was taken to render on the parent's row, and orphaned when
§10.10 removed them. **That reading is wrong, and checking it is what found it.** GitHub does not render
sub-issue progress on the issues list, and nothing sourceable says it ever did: it appears on the issue's
own page, in `gh issue view`, and in a Projects field somebody has to switch on. The list's row fragment
carries no sub-issue field at all — *Verified, not read* below has the method.

**So the premise was never there to outlive.** The backlog has not been legible on the issues list at any
point in this design's life — not under sub-issues and not under the ledger — and §10.10's own cost note,
*"the `2 of 5` progress view is lost"*, was describing a view on the detail page and in the CLI. Neither is
the surface the question gets asked on.

**What the refusal actually rested on is the other half of its own clause: drift.** *Wrong the first time
someone adds phases without relabelling* is a complete argument standing alone, and it says nothing about
rendering. The shadowing half was doing no work, because there was no rendered signal for a label to shadow
under either design.

**That makes this a narrower correction than a reversal, and a worse finding about the design.** The label
was refused on a drift risk — answerable, and answered below. What was never asked, by anyone, is what the
issues list actually shows. Three sections then ran on the unasked answer: §10.4 choosing sub-issues partly
for their visibility, §10.7 refusing Projects for buying *a view, not a fact*, and §10.10 pricing the loss
of a view that was not where it was thought to be.

#### The whole of the objection, and the answer §10.10 already supplies

*Wrong the first time someone adds phases without relabelling* is now the entire case against the label,
and it is a real hazard that does not evaporate. But it is the identical hazard §10.10 took on knowingly,
one paragraph after removing the sub-issues:

> **The closing write no longer rides the commit under this answer.** It cannot: a body edit is not a
> commit. It is a second write immediately after, and the window is real. What replaces the atomicity is
> evidence — **a closing row names the commit that carried the phase.** […] A `done` row with no sha is a
> disagreement to stop on.

**The answer to a write that might not land was never "do not make the write."** It was: make the
disagreement checkable, and stop on it. That answer is available here unchanged, and it is cheaper, because
the label and the body write are adjacent lines in one command — `/feature-plan` writes the plan and
applies the label in the same run, the way it already corrects the issue's type there.

| Observed | Means |
|---|---|
| label, and the body holds a ledger | a planned feature |
| no label, and the body holds one or two lines | an idea |
| the body holds a ledger, no label | an interrupted `/feature-plan`, or a plan written by hand — **stop and say so** |
| label, and the body holds no ledger | a label applied by hand — **stop and say so** |

**The body wins both disagreements**, and that is not a tiebreak, it is the whole design: the ledger is the
fact and the label is a rendering of it. `/feature-status` gains two rows in the reconciliation it already
performs — no new apparatus, just §2.4's existing instruction to stop rather than resolve, pointed at one
more pair.

**`check` cannot carry them, and that is a boundary rather than a gap.** It reads files under `context/`
and makes no network call — `trackingAnswer()` is a shape read of a local stub, which is the whole of its
involvement with this substrate — so a label on a remote issue is outside everything it can see. The
reconciliation has exactly one home, the command that already queries the tracker, which is also the only
place it could ever have had two.

#### A label nothing reads is a rendering, not a second source of truth

This is the clause the whole argument rests on, and it has to be written as a rule rather than a habit:

> **No ranking, refusal, selection, gate or report may branch on the label.** `/feature-plan`'s ranking
> reads the body. `/feature-implement`'s phase selection reads the ledger. `/feature-status` reads the
> ledger. The label is applied, and reconciled, and never consulted for a decision.

With that clause, §2.1 survives **literally**, not by charity. *"Planned is not a status"* is a claim about
what the workflow consults in order to act, and it stays exactly true: the workflow still observes a plan by
finding a ledger, and would behave identically if every label in the repository were deleted tonight.

**The precedent is in this same section, already built and already shipped.** §10.11:

> **The workflow sets it and never reads it.** […] **no refusal, no ranking and no report may branch on
> it.** The moment one does, this stops being metadata for your tracker and becomes a second vocabulary
> laid across the one in `workflow.md`.

There is already a category here for **tracker metadata written for the tracker's readers and inert inside
the loop**, and the issue type is in it. `Priority:` is the near miss that proves the line is real rather
than convenient: it *is* read, by exactly one ranking, and §10.12 had to argue for that separately and
specifically. A label that no command reads is on the safe side of a boundary this design has already drawn
twice.

#### What one label buys, and why it is not a board

Three searches, typed into the box that is already on the page:

```
label:workflow:feature -label:workflow:planned                    the ideas
label:workflow:feature  label:workflow:planned                    planned, not being worked
label:workflow:feature  label:workflow:planned assignee:*         in flight
```

No Project, no board membership to maintain, no GraphQL, no node ids, nothing in `executors.md`, and
nothing new for `/onboard` to collect beyond the label name it already asks for. **It is the same argument
§10 used to choose this substrate at all** — one thing outside every working tree that every reader can
reach, including readers this checkout has never heard of. §10 made that argument about agents on other
machines. It is the same argument for a person with a browser, and that reader was in scope the entire time.

#### Rejected

| Candidate | Why not |
|---|---|
| **the issue's type** | It is rendered, it is already set, and it is the worst available answer. Type is a *kind* taxonomy — `Bug`, `Feature`, `Task` — and overloading it with a tier would lay a second vocabulary across `workflow.md`'s, which is the precise thing §10.11 and §2.2 forbid. The tier and the kind are orthogonal: a planned bug exists. |
| **a milestone** | §10.7, unchanged. An issue belongs to at most one, and spending the user's only slot on a bit the workflow could carry in a label is what that section refused. |
| **a Project with a Status field** | §10.7, unchanged and still the strongest of the four grounds: a `Status` field is stored state duplicating the assignee and open/closed, membership is a second thing to maintain with no structural answer to *is it on the board*, and it is GraphQL. A user pointing a Project at the repository themselves stays exactly as available as it is now. |
| **a title prefix** — `[plan] export-api` | Rendered, and refused where it matters most. §10.4 keeps an adopted issue's title because it is the reporter's and the discussion is attached to it; a scheme that works only on issues the workflow opened is not a scheme. |
| **a pinned dashboard issue** holding a rendered table | A cache of the backlog, in the tracker, with no reader that can tell when it went stale — and it is read most eagerly by exactly the person least able to check it. Every objection §2.1 makes, with a timestamp on it. |
| **bringing the sub-issues back** | §10.10's deadlock is untouched by anything here, and its four costs — N+1 remote writes, the reconciliation apparatus, a ledger with two shapes, and sub-issues appearing in every issue surface — are unchanged. **And it would not even answer this question**: sub-issue progress does not render on the issues list, which is the finding that corrected this section's own first draft. |
| **a saved repository view** | Named in §10.10: in public preview and **cannot be made the default view**, so it is a discipline each reader reapplies per surface rather than a property of the repository. Worth recommending in the stub; not worth depending on. |
| **doing nothing, and improving `/roadmap`'s printed report** | The right fix for a different question, and it is owed anyway — see the defect in PLAN.md item 8. It does not touch this one: a report helps the person who is talking to an agent, and this reader is looking at a web page with no agent in the room. |

#### Verified, not read

**This section's first draft was wrong on the one fact it did not check, and it is the reason the check
happened at all.** Against the live github.com HTML and `github/docs` `main` on **2026-09-22**, with **`gh`
2.100.0**:

- **Every label on an issue renders as its own chip in the list view.** Server-rendered HTML was compared
  against the Relay payload on three repositories — `cli/cli` (24 labels across 12 rows), a
  `kubernetes/kubernetes` query returning heavily-labelled rows (70), and one row carrying 12 — and the
  chip count matched the payload count exactly in all three. The row's `labels` field is a paginated
  connection reporting `hasNextPage: false` at 12, and there is no `truncated`, `overflow` or `maxLabels`
  key anywhere in the payload. **Two chips will render.** What was *not* checked is whether CSS clips or
  wraps them at a narrow viewport, which needs a real browser; there is no truncation in the data or the
  markup.
- **Negation is documented, with labels as the worked example** — `-label:bug label:priority`, "matches
  issues … that lack the label 'bug', but *do* have the label 'priority'". `assignee:*` for any assignee is
  documented alongside `no:assignee`.
- **Applying an existing label is triage. Creating one is write.** *"Anyone with triage access to a
  repository can apply and dismiss labels"*; creating, editing and deleting are write. **Applying a label
  and creating a `blocked by` sit at exactly the same bar**, which is why the stub's best-effort wording is
  the type's and the relationship's, word for word, rather than a new hedge.
- **A missing label is an error, not an implicit create.** `gh issue edit --add-label` resolves names to
  ids client-side before any mutation and returns `'<name>' not found` without touching the issue; matching
  is case-insensitive. There is no create-on-the-fly flag — `gh label create` is a separate command, and it
  needs write where applying needed only triage. **That asymmetry is why `/onboard` creates both labels and
  no other command does**: the one command that runs before any work is the one place a write-level
  operation belongs, and a triage-only agent can then apply what it finds.
- **Sub-issue progress is not on the issues list.** Checked against `dotnet/runtime` filtered to
  `has:sub-issue`, where every row is a parent and `gh api graphql` confirms real progress behind them
  (`#132812 → 4 of 5`, `#132860 → 0 of 3`): the list's row fragment carries no `subIssuesSummary` and no
  `parent`, and the fragment's keys are identical across all four repositories sampled, so the query is
  fixed rather than flagged per repository. It renders on the issue's own page, in `gh issue view` as
  `Sub-issues · 1/3 (33%)`, and in a Projects field that must be enabled. `has:sub-issue` exists as a
  **filter**, which is not display.

**On whether it ever rendered there: unknown, and left unknown.** The public-preview and GA changelogs do
not mention the issues index either way, and absence from a changelog proves nothing. This section does not
need the historical claim — it needs the current one, which is checked.

**One method note worth keeping.** The permission sentence for issue dependencies is not in the rendered
documentation page; it is front matter that renders as a callout, and a summarising fetch misses it. Read
the raw `.md` in `github/docs` when a documentation page appears not to state something it ought to.

#### The lesson, which is not about the label

**Observability and legibility are different properties, and every rule in this document treats them as
one.** §2.1's test asks whether a fact must be maintained by hand. It does not ask *who can see it, and from
where* — and it never had to, because under the file answer the two questions had one answer: a fact
observable from the tree is legible to anyone who opens the tree.

Moving a substrate is the move that separates them, and §10 separated them without noticing. That is worth
more than this one label: **a fact can be perfectly observable, perfectly non-duplicated, perfectly
incapable of drift, and still be invisible to the person the workflow is for.** The test that catches it
is not *does this require a stored copy* but *what does the reader see, on the surface they are actually
looking at* — and this document has never asked it.

## 11. The release answer — what a change announces, and to whom

`context/release.md` is the sixth file in the shape of `verify.md`, `executors.md`, `git.md` and
`tracking.md`: hand-written prose, project-owned, absent from the manifest, read fresh. It holds a fact the
workflow had no home for — **what a change announces, and to whom** — and the standing rule that comes
closest, *Documentation is part of the change* (§2.9), covers a README going stale rather than a release
note that was never written.

It ships as **nothing here announces a change**, so every existing install behaves exactly as it did until
someone runs `/onboard` — the same shape as `tracking.md`'s first answer (§10.8).

**This section is written as an enumeration rather than as prose about the design**, and the order is
deliberate: the grid in §11.4 was run before a line of template prose existed to be defended. §11.1–§11.3
are the three arguments that constrain it; everything after is the exercise and what it produced.

### 11.1 The hole, and the one thing that makes it unlike its five siblings

`verify.md` can hold a true answer with the tool absent. *No lint step* is accurate, and a project without
a linter chose that. **`release.md` cannot.** *"A change is announced by writing a changeset"* is **false**
in a repository with no changesets — the same defect as a `done` row whose **Files:** do not exist, which
`/feature-implement` step 5 stops dead on.

So `/onboard`'s step has exactly three moves available, and only the third and the first are not bugs:

| Move | Verdict |
|---|---|
| write the true answer — *nothing here announces a change*, and name what is missing | correct, and it is what phase A ships |
| write a false one — name a mechanism that is not on disk | the `done`-row-with-no-files defect, in a configuration file |
| **make the answer true** — install the mechanism, then write it | correct, and it is the only place in this tool that mutates `package.json` |

That asymmetry is also the whole of the slippery-slope answer. Offering to install a missing linter is a
*different act*, because *no lint step* was already true; there is no false answer to escape from.

**The refusal satisfies the constraint exactly as well as the install does.** A step that writes *no*,
names what is missing and stops has left a true answer behind it — which is why the install is a
convenience on top rather than a load-bearing part of the design, and why §11.6 splits them.

### 11.2 What it refuses to install, and why that is not timidity

**The release job.** This repository tags on a version change in `package.json` and publishes the tag over
OIDC; `northguild/gmt` publishes on a merge that moves a version in a release pull request of its own. Same
author, same month, two designs — because the right one depends on branch protections, registry auth and
who is allowed to press the button. **§11.10 narrows this refusal to the thing it was always about — the
job, not the event** — and the *deploy* half of what follows is where it was shown to be too wide.

The half that *is* uniform — accumulate notes, version them in a release pull request, tag, publish a
release — is uniform right up to the last step, and **the last step plus its credentials is exactly where a
generated workflow does damage.** So `/onboard` names the gap specifically and stops.

**And it must never leave the answer saying changes are announced while nothing consumes the notes.** That
state is §10.9's tracker-says-tracker-while-entries-are-files again, wearing different clothes: it reads as
configured, every command dutifully writes notes, and nothing ever moves a version. The guard is a section
in the stub — *what this project does not do here*, naming bump, tag, publish and deploy — written by the
same step that wrote the answer.

### 11.3 The answers, per path rather than per repository

A repository can publish one artifact, deploy another, and say nothing about a third. `gmt` is `packages/*`
published plus a private `apps/dox`; this repository reserves `apps/` for the same shape. **A repo-wide
yes/no cannot express it**, and in `gmt` the exception is currently prose restated in four files.

| Path | Announces to | Deserves a note when | A bump means |
|---|---|---|---|
| `packages/widgets` | people installing it | the public surface changes | semver — major breaks their build |
| `apps/web` | people using the app | behaviour changes in the running app | dates a deploy; no contract |

Column two governs *how the text is written*; column three governs *whether a file is written at all*, and
column three is the one that does the work — it is where "an internal refactor to `apps/web` gets no note"
is recorded once instead of re-argued per pull request.

**A single-package repository gets one row and that is fine.** Both judgments are per-project regardless of
artifact count, exactly as `git.md`'s *the main working tree* is a trivial answer worth writing down.

Two more answers sit beside the table and are **not** columns in it — see C7:

- **What records a note** — a file under a notes directory, a bullet under an `## Unreleased` heading,
  something else. This is the one that can be false, per §11.1.
- **At what granularity** — *once per feature* or *per phase*. It ships as *once per feature*: the note's
  audience reads releases, not phases, and a feature's phase sequence is an implementation detail that
  means nothing to them. *Per phase* exists for the repository that ships each phase — a deployed app,
  where the phase is what left the building.

### 11.4 The enumeration — every terminal state, the sequence that reaches it, and what checks it

With no repository where the workflow lives (§11.7), **this is the only verification this package can
currently perform**, which is the argument for running it exhaustively rather than treating it as a
footnote. It is the shape of what caught the sub-issue deadlock (§10.10): every rule correct alone, the
cycle visible only across four files, and no lexical test able to see it.

**The terminal states.** Every way a run can end with respect to `release.md`:

| | Ends with | Reached by | Precondition, and the file that owns it |
|---|---|---|---|
| T1 | nothing announced, because nothing here announces | any command that lands code | `release.md` — the shipped answer; no table exists to consult |
| T2 | nothing announced, because this change does not deserve it | the same three | `release.md` column three, applied to the paths this change touched |
| T3 | one note per path that owes one, inside the change | `/feature-implement` step 7 under *per phase*; `/feature-close` under *once per feature*; `/orchestrate` always | `release.md` — the table, the mechanism and the granularity together |
| T4 | the note that is already there is edited, not duplicated | a resumed phase, or a Gate 2 loopback re-entering the work | the ledger row reading `in progress` (`workflow.md`), plus the note's own path on the phase's **Files:** line |
| T5 | the notes are shown and their bump levels confirmed | `/feature-close`, under **both** granularities | `git.md` *Push and pull request* — it decides where "leaves the machine" falls |
| T6 | a path the table does not cover is named; no note is written | any of the three | `release.md` has no row for it; `verify.md`'s *a missing entry is skipped, never faked* generalised |
| T7 | no note, because the level was declined — said, not silent | `/feature-close`, `/orchestrate` | nothing in a file. A person's answer, which is why it has to be reported |
| T8 | no note is owed at all, because the feature was dropped | `/feature-close --dropped` | the outcome the command is writing — a `history.md` row, or the issue's close reason |
| T9 | the answer stays *no*, and the missing mechanism is named | `/onboard` Step 9 | the repository itself — nothing on disk records a note |
| T10 | the answer is written, and the gap it does not fill is named | `/onboard` Step 9 | the repository itself — no job consumes the notes (§11.2) |

**The axes, and the finding that three of them are inert.** The grid is the three commands that land code,
times the shapes a repository takes here, times both `tracking.md` answers, times `git.md`'s who-commits
and push answers, times the granularity answer — 144 cells. Running it collapses them:

| Axis | Values | Changes |
|---|---|---|
| command | `/feature-implement`, `/feature-close`, `/orchestrate` | who writes the note, and when |
| path shape | a published package, a deployed app, neither | which rows the table has, and whether it has any |
| granularity | once per feature, per phase | which command writes it — C1, C3, C7 |
| `git.md` *Push and pull request* | neither, the agent pushes | where *leaves the machine* falls, and so where T5 happens |
| `tracking.md` | the working tree, an issue tracker | **nothing** — C8 |
| `git.md` *Who commits* | the user, the agent | **nothing** — the note is a file inside the change under either answer |

**Three of six axes are inert, and saying so is the result.** 144 cells become 36 live ones, and of those
the eleven below are the ones the grid found rather than confirmed.

### 11.5 The cells

**C1 — `/orchestrate` is the one cell the granularity answer leaves empty.** Both its values are plan
vocabulary, and this command has neither: no entry, no plan, no ledger. An agent reading *once per feature*
against an ad-hoc change either treats the change as a feature — a guess — or decides the answer never
fires and **ships a user-visible fix with no note.** Nothing goes red either way. One sentence in the stub
closes it: *granularity governs the plan flow, and for `/orchestrate` the change is the unit.* It still
consults the table, so a docs typo gets nothing because column three says so. Found by hand before the
grid; the grid is what says it is one cell of many rather than a curiosity.

**C2 — a resumed phase or a Gate 2 loopback writes a second note.** Step 7 is re-entered by both, and the
mechanisms that accumulate notes deliberately use non-colliding filenames (§11.8), so two files describing
one change do not conflict — they are both counted, and the changelog says the same thing twice. The rule:
**a note is part of the phase's change and shares its fate.** Re-entering step 7 updates the note that is
already there; a phase abandoned takes its note with it. This is the only cell where doing the right thing
twice is the failure.

**C3 — `/feature-close` under *per phase* is not a no-op, and this is what keeps `--all` intact.** The bump
level is a per-change judgment, so it is asked rather than read — but under *per phase* the write happens
inside `/feature-implement`, and `--all` exists precisely so that nothing asks between phases. Resolving it
by making `--all` decline the continuation (the way it does under *the user commits*) would disable the
flag for every published package.

The resolution the grid points at instead: **a note is confirmed where it leaves the machine, not where it
is written.** A note is a tracked file that publishes nothing until a version moves, so a wrong level is
cheap right up to the release pull request. So step 7 proposes the level and writes it, and
`/feature-close` — which is already the only command that acts on *Push and pull request*, and already
positioned *after the retirement is committed, never before* — shows the notes the feature carries and
confirms their levels there. **Under *once per feature* it writes them; under *per phase* it reads them.
One rule, both granularities, and `--all` gains no new stop.**

**C4 — `--dropped` writes no note and removes none.** Mode 2 retires an idea that will not be built, so
there is nothing to announce. But under *per phase* a partly-implemented dropped feature may have landed
phases, and their notes describe changes that are in the tree. **A note belongs to the change that landed,
not to the feature's outcome** — so the command neither writes one nor sweeps the existing ones. This is
the same boundary as §10.8's *history is never converted*: the record of what happened is not edited to
match a decision taken afterwards.

**C5 — a path the table does not cover.** A new package added after `/onboard` ran, a `scripts/` directory,
repository tooling. Three candidate behaviours, and only one survives: refusing blocks ordinary work over a
configuration gap; writing a note invents an answer for a path whose owner never gave one. So **the path is
named, no note is written, and `/onboard` is named** — `verify.md`'s *a missing entry is skipped, never
faked* generalised to a file whose entries are paths. It is a report, not a refusal and not a default.

**C6 — one change, two paths, two answers.** A phase touching `packages/widgets` and `apps/web` owes what
each row says, which may be two notes, one, or none. **The unit is the path, not the change.** Stating it
matters because the tempting shortcut — one note per change — is right in the single-package repository
that most installs are, and silently wrong in the one the table exists for.

**C7 — granularity is per project; the table is per path.** They read like one axis and are two. A
granularity column in the table would let one repository write per-phase notes for its app and per-feature
notes for its package, which no mechanism supports and which makes *when does this command write* depend on
what the phase happened to touch. **Granularity answers what leaves the repository as a unit**, and that is
a property of the repository.

**C8 — `release.md` is the first file in this shape with no *Under the tracker answer* section.** A release
note is an artifact of the change, so it is a file in the repository under both of `tracking.md`'s answers —
the tracker moves where the *ledger* lives, not where the *code* lives. Both inert axes are worth stating
rather than leaving to be inferred, because every sibling stub has such a section and its absence otherwise
reads as an omission.

**C9 — a declined level is a said non-write.** The user can decline the confirmation in T5, and the feature
retires with no note. That is their call about their own release, and the only failure available is doing
it quietly — §10.9's lesson, unchanged: **a step that can produce no output must still report.**

**C10 — Gate 2 must not fail a phase for a note that granularity never owed.** The reviewer is told to
*check whatever `release.md` requires*, and under *once per feature* a phase requires nothing. So the
pointer names the file rather than the obligation, and the reviewer reads the granularity answer before it
judges. Under *per phase* nothing new is needed: the note's path is on the **Files:** line, so step 11's
existing *a phase whose documentation has not landed has not landed* covers it **for free** — which is the
whole reason the path goes on that line.

**C11 — `check` sees none of this, on purpose.** Whether a note was owed depends on a prose table and a
path match, so a structural validator would have to re-implement the judgment and would cry wolf on every
docs-only change. `check` validates shape and answers no workflow question (§6.4); this is a question.

### 11.6 What lands where, and why it is two phases

**A — the answer.** Entirely inert prose. The shipped answer is *nothing here announces a change*, so it
introduces no state a repository did not already have.

| Lands in | What |
|---|---|
| `templates/stubs/release.md` | the four answers, registered in `STUBS` with `onboard: true` |
| `/onboard` Step 9 | after Stack — it needs the layout that step settles. Classifies, detects, asks per path, and **refuses** where the mechanism is absent |
| `/feature-implement` step 7 | under *per phase*: the note is the phase's scope and its path is on the **Files:** line |
| `/feature-close` | T5 under both granularities, and the write under *once per feature* |
| `/orchestrate` | C1 — the change is the unit |
| `stubs/stack.md` | a *generated* changelog is not a documentation surface, so no plan's §7 lists it |
| `reviewer.agent.md` | *check whatever `release.md` requires* — a pointer, no tool named |
| `workflow.md`, `context/README.md`, the `AGENTS.md` block | a standing rule, and a row wherever the five sibling answers are already listed |

**B — the install.** The devDependency, the vendor's init, the private-package versioning line written
**from the answer** rather than from the default, and the shorthand scripts. Ships after A has been
exercised.

**An upgraded install reaches neither.** A project-owned stub is unreachable by `update` (§4.1, §6.2), so
both land on the existing **Next** path that names `/onboard`, with no new machinery.

### 11.7 Vendor neutrality is the point, not a nicety

A repository with no `package.json` — Go, Python, a static site — cannot use changesets at all, and answers
with a hand-maintained `## Unreleased` section, or `towncrier`, or nothing. The skills ask *"record a note
per `release.md`"* and **not one line of them changes.** Bake the tool in and the workflow only fits
JavaScript repositories, which is a strange constraint for a planning workflow.

So the existing test — no skill may name a forge command (§10.8) — gets its sibling: **no skill may name a
release tool.** `/onboard` is the exception, for the same reason it is the exception to the issue-type rule
(§10.11): it is the one command that *collects* a project-owned answer, so it has to name what it is asking
about. Collecting a parameter is not reading one, and nothing `/onboard` writes is consulted by the loop.

**The dogfood question is open, and it is item 1's question wearing different clothes.** This repository
manages the workflow and does not use it; `northguild/gmt` has its own bespoke `context/`. There is nowhere
the workflow actually lives, which is the real reason the live-agent run has gone unrun across three
releases. **Phase A being inert is a mitigation, not an answer.**

### 11.8 Mechanics worth not re-learning, all verified against the changesets docs

Recorded here rather than in the stub, because they are facts about one vendor and the stub is per project.

- **v3 disables private-package versioning by default.** v2 versioned without tagging; v3 turns both off,
  on the reasoning that most private packages are fixtures. A deployable app therefore needs versioning
  turned on and tagging left off, **written from the answer** rather than from the vendor's default. Left
  alone, the app never bumps and the deploy half silently does nothing forever — the single most valuable
  thing the detection step buys, and it is phase B's.
- **A note for one package does not drag in its workspace dependents**, which is what makes *bump the
  package, not the app* work: dependent ranges are only rewritten for packages already in the release. The
  exception is the internal-dependents setting, which defaults to out-of-range — a **major** bump puts a
  dependent's `^1.0.0` out of range, pulls it in with a patch, and that moved version fires the deploy. A
  `workspace:*` range never goes out of range. *We published a major and it deployed production* is a
  surprise you get once, so it is a line in the stub.
- **Adding a note is not driveable at all, and the earlier note here was wrong.** `add` takes `--empty`,
  `--open`, `--since` and `--message` — there is no flag for package selection *or* for the bump level, so
  `-m` alone still drops into the picker. Verified against 3.0.2: with stdin closed it hangs on an
  unsettled await and writes nothing. **So the agent writes the note file directly, in the documented
  format, always** — not as a monorepo fallback but as the only path, which is also the one that works
  where there is no script at all. **Filenames stay random**: two
  differently-named files never conflict on merge, which is the property `history.md` needs `merge=union`
  to fake (§4.5) — and it is also what makes C2 possible.
- **A status check needs a fetched remote**, and exits non-zero when packages changed without a note —
  which is it *working*. Step 9 has to tell "the config will not parse" apart from "you have no notes yet",
  and only the first is a failed setup. **It stays out of `verify.md`**: Gate 1 runs per phase and would
  flag every docs-only change. The gate that wants it is CI, on the pull request.
- **The answer names the script, never the raw command**, the same indirection `verify.md` already uses —
  which gives a flag like `--since=origin/main` one home instead of two. The script itself is phase B's.

### 11.9 Phase B is a subcommand, because the vendor rule is a rule about `templates/`

The ask was *"another command for migrating — `/changeset-migrate`?"*, and working out why that is the
wrong shape is what produced the right one.

**It is not a migration.** `/tracking-migrate` is the obvious precedent and it does not transfer. That
command *moves data* to a substrate that already exists and was already chosen — "It moves data. It does
not choose the substrate." The release case has neither half: a repository with no mechanism has no notes
to move, and the destination does not exist until something installs it. The only case with real data is a
hand-maintained `## Unreleased` section, and the honest answer there is to **leave it** — the tool writes
below it and that section stands as the record of how the repository worked before. Converting those
bullets into note files is inventing history. So: no converter, and the word *migrate* does not appear.

**It is not a skill.** A skill is inherited by every install, and a skill named after a JavaScript tool is
nonsense in the Go and Python ones. It is also self-refuting: `name: changeset-migrate` would have failed
§11.7's test itself, so shipping it meant deleting the test to make room for exactly what the test exists
to prevent.

**The boundary was already drawn, and nobody had noticed where.** §11.7's rule is about `templates/`
because template prose is what every install carries. `src/` is not inherited — it is a program someone
chooses to run, once, deliberately, and which refuses where it does not apply. So `release-init` may name
the vendor, install it, and be the one thing in this tool that mutates `package.json`, with **no rule
deleted and no `/onboard`-style exemption invented**. Two tests hold it from both sides: no template names
a release tool, and the command does.

Three consequences worth keeping:

- **The scripts name the vendor: `changeset:add`, `changeset:prepare-release`, `changeset:status`.** They
  shipped vendor-neutral first, on the reasoning that the script name is the seam `release.md` records and
  a project that swapped tools would keep it. **That was §11.7 applied past where it earns anything.** The
  rule protects `templates/`, because template prose is what every install inherits; a script name lands
  in one project's `package.json`, three lines above `@changesets/cli` in its own devDependencies. Hiding
  the tool in the name while it sits in the same file is a fig leaf, and it charges a daily cost — a
  contributor whose command fails has no word to search — to hedge an event ("this repo moves off
  changesets") that is close to never, costs a three-line rename when it happens, and self-heals anyway,
  because `/onboard` re-detects and re-records on its next run. What was actually load-bearing survives
  untouched: **no skill names a tool**, and that is still test-enforced.
- **`prepare-release`, not `version`, for the middle one — and never a bare `release`.** It shipped as
  `release:version`, mirroring the vendor command, which put the blandest name on the only action of the
  three that cannot be run twice: it consumes every pending note — deleting the files — bumps the
  versions, rewrites the changelogs, and where a deploy watches versions it is the button that ships.
  `version` named the field it edits rather than the thing it does. A bare `release` is worse than either:
  **as a verb it means publish**, which this does not do, and that is the one misreading in the set that
  costs something. `prepare-release` is safe because *prepare* is the verb — a distinction narrow enough
  that the first test written for it was wrong, and now encoded as `/(^|:)release$/`.
- **It does not write `context/release.md`.** One writer per file: the installer installs, `/onboard`
  answers, the same way `standards add` does not write `stack.md`. Step 9 gained a line naming the command
  and lost nothing — it still installs nothing, still generates no release job, and **naming an installer
  is not running one.**
- **It writes files and runs nothing** — no `npm install`, no vendor `init`. Which is also what makes
  `--dry-run` exact, and what lets the private-package setting be written from the answer in one pass
  rather than initialised to the default and patched afterwards.

**Adding scripts to `package.json` put a hole in Step 7, and it had to be closed in the same change.**
That step sweeps `package.json` scripts for verification candidates and then *runs each one*. A versioning
script swept up as a Build candidate bumps every package and writes changelogs during onboarding; an
interactive note-writing script hangs the agent. Step 7 now refuses any script that writes — named by
shape, not by script name, so it also covers a project that wired its own — and says why it must not run
one to find out. The note-existence check is turned away in the same breath and sent to the pull request,
which is §11.8's rule arriving at the place it was always going to be tested. **This is the class of thing
that only shows up when a tool starts writing into a file another command reads.**

**The one thing it refuses to guess** is §11.8's first bullet, now load-bearing rather than recorded: is a
private package here deployed? It asks on a terminal and refuses without one, naming the flag. Guessing
wrong in the safe-looking direction is the failure that hides for months.

**§11.8 is now exercised rather than read.** Against `@changesets/cli` 3.0.2 on a fixture workspace: the
generated config parses, a private app with `version: true` bumped `0.1.0 → 0.2.0` and wrote its changelog
with **no tag created**, and the same note under `version: false` left the app at `0.1.0` with the note
still sitting in `.changeset/` — the trap, reproduced. **This does not close the dogfood question.** What
ran was the vendor on a fixture, not the workflow on itself.

### 11.10 The event was missing, and everything above only fit a published package

The ask: **opting into notes is not an npm-publishing feature.** It has to work the same way for an app that
goes live, and that deploy should happen only when a pull request merges where `changeset:prepare-release`
was called.

**The uniform half was already written down here, one paragraph into §11.2** — *"accumulate notes, version
them in a release pull request, tag, publish a release"* — and then spent entirely on publishing. Deploying
appeared four times and never once as an **event**:

| Where a deploy was named | As what |
|---|---|
| §11.3's table, column four | *"dates a deploy; no contract"* — a consequence, with nothing saying of what |
| §11.8's first bullet, and `release-init`'s one question | the reason to version a private package, so *"the deploy half"* is not dead |
| §11.8's drag-along bullet | a surprise — *we published a major and it deployed production* |
| the stub's last section | one of four gaps the workflow does not fill |

So the file's final answer was **what this project does not do here**: bump, tag, publish, deploy, one line
each, under a heading whose whole content was a disclaimer. True, and useless to the repository the table
exists for — someone with a deployed app learned that the workflow would not deploy it and never learned
what would. **A note mechanism without the event is a changelog generator**, and read as one.

**The correction is one sentence: there is one event, not one per artifact kind.** The merge of the pull
request where the notes were consumed — versions moved, changelogs written — is what publishes a package and
what deploys an app. A feature's merge lands a note and ships nothing.

**The four-gap section is deleted rather than added to.** Its four lines survive as *what the event is wired
to*, inside `## What a release ships, and on what event`, which ships as *nothing here ships on a merge* —
true of every repository, like the first answer in the file. The replacement is not a longer disclaimer: it
answers, per path, what that merge does to it — publishes it, deploys it, or nothing.

**The condition is per path, and it is that path's own version moving in the merge.** Never *a release
happened*: a release that bumped only `packages/widgets` must not deploy `apps/web`. This is what promotes
§11.8's drag-along bullet from a footnote to the rule's own exception — where a major puts a dependent's
range out of range the dependent is pulled in with a patch, its version **did** move, and the deploy is
correct to fire. The surprise you get once is now the answer's edge rather than a warning beside it.

**Two failures the file now makes someone write down instead of discover**, and the second is the one §11.2's
guard could not see. That guard catches *the answer says changes are announced while nothing consumes the
notes*. It says nothing about the opposite: **something ships and consumes nothing.**

- **A deployed app that is never versioned has nothing for a deploy to key on.** This was known (§11.8) and
  recorded as a config trap. It is the gate's precondition.
- **A deploy wired to every merge of the base branch is not gated at all.** It ships whatever notes happen to
  be pending — other people's unreleased work included, which is exactly the blast radius `workflow.md`
  forbids an *agent* from taking — and announces itself with a changelog a release behind. `/onboard` reports
  it as the defect it is and rewires nothing.

**§11.2's refusal narrows to what it was always about: the job, not the event.** The event is uniform and
belongs in the file; the credentials that put an app in front of users are no more guessable than a registry
token. So the publish and the deploy are **one gap rather than two**, Step 9 names both halves and the single
merge they hang off, and *naming an event is not generating a workflow* — the sibling of the line that
already let it name an installer.

**A gate script was considered and rejected.** The tempting fourth script is one that answers *is this a
release commit* so a deploy job's condition is one call. It cannot be written without a CI fact: the honest
implementation compares this commit's versions against its parent's, and a default CI checkout is one commit
deep and cannot see the parent. So it would ship either wrong or with a `fetch-depth` baked in — a generated
workflow in everything but name, at the exact boundary §11.2 draws. **The gate is written down as an answer
and its condition is named; the job stays the user's.**

Three cells the new answer adds, in §11.5's numbering:

**C12 — *per phase* rested on a claim the event contradicts.** Its justification was *"a deployed app, where
each phase reaches users on its own"*, and under the event a landed phase has shipped nothing either. The
value survives; what it claims does not — it is about **what one changelog entry covers**, so it fits a
repository that cuts a release about as often as it merges. **This is the cell worth keeping: adding an
answer to a file re-runs the grid, it does not extend it.** The contradiction was in prose written three
sections above, and only re-reading the granularity answer against the new one found it.

**C13 — a command that lands work reports it as shipped.** Nothing told an agent that a merge and a deploy
are different events, and `done` plus a closed feature reads as live. The rule — **landing a change is not
shipping it** — lands in the stub, in `workflow.md`'s standing rules, and in the two commands that finish
work: report what the change is *waiting for*.

**C14 — the bump level stops being prose where a path deploys.** C3 moved the confirmation to where the notes
leave the machine because a wrong level is cheap until the release. Still true, and now the same sentence
says what it costs: for a deployed path, the level is what decides whether that app's version moves, which is
what deploys it. No mechanism changes — one sentence in column four of §11.3's table.

**An existing install hears about this through machinery that already exists.** Renaming the last section
makes `stubGaps` report it, `update` names it under **Next**, and `/onboard` is still the only writer. A test
pins that path by renaming the heading back and asserting the report.

**What was verified is the prose against itself.** 202 tests, eleven of them new, pinning the event, the
condition, the deleted section, the two failures, and the report each command owes. **The dogfood question
(§11.7) is untouched**, as it was by phase B: nothing here has been run by a live agent against a repository
that deploys.

### 11.11 The record — everything worked and nothing was written down

**The first field report of §11 running on a real repository, and it found the half §11.10 did not.**
`baldurpan/piff` opted into notes, wired a deploy, merged two pull requests — the second carrying the
version bump — and production updated. The tags page and the releases page were both empty.

**The answer file was not false, which is why nothing caught it.** §11.2's guard exists for *the answer
names a mechanism that is not on disk*, and this answer named everything correctly:

> | **What tags** | nothing — no tag is cut by any workflow, job or hook. `create-github-releases: false`, and `privatePackages.tag` is false |

and, in the same file, *"**Nothing tags or publishes**, and that remains deliberate rather than missing."*
Every word of that was true. **It was a faithful record of a decision this tool made on the user's behalf
and never put to them as a question** — and the word it turned on was *deliberate*. §11 had a name for an
answer that is false and no name for an answer that is true and wrong.

**The decision came from §11.8's first bullet**: *"A deployable app therefore needs versioning turned on and
tagging left off."* That bullet is headed *verified against the changesets docs*, and it was — against the
config reference, which describes `privatePackages.tag` neutrally. The vendor also ships a page named after
this exact problem, and it answers it: `{ version: true, tag: true }`. **Reading the reference page instead
of the page named after the question is how a default gets chosen by accident and then defended in prose.**

**What the prose defended was a question nobody had asked.** *A tag on a deployed app is the deploy's
business, and the deploy has a better thing to key on — that app's own version moving in the release merge.*
The second clause is correct and the gate is unchanged by any of this. The first rejects the tag **as a
gate**, which was never proposed. A tag is the **record**: which commit went live, and the thing a release
page hangs off.

**So §11.10's sentence was half-applied.** *There is one event, not one per artifact kind* fixed the
**trigger** and left the **record** per artifact kind — and the asymmetry is invisible from inside either
half:

| | What creates the tag | How it gets one |
|---|---|---|
| a published package | the publish command, which tags as a side effect | by accident, without anyone deciding |
| a deployed app | nothing in a deploy's path | it does not |

A repository that publishes therefore has tags without ever having chosen to have them, which is why the
gap reads as unremarkable from the publish side and is invisible from the deploy side, where **every
individual step reports success.** The notes were consumed, the version moved, the gate fired, production
updated. **It is the failure that looks like success**, and it surfaces the first time somebody opens a
page expecting to find out what is live.

**The correction is the other half of the same sentence: the record belongs to the event, not to the kind of
artifact.** Every path a release merge ships leaves a tag and a release behind, whichever of the two
consequences it got.

Four things moved:

- **`tag` follows `version` in `release-init`.** The command already asks the question that decides both —
  *is any of those private packages deployed?* — and threw half the answer away. Two flags, one question.
- **A fifth wire, `Release`.** The event's wires were Bump, Tag, Publish, Deploy: four acts and no artifact.
  Across the whole of §11 *a release* had only ever meant the **act**; the page someone reads — which is
  where a note finally reaches the audience column two of §11.3's table asked the user to name — appeared
  nowhere. A note mechanism whose entries are consumed into a file nobody opens is §11.10's *changelog
  generator* finding, one layer down.
- **The per-path table gains *Leaves behind*.** The column exists for the deploy-only repository, because
  that is the one which will otherwise fill in the table correctly and skip the record entirely.
- **`Tag` says why it is the empty line.** *Do not assume the publish step owns this* — the sentence that
  would have saved the field report.

**The command that creates the tags could not be named where it was needed, and the existing boundary
already had the place.** It is the *publish* command — which, where every package is private, publishes
nothing and exists only to tag. Nobody deduces that from a deploy's own vocabulary, and §11.7 forbids the
stub from saying it, since that prose is inherited by the Go and Python installs. §11.9 put the vendor in
`src/`, so `release-init`'s output says it, to the one audience that has already chosen the tool.

**Verified end to end against 3.0.2, on a repository this command configured** — not read from the docs,
which is what produced the bug. A note, `changeset:prepare-release`, then the publish command with every
package private: **0 published, tag `@fix/web@1.1.0` created**, and the `CHANGESETS_OUTPUT` stream carrying
`{"type":"git-tag","tag":"@fix/web@1.1.0",…}`. The publishing action's `runPublish` maps exactly that stream
to tag pushes and release pages, reading each package's `CHANGELOG.md` for the body, **with no filter on
private or published** — so a deployed app that never touches a registry gets a real release page carrying
the note that was written for it.

Two cells, in §11.5's numbering:

**C15 — a true answer can be the wrong answer, and no gate looks at those.** Everything §11 built checks
whether the file matches the repository. Nothing checks whether what the repository does is what the user
wanted, because that is not a property of the file — which is exactly why it has to be **asked** rather than
defaulted. The generalisation is not about tags: **where this tool picks a default the user never sees, the
answer file launders it into a decision they appear to have made.** The private-package question was already
asked out loud for `version` for this reason; `tag` rode along underneath it and inherited the appearance of
having been chosen.

**C16 — the sweep looked at workflows and not at the repository.** Step 9's four checks all read the tree.
Nothing looked at the **tags**, which is a one-command answer and the only place this defect is visible: a
repository that has been deploying for months with zero tags has never recorded anything, and the tree looks
perfect. A fifth sweep item reads them, and says in the words above that a working deploy does not answer
this question.

**One cost, taken deliberately.** `stubGaps` compares `##` headings, so an install already carrying
0.13.1's shape hears nothing from `update` about any of this — the change lives inside a section it already
has. Giving the record its own heading would trip the detector and is the wrong shape: the event and what it
leaves behind are one answer, and splitting them re-creates the failure, where a reader fills in the event
and never notices the record. **The file shape is not bent to suit the reporting instrument.** An install
still on the pre-0.13.1 shape is unaffected — it is reported for the renamed section already.

### 11.12 The gate a lie satisfies — and the flag that was missing on the other side

**The second field report, from the same repository, and it arrived as a complaint about a documented
step.** `piff`'s flow for closing a feature read:

> 1. `/feature-close` — pushes, opens the PR, writes this feature's note.
> 2. the script that consumes the notes — bumps, writes the changelog. Yours to type; nothing agentic runs it.
> 3. **the vendor's empty-note command** — keeps the note check green, since step 2 just ate every note.
> 4. commit and push. 5. merge; the gate sees the version move and it deploys.

Steps 1, 2, 4 and 5 are §11 working exactly as designed, including the part that matters most: **step 2 is
typed by a person.** Step 3 is a repository instructing its contributors to **write a note that describes
nothing in order to get past the note check** — and the user's word for it was *ridiculous*, which is the
correct reading and was not obvious from inside the design.

**The check was asking a proxy question and nobody had noticed it was a proxy.** From `@changesets/cli`
3.0.2, `dist/status.mjs`, the failure is one condition:

```js
if (versionableChangedPackages.length > 0 && releasePlan.changesets.length === 0) → exit 1
```

*Packages changed, and no notes are pending.* That is a proxy for **is this change described anywhere**, and
the two agree on every commit but one. On the release commit the notes are gone **because they became the
changelog** — the description exists, more permanently than before — and the check reads the same state as
a forgotten note. So the one push that owes nothing is the one push it fails, every time, and the escape
hatch the vendor documents for a genuinely unannounced change is right there in the error text.

**The generalisation is not about one vendor's exit code.** A gate that a lie satisfies is not a gate, and
the cost is not the red square: it is that everyone who hits the check learns that notes are **what you
feed a gate** rather than what somebody reads. That is corrosive to the one thing §11 exists to protect,
and it was written into a repository's own instructions as a numbered step.

**The condition that fixes it already existed, one section down.** §11.10's ship gate is *this path's own
version moved in this merge*. That is precisely *this commit is a release*, so the check needs no rule of
its own — it needs to read the one that is already there. A check with a second, independently-maintained
notion of what a release is will disagree with the gate eventually, and the release is where it does. The
stub's *What records a note* section now asks for the exemption where it already asks for the check's script
name, and the live rules gain **a note that describes nothing is never written to satisfy a check** — with
the instruction being *fix the check*, because reaching for the placeholder is the signal that the question
is wrong.

**This repository had the identical defect, unfired.** `release-note.yml` landed in 874c2fe, after the last
release, so it had never run on one. It resolves `SINCE` with `git describe` and the tag is cut by
`publish.yml` **after** the npm publish, minutes later — so on a release push it compares against the
*previous* tag, sees the changed package and zero pending notes, and goes red until something unrelated is
pushed. Not a race that usually lands well: deterministically red on every release. Fixed with the same
predicate, and the guard was exercised against real refs rather than reasoned about.

**The other half of the ask was a flag, and the rule already permitted it.** `workflow.md` forbids running
what bumps *"except when the user asks for it in that turn"* — and nothing said **what asking looks like**,
which left an agent to decide whether "and ship it" three messages back counted. `/feature-close --release`
is now that shape and the only one: a flag typed in the turn it takes effect, which lists every pending
note it is about to consume — other people's included — before running the script the *Bump* wire names.
No rule was deleted and no tool is named in a skill.

**The flag deletes a gap C3 was resting on, and that had to be said rather than absorbed.** C3 put the bump
confirmation in `/feature-close` because a level is free to correct right up to the release. Under
`--release` there is no gap: the level confirmed is the version that publishes and, for a path that
deploys, what puts the change in front of users on the merge. The reasoning survives, its conclusion does
not, and the command says so **while asking** — the same shape as C12, where adding an answer re-ran the
grid rather than extending it.

**What the flag does not do, and the temptation to claim otherwise.** It does not remove step 3. A release
PR has a moved version and no pending notes whoever typed the command, so only the check fix kills that
step — and the flag would otherwise have shipped as a convenience that automated a ritual instead of
retiring it. Worth stating because the ask arrived as *can we add a flag*, and the flag alone would have
looked like a fix.

**And then the correction did not reach the repository that reported it.** `piff` is an existing install,
and an existing install has three channels: tool-owned files, which `update` replaces; the stub, which it
does not; and `/onboard`, which rewrites the answer file. **The check is in a CI workflow, which is none of
them** — this tool has never written one and §11.2 says it never will. So the stub rule reached new installs
only; `stubGaps` compares `##` headings and this change adds none, so `update` would not even mention it;
and Step 9 swept five things, of which the check was not one. **The net effect of updating `piff` would have
been an agent that now refuses to write the empty note and a check that is still red** — the ritual removed
and the red square left, which is worse to live with than either alone.

**So Step 9 gains a sixth sweep item, which is C16's move applied to the check.** It finds whatever asks for
a note, reads what that does on the commit where the notes were consumed, and reports — rewiring nothing,
in the fourth item's words. It also looks for the tell rather than only the mechanism: **a workaround that
has become a documented step**, in contributing notes, release docs and `CLAUDE.md`, because that is the
form this defect took here and the form it will take again. And the *what records a note* answer now carries
the exemption, written as a gap where the check has none, so the file says something before the next person
decides an empty note is the way out.

**One limit, accepted rather than worked around.** This tool records an answer about a check it cannot
generate, cannot read at update time, and cannot enforce — and §11.2's refusal is what makes that permanent.
The gap between *the answer says the check exempts the release commit* and *the check does* closes only when
a person edits a workflow. The sweep narrows it to *somebody re-runs `/onboard`*, which is ordinarily
setup-time, so this is a report that arrives late or never. It is still the only channel there is. Written
down here so it is not rediscovered a third time as though it were new.

Four cells, in §11.5's numbering:

**C17 — a gate can be satisfied by something that is not an answer, and nothing in §11 looked at that.**
§11.2's guard asks whether the answer file matches the repository; C15 asked whether what the repository
does is what the user wanted. Both are about the *answer*. This is about the **check**: it was true, it was
wired, it ran, and its green state could be bought for one command. The tell is a workaround that has become
a documented step — **a ritual in a repository's instructions is a defect that somebody already paid for and
wrote down instead of reporting.**

**C18 — an exception with no named shape is an exception an agent will size for itself.** *Only when the
user asks in that turn* is a rule about consent with no surface: nothing said whether a sentence counted,
so every agent reading it drew its own line, and the safe reading (never) and the unsafe one (prose counts)
were equally available. Naming the flag is what turns it from a judgment into a fact.

**C19 — the dogfood gap is now the thing finding the defects.** §11.7 recorded that nothing here had been
run by a live agent; 0.13.2 came from the field and so does this. Both defects were invisible to 210
content tests because both were about a *question being asked at the wrong moment*, which no assertion over
prose can see. The transferable half: **this repository runs the release half of its own product, so any
defect in that half is reproducible here** — and this one was, sitting unfired in a workflow added six
commits ago.

**C20 — where a rule lands decides who ever sees it, and that is not a detail of packaging.** The same
sentence is inherited by every install if it is in a skill, by new installs only if it is in a stub, and by
nobody at all if the thing it governs is a CI workflow. §11 has put answers in all three without once asking
which population each reaches — and reach is what decides whether a field report produces a fix or a
better-documented defect. The rule: **when a correction comes from an existing install, name the channel
that carries it back to that install before calling it done.** Here the answer was *none*, and the sweep
item exists because asking produced it.

### 11.13 A wire that names a job which has never run — on disk, accurate, and inert

**The third field report, and the first where what was wrong was something this tool had itself written
down.** `piff` added a `record` job to `ci.yml` — the job §11.11 called for, the one that cuts the tag and
the release page a deploy leaves behind. It set one variable:

```yaml
  record:
    env:
      CHANGESETS_OUTPUT: ${{ runner.temp }}/changesets-events.ndjson   # job level
```

**The `runner` context does not exist at job level.** Verified against the vendor's context-availability
table: `jobs.<job_id>.env` allows `github, needs, strategy, matrix, vars, secrets, inputs`, while
`jobs.<job_id>.steps.env` allows those plus `job, runner, env, steps` — `runner` and `job` are precisely
the two that appear at step level and not above it. An unresolvable reference is rejected when the file is
**parsed**, not when the job runs, so the entire workflow became inert: no Gate 1, no deploy, no record, on
any branch, and every branch that merged `main` inherited it.

**None of that is this tool's to ship, and it cannot be.** `templates/` contains no YAML, nothing in `src/`
writes a workflow, and `runner.` appears nowhere in any template — §11.2's refusal to generate a release job
is what guarantees it. That refusal is unchanged and remains right.

**What is this tool's is the sentence `/onboard` wrote next.** Step 9's sweep read that file and recorded:

> | **Tag** | a git tag at the merge commit … Cut by `ci.yml`'s `record` job |

Accurate, complete, and describing a mechanism that could not run — written after the job was committed and
before it was ever pushed, so nothing had yet failed to contradict it. **§11.2's guard is *never name a
mechanism that is not on disk*. This one is on disk, reads correctly, and is dead.**

**It is structural rather than unlucky, and that is the part that generalises.** Because §11.2 refuses to
generate the release job, that job is **always** written by somebody else — and Step 9 then reads it back
as the source of truth for the answer file. Every install that does exactly what this tool tells it to do
passes through that gap. A new project can therefore end with a `release.md` describing a complete, correct
pipeline that has never executed once, and nothing in §11 would have said a word.

**So the sweep asks the question C16 asked about tags, about the job itself**: has it ever run, and what did
it leave behind. Three answers are written down rather than assumed — *never run* is a real answer and is
recorded as one; *ran* is evidence only of what it produced; and a workflow that fails to load is inert in
its entirety, which is the case the tree cannot show. The stub gains the same rule where the wires are
written: **a wire names something that has run, or says that it has not.** By shape, naming no forge and no
tool, the way the tags sweep already is.

**One debugging note, recorded because it was believed for twenty minutes.** *The run is listed under its
file path instead of its `name:`, so the file must have failed to load* is *not* evidence — in that
repository successful runs are listed by path too. What actually distinguishes a load failure is a run of
zero seconds, `total_count: 0` for both jobs and check-runs, and **a run existing at all for an event the
workflow's own trigger excludes** — a push to a branch that `branches: [main]` does not match, which can
only happen when the trigger itself could not be evaluated. The third is the decisive one and the least
obvious.

**C21 — a claim about a mechanism is not the mechanism, and this is the third field report in a row that
was exactly that.** C16: the file says tags are cut, and there are none. §11.12: the check asks for notes,
and asks a question that is wrong on the one commit that matters. This: the wire names a job, and the job
has never run. Each time the file was *true* and the repository was not in the state the file implied, and
each time the fix was the same shape — **make the sweep read the artifact rather than the description**.
The generalisation worth keeping is not about workflows: **everything §11 writes down is a description of
something else, so every answer in that file needs a way to be checked against the thing it describes, and
the ones that have no such check are the ones that will be wrong.**

## 12. `findings.md` is deleted — a second status vocabulary, and the drift it caused

> **Partly superseded by §14.** The severity scale and the gating stay deleted. The *destination* this
> section chose for a non-blocking note — the backlog, always — was one step too far, and §14 records the
> field report that showed it and brings back a file that gates nothing.

The file held "defects that outlive the session that found them", graded `P0`–`P3`, gated a phase from
`done`, and was swept at `/feature-close`. **It is gone.** A blocking defect is fixed, or it is the
`blocked` status the phase ledger already has a word for, or it is an issue. Nothing accumulates.

This section records the whole argument, because the first attempt at it was a repair rather than a
deletion and shipping that would have been the wrong call.

### 12.1 What the field found

`northguild/worktree` reached **35 open findings against five features whose issues were all closed and
shipped**, in a file of 1097 lines and 76 KB. Two rules, each correct alone, composed into it:

| Rule | Correct? |
|---|---|
| `/feature-close` refuses only on an open `P0` or `P1` | **yes** — that is what the severities meant; a `P2` was never meant to block |
| its findings step moved out the ones that were **closed** | **yes**, as far as it went |
| a finding closes when the gate that raised it re-passes | **yes**, and it is what kept "fixed but unverified" out of the vocabulary |

An open `P2` therefore walked through the retirement untouched and could then never close — its gate
belonged to a phase that no longer existed. No owner, no exit, nothing red.

**And the clutter was not the cost.** At 76 KB the file exceeded a tool output limit and came back
**truncated**, so the gate that asks *is an open `P0` or `P1` tied to this phase* was answering from a file
it had not seen all of. **An unbounded file does not get untidy; it silently disables the check it exists
for.**

### 12.2 The repair that was built first, and why it was not enough

The first pass widened `/feature-close` from *sweep what is closed* to *dispose of everything tied to this
feature*, with three dispositions — **closed**, **withdrawn**, **promoted** — a `check` rule faulting an
orphan, and a migration notice in `update`. It worked, and every acceptance test for it passed.

**It bounded the tail and left the accumulation.** An eight-phase feature could still carry thirty `P2`s
through its whole life, read by every phase, going stale as the code moved underneath them — and the fix
only guaranteed they were cleared at the *end*. The drift complained about happens during the feature.

It also cost a triage ceremony at every retirement, for objects that are mostly noise, and needed a
vocabulary of three dispositions to describe what happens to them.

### 12.3 The question that settled it

**What does `findings.md` do that something else does not already do?** On paper it had two jobs:

| Job | Already done by |
|---|---|
| survive a session that dies | the ledger row, which opens to `in progress` **before any code** precisely so an interruption is survivable, and closes to `blocked` with a Note |
| block `done` | `done` already means *the scope landed and both gates passed*. An open blocker means the gate did not pass, which means the row is not `done` |

Both are duplicates. `/feature-close`'s second refusal was a duplicate of its first for the same reason:
every phase `done` already implies no blocker survived.

Strip the duplication and three things were left over:

1. a defect found in phase 5 against phase 3's already-`done` work
2. a capped `/orchestrate` gate, where there is no ledger at all
3. the pre-loopback write — recording a `FAIL` before attempting the fix

**(1) has a better answer sitting unused in the existing vocabulary: set phase 3 back to `blocked`.** That
is more honest than a side-file asserting *phase 3 is done and also broken*, and it puts the fact where the
next agent is already looking. **(2) is handed back rather than filed** — a commit-sized change that cannot
pass its gates leaves its work in the tree, its account in the report, and an issue if it is still worth
doing. **(3) survives as the ledger row being written before the escalation**, which was always the real
content of *escalating is not a substitute for recording*.

What is genuinely lost: if a loopback succeeds on its second attempt, nothing durable records that it
failed once. That is process telemetry, not a defect.

### 12.4 The severity scale goes with it

`P0`–`P3` was a **second status vocabulary laid across the ledger's four**, kept in sync by discipline —
which §2.2 says is exactly the thing this design does not do. Its only load-bearing question was *does this
block the phase*, which is one bit, and the other three values were the problem: **`P3` — "a note worth not
losing" — is the category that grew without bound.** A note nothing acts on is read by every later phase,
against code that has moved.

So a review verdict now marks each item **blocking or not**, and the caller has one question to answer from
it: loop back, or not.

**The field cleanup is the evidence that severity was the wrong axis.** Triaging those 35 by severity was
tried first and is indefensible: several `P3`s were real user-facing bugs, one of which overwrote a stored
credential. What worked was kind — user-visible and *a regression would land green* became issues, internal
notes were dropped. A grade assigned to answer *does this stop the phase* tells you nothing about *is this
worth keeping*, and having it in the file invited the second question to be answered with the first
question's answer.

### 12.5 What replaces it, in one table

| The thing found | Where it goes |
|---|---|
| blocking, and the loopback fixes it | nowhere — there is nothing left to record |
| blocking, and the gate hits its cap | the phase's ledger row: `blocked`, reason in the Note |
| blocking, and larger than this phase | an issue, per `tracking.md` |
| not blocking, and it needs code changes | an issue |
| not blocking, and it does not | the run's report, and it dies with the session |

`/feature-close` keeps one refusal instead of two. `/feature-status` reports `blocked` rows instead of open
findings. `check` loses two rules and the whole `Finding` parser. The `merge=union` question for
`findings.md` disappears, and `tracking.md` loses *a finding is not an issue* — there is no finding to
distinguish from one.

**Two lines outlived the deletion by four versions**, found while §10.14 was being written: `/feature-status`
still printed a `Findings: <n> open (<severities>)` row in its report block, and `/feature-implement` still
listed *findings written or closed, by id* in its own report — both asking for counts out of a file nothing
writes, in a severity vocabulary §12.4 removed. The test that guards this searched for the string
`findings.md`, which neither line contains. **A deletion test that matches the path misses every reference
that never needed the path**, which is the general form worth keeping.

### 12.6 Migration — reported, never removed

`findings.md` is project-owned, so it is outside the manifest and **no code path in this tool may delete
one** (§4.1). What this version dropped is the file's *role*. So `update` says exactly that — the file is
no longer read, how many entries are still in it, where the rule went instead — and leaves it alone.
`stubs.ts` gained `retiredFiles()` for it, which generalises to anything else this tool stops shipping.

**Triage it by kind, not by severity** (§12.4): user-visible and *would land green* become issues,
internal notes go. Then delete the file.

### 12.7 The lesson, which is not about findings

**A file whose invariant is maintained by discipline has no invariant.** *"This file must not grow for the
life of the project"* was in the shipped template for every version, enforced by nothing, and false within
five features of real use.

But the more useful half is the one that took three passes to see: **the first instinct was to repair the
sweep, and the sweep was not the problem — the second vocabulary was.** A defect the gates found always had
a home in the ledger, and the file existed because nobody asked what it did that the ledger did not.
Before bounding a store, ask whether anything should be in it.

---

## 13. The two quality holes, which are not the same hole

Asked whether the workflow was missing anything for quality — accessibility, performance and the like — the
answer turned out to be two unrelated gaps with one symptom. **The rules were already there; nothing asked
for them, and a project that had a real check had nowhere to write it down.** Neither is a missing standard,
which is why nothing under `templates/standards/` changed: that tree is vendored (§6.3), and it already says
in as many words that accessibility is part of the definition of done.

### 13.1 The conditional table is keyed on a question nothing asks

`standards/README.md` loads on *if the task involves…*. Most of its rows answer themselves — a file is
TypeScript or it is not, there is a form or there is not, the task is a refactor or it is not. Three do not:
**accessibility, performance and security are properties of the change that the reader has to have thought
of before they open the table.** So the row saying accessibility is not optional is reached only by somebody
who had already agreed, and a change that quietly has one of those surfaces never reaches it at all.

This is §2.9 again with a worse ending. Documentation got a standing rule, a plan section and the sentence
*"nothing here describes this feature" is an answer and silence is not* precisely because **no gate fails**
when a README goes stale. No gate fails when a control cannot be reached by keyboard either; a linter
catches a fraction of it and nothing catches the rest; and the person it fails is not the person who shipped
it.

So it ships the same way: a standing rule in `workflow.md`, cited by `/feature-plan` and `/orchestrate`
rather than restated, answered out loud, with *none of these* a legitimate answer and silence not. **A
surface that is found reaches the work exactly as a documentation row does** — the standards rows it loads
become the review expectations on the phase that carries it, and what proves it goes in §8 Verification.
For something a person operates that means an **end-to-end pass in a real browser**, and where the project
has no driver for one that is an open question in §9, not an invention.

**No template names the driver.** Which tool drives a browser is `verify.md`'s answer like every other
command (§4.2), and a winner hardcoded into a template is a stack assumption baked into a tool that installs
everywhere — the failure mode §7.1 was written about. A test now bans the eight obvious names outright,
because a ban is only real if a test enforces it.

### 13.2 Gate 1's four headings were a list that read as a schema

`verify.md` shipped Lint / Typecheck / Build / Test and the workflow said *run its sections in order* naming
those four. Nothing in the code has ever parsed that file — `check` does not read it — so the four were
prose all along, and prose that a reader takes as the complete set.

The consequence is small and bad. A project with an end-to-end suite, an accessibility pass, a size budget
or a coverage floor has two places to put it, and **both are wrong**: stretched into a heading it does not
belong in, or exiled to *Not run by Gate 1*, whose comment named Docker and deploy targets and so read as a
graveyard. Either way the gate reports green for a change that broke a check the project actually owns.

The fix is one sentence of definition: **Gate 1 runs every section above *Not run by Gate 1*, in order** —
the four first, then whatever that file adds. The four stay because they are what every project has, not
because they are the limit. What decides where a check goes is **whether the gate can afford it on every
phase**, which is a cost question rather than a taxonomy one, and `/onboard` Step 7 now asks it: what else
does this project run, and can a phase pay for it. A browser-driven run usually cannot — it needs a server,
a build, minutes — so it lands under *Not run by Gate 1*, which now has to **name what does run it.** That
last requirement is the point of the section: without the name it records a check nobody runs, which is a
different and much worse fact than a check this gate does not run.

Step 7 also gains the one targeted question, because it is the check most often configured, run in exactly
one pipeline, and written down nowhere a per-task gate can see: **ask for the end-to-end run wherever the
project has a user interface.**

### 13.3 What was refused

**A per-dimension scorecard.** Accessibility as its own status, a performance budget report, a severity per
dimension. That is §12 arriving by a new route: a second vocabulary laid across the ledger's four states,
kept in step by discipline. A review item is blocking or it is not, and nothing here changes that.

**A seventh project-owned stub.** *Does this project care about WCAG AA* looks like an answer in the shape
of `verify.md` and is not one: the standards tree already answers it, and the gap was never that the answer
was missing.

**Any edit to `templates/standards/`.** It is vendored verbatim from a pinned ref, and an edited file there
hands the whole tree over to the user on the next update. New standards content belongs upstream.

### 13.4 The OWASP Top 10 is a taxonomy, not a standard

Asked whether the Top 10 should be part of the coding standards. **No as a document, yes as four words of
trigger**, for three reasons that stack, and the useful half is the third.

**It is not this repository's to add.** §13.3 above refused any edit to `templates/standards/` for a
reason that has not changed: the tree is vendored verbatim from a pinned ref (§6.3), so a
`security/owasp-top-10.md` written here costs every install its managed standards on the next update.

**Upstream it would be nine-tenths restatement.** Mapped against the four `security/` files plus
`tooling/`, nine of the ten already have a home — broken access control and auth failures in `auth.md`,
injection in `api-security.md` and `validation.md`, misconfiguration in `api-security.md`, crypto and
secrets across `auth.md` and `secrets.md`, vulnerable components in `dependencies.md` and `ci.md`,
logging in `observability.md`. **Only SSRF had nothing** — the word did not occur anywhere in the tree.
A file whose nine-tenths restates four others is two places that have to agree, and the copy organised by
breach statistics rather than by what a developer is doing is the one that drifts. It is dated by
construction too: the list is revised every few years, which is a second staleness clock the pinned ref
does not cover. The mapping above is against the 2021 list and was not verified against the current
revision; it is the shape of the argument, not a citation.

**And it does not fix what it looks like it fixes.** §13.1 found that the security row is reached only by
somebody who had already concluded the change was security-relevant. **A fifth file behind the same table
is reached exactly as rarely.** What reaches the work is the trigger in the standing rule, so the shipped
change is an addition to that enumeration — *a URL the server will fetch* — and not a document. The
enumeration lives in exactly one place; `planner.agent.md`, `/feature-plan` and `/orchestrate` name the
shape and cite the rule rather than restating the boundaries, so one edit covers all four.

The SSRF content went upstream into `security/api-security.md`, beside SQL injection, in that file's voice
and with its own limits stated: resolve-then-connect loses to DNS rebinding, so the allowlist is the real
answer and the check is the fallback. `net.BlockList` and `dns/promises.lookup({ all: true })` were
verified against the Node v24 API documentation, including that an IPv4-mapped address matches a v4 range
only when checked as `ipv6`.

**The general rule, which is the reusable part:** a published list of risks is an index into standards,
not a standard. Ask what it names that the tree does not say, add that one thing where the tree already
talks about its neighbours, and put the rest of its value into the question that gets the tree opened.


---

## 14. The cheap end comes back as a file — `notes.md`, and what §12 removed one step too much of

§12 deleted `findings.md` and sent everything that survived into the backlog. The deletion was right; the
destination was not. It took five versions and two repositories for the difference to become visible.

### 14.1 The field report — one install, two outcomes

`dynjandi-dev/dynjandi-core` and `baldurpan/piff` both run this workflow, both on the tracker answer, both
dispatching Gate 2 to the `reviewer` subagent. Their backlogs on 2026-09-15:

| | Feature issues | Finding issues |
|---|---|---|
| `piff` | 25, every one a kebab-case feature name | **0** |
| `dynjandi-core` | 8 | **20** — 9 from one feature's gates in a single day, 11 from the `findings.md` migration |

Same install, same substrate, same executors, opposite behaviour. **The rule was enforced by nothing but
the reading of whichever session ran it**, and had been shipping as though it were a mechanism.

Nine of the twenty carry the backlog label, so `/feature-plan` ranks them as features — each due a plan
document and a phase ledger for what `workflow.md` itself calls a task. The other eleven carry `bug` only,
which puts them outside the backlog by `tracking.md`'s own definition, so nothing in the workflow will read
them again. **That second batch has no owner in this tool at all:** no skill handles `findings.md`, so
§12.6's migration instruction was carried out by hand and nothing told it to apply the label.

### 14.2 §10.5 had already decided this, the other way

§12's argument is about the **severity scale** and the **gating**, and both halves hold: `P0`–`P3` was a
second status vocabulary, and an unbounded file that a gate reads silently disables the gate.

Neither is an argument about file versus tracker — and §10.5 had settled that one:

> `findings.md` does not move either… a finding is **branch-scoped by construction** and nets to zero
> within one branch's life, so it is never the thing two agents contend over. The escape hatch is written
> down rather than inferred — **a finding that outlives its branch is promoted to its own issue**.

Delete the file and promotion is the only remaining path. **The exception became the rule**, and no diff
said so, because the sentence that would have said it was the one being deleted.

### 14.3 What the valve actually admitted

`workflow.md` said a non-blocking observation dies with the session *"unless it needs code changes, in
which case it is work."* **Every true observation about code needs code changes.** The condition admitted
essentially everything, which is not a bar.

The incentive ran one way too. Filing costs the writer one `gh issue create`; reading costs the user.
`/feature-implement` §13 then asked the run to report *any issue filed for one* — so filing read as
diligence and restraint was invisible. **A filing rule with no bar transfers cost from writer to reader**,
and this one had a reporting line rewarding the transfer.

### 14.4 The bar was already written down, in §12.4

§12.4 recorded what worked when the 35 field findings were triaged by hand:

> What worked was kind — user-visible and *a regression would land green* became issues, internal notes
> were dropped.

Validated against 35 real defects, and **never written into a template** — it survived only as a
description of a cleanup. It is now the Gate 2 rule, and it decides **promotion**, not whether a thing gets
written down at all. That is a far easier judgement: a line in a branch-local file is cheap and reversible,
and a backlog issue is neither.

### 14.5 The file, and which objection each property kills

`context/notes.md`, with three properties, each aimed at something that actually went wrong:

| Property | What it kills |
|---|---|
| **Nothing reads it** — no gate, no command, no `check` rule | §12.1's real disaster, which was never clutter: at 76 KB the file came back **truncated** and the gate reading it was answering from a file it had not seen. A check that does not exist cannot fail silently |
| **No severities, ids or statuses** | §12.4's second vocabulary. The blocking bit is decided upstream at Gate 2, and only non-blocking notes reach the file |
| **`/feature-close` deletes it whole** — no triage, no dispositions, no sweep | §12.2's ceremony and §12.7's discipline. *Nets to zero within one branch's life* becomes a property of the lifecycle instead of a rule somebody has to keep |

**No stub; it is never installed.** The first note creates it. A file the installer puts on the default
branch is a file every branch edits in common — the merge surface the old one had. A file that exists only
inside a branch which then deletes it has no merge surface at all.

**It rides the phase's commit**, like the ledger row. Leaving it untracked buys a guarantee it does not
need and costs the note its visibility in the diff, which is the one place a person was going to see it —
and `git add -A` would sweep it in regardless.

**`/orchestrate` writes none.** It has no branch and no close, so nothing would ever delete one: a file
only that command wrote is exactly the file that outlives every branch.

### 14.6 Rejected

**One file per note in a `notes/` directory.** Proposed against merge conflicts, and the premise does not
survive the lifecycle — §4.5 had already predicted `findings.md` would net to zero for precisely this
reason, and the old one failed that prediction only because its sweep did not work. What the directory buys
is insurance against `/feature-close` not running, paid for in the thing this whole section is about: **a
note in a folder is an object with a name; a note in a list is a line among others.** Nine files read as
nine obligations for the same reason nine issues did.

**A `check` rule faulting the file on the default branch.** Offered as cheaper insurance than the
directory, withdrawn on inspection. `runChecks` is pure-filesystem and fixture-testable by design; the rule
needs git to know which branch it is on; and under the tracker answer — where both field repositories are —
`check` has no local state to hang it on. The variant that parses the file to find orphaned notes re-adds
the `Finding` parser §12.5 was glad to be rid of. **A store should be unable to accumulate, rather than
watched while it does.**

**Purging on a schedule.** *Every now and then* is §12.7's discipline under another name, and §12.2 already
built the scheduled version — a sweep at retirement, three dispositions, a `check` rule for orphans, every
acceptance test passing — and rejected it for bounding the tail while leaving the accumulation. A purge
needs a trigger, and `/feature-close` is one that already exists and cannot be forgotten without the
feature staying open.

### 14.7 The lesson

§12.7 said: *before bounding a store, ask whether anything should be in it.* The half it did not say is
this one. **When a store is deleted its contents go somewhere, and that somewhere is a design decision even
when nobody makes it.** §12 made the deletion and left the destination to a clause that already existed for
the rare case. The rare case was then asked to carry everything — into the list the user actually reads —
and it did what any unbounded destination does.


---

## 15. A bug is the third category — and why `findings.md` could never close one

§14 fixed how much Gate 2 files. This fixes **where it files it**, which is the half that produced the
complaint in the first place: a list of features with fourteen defects ranking inside it.

### 15.1 `findings.md` was gate state, not a bug list

Asked whether holding real bugs was ever the point of that file, the answer is in its own shipped contract:

> **Tied to.** Either a phase — `<feature-name> Phase <n>` — or `ad-hoc`.
> **Gating.** An open `P0` or `P1` tied to a phase blocks that phase from being marked `done`.
> **Closing.** A finding closes when **the gate that raised it re-passes**, citing that run.
> **Bound.** This file must not grow for the life of the project.

Phase-scoped, gating, closed by a gate re-running, and required not to grow. **A bug tracker is the
opposite on all four** — repository-scoped, gating nothing, closed when a fix ships, and growing as long as
there are bugs.

### 15.2 And that is why it failed, more precisely than §12 said

`P2` was defined as *"a real defect that does not block."* Apply the closing rule to it. Non-blocking means
its phase's gate **already passed** — so there is no gate left to re-pass. **A real bug could never close.**

§12.1's 35 open findings against five shipped features were not neglect, and not really a severity problem
either: **two of the four severities named things the machinery could not dispose of.** `P2` was a bug and
`P3` was a note, sitting in a mechanism built for the two values a gate could re-check. §12 read the
symptom — an unbounded file and a second vocabulary — and deleted the file, which was right. §14 gave `P3`
a home that expires. This section gives `P2` the one it always needed, which was never this workflow's to
provide.

### 15.3 The line that routed defects into the feature backlog

`/feature-implement` §9 said a qualifying finding *"belongs in the backlog per `tracking.md`"*, and
`tracking.md` says the backlog is the issues carrying the label. A gate reading both together does the only
thing it can: **applies the label itself.**

That skips `/roadmap` entirely — and `/roadmap` is where the worth-adopting test lives (*adopt it only if
you would want a history row for it; an issue smaller than that is `/orchestrate` work — never labelled,
never in the backlog*) along with the `Priority:` line the ranking reads. The shapes are visible in the
field:

| Origin | Title | `Priority:` | `Size:` |
|---|---|---|---|
| `/tracking-migrate` | kebab-case name | yes | yes |
| Gate 2 | a prose sentence | **no** | **no** |

So the gate was appending to the backlog while skipping the one test that decides whether something belongs
there, and producing entries missing what ranks them. **The rule is now that a gate never applies the
label.** Where a finding really is a feature, the gate names `/roadmap` and stops.

**Stated as an invariant rather than a prohibition: nothing enters the backlog except through `/roadmap`.**
Three commands write the label and a flat *only `/roadmap` may* would break two of them for no gain —
`/tracking-migrate` carries an existing backlog out of the working tree onto the tracker, and
`/feature-plan` splits one entry already in it into several, writing the `Size:` and `Priority:` an entry
needs. **Neither admits new work**, so the worth-adopting test is still applied exactly once per entry, at
the only moment anyone is deciding whether to have it at all. A fourth writer would be a way in that skips
that decision, which is precisely what the gate had become.

The guard is a test rather than prose, and it distinguishes reading from writing: *"the open issues
carrying the backlog label"* is how half these commands find the backlog, so only a sentence that both
names the label and applies one is a violation — and only if it is not a refusal.

### 15.4 `/orchestrate #<issue>` — the route a bug had no way to take

Naming the category is not enough on its own, because a task-sized defect had nowhere to go *through*. The
loop had two shapes: a feature, which is planned, and a task, which `/orchestrate` runs and which is not
written down at all. A bug is recorded and not planned, and `/orchestrate` only took prose — so the tracker
and the work never touched, and closing the issue was a separate act somebody had to remember.

The second usage form reads the issue as the brief and puts `Closes #<issue>` in the commit, so the close
rides the change the way `/feature-close` already makes it ride a pull request. It refuses an issue
carrying the backlog label, since that one is a feature whatever its size looks like from here. **It adds
no vocabulary** — it works on `bug`, on `enhancement`, on an unlabelled issue, on whatever the project
already uses.

### 15.5 Rejected — a `workflow:task` or `workflow:bug` label

Proposed as the obvious home for the category. §10.4's test refuses it: **does the primitive let a fact be
observed, or does it require a stored copy someone maintains?** It admitted two stored labels and §10.10
has since killed one. A second ownership label fails twice — **nothing would read it**, and the only
candidate reader is `/orchestrate`, which would then have a queue. `workflow.md` calls that command the
ad-hoc escape hatch; an escape hatch with a queue needs ranking, then priority, and is Tier 1 with a
different name.

**The project's own bug label already is the answer.** `tracking.md` has always said the workflow leaves a
project's labels alone and reads exactly one bit. What was missing was never a label — it was the sentence
saying a bug is outside that bit, and a command that could act on one.

## 16. The audit question — two homes that existed, and one axis that did not

Asked whether the workflow needs an auditing skill, or an agent that runs a dependency audit and files what
it finds into the roadmap. **Both halves were refused by rules already on the books, and the residue was
two sentences.** The section is worth keeping for the refusals rather than for what shipped.

### 16.1 Rejected — a skill

A dependency audit is named after one ecosystem's tool, and this package installs into repositories that
have no such tool. That is **§11.9's argument verbatim**: a skill named after a JavaScript command is
inherited by every Go and Python install, where it is nonsense, and its own `name:` line is what the
neutrality tests exist to catch.

Written neutrally instead, the skill's entire body becomes *run this project's audit command* — and **§4.2
already owns that string**. `verify.md` is the one home for a command, the test enforces it, and a skill
whose whole content is a pointer at a file the gates already read has nothing left in it.

### 16.2 Rejected — an agent that files advisories into the backlog

**§15 is the commit before this one, and this is the same defect arriving from outside.** A gate was applying the
backlog label to real defects, one repository reached fourteen of them ranking against its actual roadmap,
and the invariant that came out of it is *nothing enters the backlog except through `/roadmap`*.

An auditor filing advisories is that shape at machine speed: one run against a mid-sized lockfile emits
dozens of entries, most of them transitive and many unreachable, none carrying the `Size:` or `Priority:`
the ranking reads, none having met the worth-adopting test. **§15.3's fourth writer, wearing a schedule.**
An advisory is a bug, and §15 routed bugs already — the project's own bug label, and
`/orchestrate #<issue>` to act on one.

### 16.3 The two questions the word was hiding

*Does this change introduce a vulnerability* is change-triggered, and §13 built the home for it two versions
ago: a heading of one's own in `verify.md`, or a line under *Not run by Gate 1* naming what runs it. Nothing
new was needed. **What was missing is that `/onboard` Step 7 never mentions the category** — its examples
are an end-to-end run, an accessibility suite, a size budget, a coverage floor, a visual snapshot. A project
never asked never answers, which is §13's own complaint one row down.

*Did the world change under a dependency nobody touched* is time-triggered, and the loop has no such shape:
every command here is keyed to a change. **That stays out, and §11.2 is why** — this tool ships no YAML and
generates no job. The ecosystem's watchers run on a clock, file natively, and usually arrive as a lockfile
change that never enters the loop at all.

### 16.4 Cost was the wrong axis, and it took this case to show it

Step 7 sorts a check by **whether Gate 1 can afford it**, and `verify.md`'s rule says the same. A dependency
audit is cheap — seconds — so both files sort it into a gate section, and both are wrong. **It turns red
when an advisory is published against a lockfile nobody touched**, so a gate that runs it blocks the next
phase for a condition that phase did not cause, and the phase's only way out is a fix nobody planned.

So the sort is two questions and had one: **cost first, attribution second.** The general form is worth
more than the case — *a check that can fail with nothing in the diff is not a phase gate, however fast it
runs* — and it is the first entry in `verify.md` whose section is decided by something other than the
clock. The exception is stated rather than assumed: a project that holds the check clean as a standing
invariant has decided that a red one **is** this change's problem, and there it belongs in a gate like
anything else.

**The four gate headings never needed this rule** because none of them can fail without a diff. That is why
the axis was missing rather than wrong: §13 opened the file to checks the four do not cover, and this is the
first one that fails on the calendar.

---

## 17. The reading budget — what a command loads before it touches code, and the model it loads it on

Asked what the tool could do better, where it was inefficient, and where tokens could be cut without losing
quality. The answer was measured rather than argued, and it turned out to be about three kinds of prose that
rode every invocation while being needed on only some of them: the answer a project did not choose, the
reasoning behind a rule, and the guidance for filling a stub once. None of the three was a rule, so none of
the cuts touched one.

### 17.1 The measurement

Sizes are bytes divided by four. That is an approximation, not a tokenizer, and it is the same approximation
before and after, so the ratios hold even where the absolute numbers do not. What the orchestrating session
read before opening a source file, for one `/feature-implement` phase on the working-tree answer with the
stubs as shipped:

| Read | Before (bytes) | After (bytes) |
|---|---|---|
| `feature-implement/SKILL.md` | 28,117 | 20,668 |
| `workflow.md` | 26,627 | 20,656 |
| `release.md`, shipped answer | 18,973 | 7,313 |
| `tracking.md`, shipped | 18,132 | 17,328 |
| `git.md`, `executors.md`, `verify.md` | 17,477 | 12,605 |
| Total | 109,326 | 78,570 |

A 28% cut on the shipped files, and more on an install that has run `/onboard`, because the tracker
subsection of `tracking.md` is deleted there under the tree answer and its 12 KB is most of what did not
move. The standards are on top of that: the conditional table's always row plus a TypeScript-and-React
task's rows come to about 27 KB, and §1.1's test B had Codex load eleven files from that table unprompted.

The larger cost was not in the table. Under the shipped executor answers the coder ran in-host, so every
one of its tool calls re-sent the orchestrator's whole context, and under `--all` that context grew phase by
phase. A coder making thirty tool calls inside a 100K-token context re-reads about 3M tokens from cache; in
its own 25K subagent context it re-reads about 750K. That multiplier was set by a default, not by the
design, and it is the first thing §17.4 changes.

### 17.2 Three relocations, one principle

**Prose that only some invocations need does not ride every invocation.** Each move is a relocation, not a
rewrite — the moved text is verbatim, and a test that pinned a phrase now reads the file it moved to.

- **`tracker.md` beside five skills.** The *Under the tracker answer* section was 65% of `/roadmap`, 50% of
  `/feature-plan`, 39% of `/feature-status`, 27% of `/feature-implement` and 21% of `/feature-close`, and a
  repository on the working-tree answer read all of it on every invocation for an answer it had not chosen.
  It now sits in a supporting file the body names in its lead sentence, opened only where `tracking.md`
  names the tracker. A repository on the tracker answer reads both files, the same text in two places, so
  the cut is neutral there and it is the working-tree answer that gains. The installer walks each skill's
  directory rather than naming `SKILL.md`, so the supporting file lands in both trees and is hashed like the
  body.
- **`<stub>.notes.md` beside each of the six stubs `/onboard` fills.** §7.2 split `plan-template.md` from
  its notes so that copying the template never shipped the guidance with it; the stubs never got the same
  split, and their HTML comments were guidance for a command that runs once, paid for on every read. A
  file-read tool does not strip comments. `release.md` was 62% comment and is read by every command that
  lands code and by the reviewer, and under the shipped answer nothing ever deleted the comments.
  `executors.md` was 51%. The stubs now hold answers; the notes hold what each section takes and the
  alternative answers as copy-ready text, and `/onboard` names the notes file at each step. Every `##`
  heading in every stub is unchanged, so `stubGaps` reports nothing to an existing install. One side effect
  is an improvement §4.6 asked for and could not have: the guidance is now tool-owned, so `update` can
  correct it, where before it lived in a project-owned file the updater was forbidden to touch.
- **`workflow.notes.md` beside `workflow.md`.** Every command cites `workflow.md` and the block in
  `AGENTS.md` says to read it first. Each standing rule was a blockquote followed by two to six paragraphs
  of why, and the section on what happens to a defect the gate found was a third of the file and mostly the
  history of §12. The rules stay — every blockquote verbatim, the tables, the gate contract, and one or two
  sentences of consequence per rule — and the history, the rejected alternatives and the argument move. The
  target was 14–16 KB and the result is 20.7 KB, because the content tests pin more of this file than any
  other and pin it there on purpose: *the rule has one home, and it is the file every command already
  cites*. Moving a rule to satisfy a size target would have been the failure the test guards, so the rules
  were kept and the target was missed. It is recorded here as a missed target rather than restated as a
  goal.

A fourth cut was proposed and mostly refused by the tests. The Gate 1 contract was restated in full in
`workflow.md`, `verify.md`, `/feature-implement` and `/orchestrate`; the two skills now cite the contract
and keep only what is theirs. The test *every place that names the order says where the list ends* keeps
the *Lint → Typecheck → Build → Test* line in both, deliberately, and the bug-is-not-a-backlog-entry rule is
pinned in each gate that applies it for the same reason. What survives of that cut is small, and the
0.17.0 patch note is why it was worth doing at all: two report blocks went on asking for findings and
severities after 0.12.0 deleted them, which is a restated copy going stale exactly as §2.5 predicts.

### 17.3 The plan traverses the standards table once

Three readers traversed the conditional table independently — the planner, the coder's brief said to load
per the table, and `reviewer.agent.md` said the same — and §1.1's test B shows what a fresh traversal
produces: eleven files for a task that needed three to five. The planner already had to cite specific rules
in each phase's checklist, so it already knew the answer. Each phase section in `plan-template.md` now
carries a `Standards:` line — that phase's rows of the table, the always row included, and the rows the
surface question in §13 added, which are the ones a table read misses — and the coder brief and the reviewer
read that line instead of the README. The reviewer still opens and quotes every file it cites, so its
independence is intact, and it opens the table where the change plainly reached something the line does
not cover. A plan written before phases carried the line has none, and both readers fall back to the table.
`/orchestrate` has no plan and still reads the table itself.

### 17.4 The executor defaults, reversed

§4.6 shipped the weakest answer for both executors and said so: in-host for the coder, self-review for the
reviewer, with the subagent answer available to anyone who ran `/onboard` and chose it. The skills already
carried the sentence that reaches a host's subagent mechanism without naming it — *a coder subagent if your
runtime provides one* — so the shipped stub was overriding a fallback the skills already had. The stub now
ships the subagent answer for both, with in-host and self-review as what a runtime without the mechanism
reads, in the stub's own words.

**The coder's tier is written in the Coder answer, and it is `sonnet`.** A subagent had no model anywhere:
in-host it was the session model, and as a subagent it was the generic one, which resolves to the session
model unless something says otherwise. Three homes were considered. A `coder.agent.md` with `model: sonnet`
is what §4.6 rejected and the reasons stand — *coder* is the description most likely to fire on *write this
for me* and agents have no `disable-model-invocation`. The skill's own frontmatter is the orchestrator's
model, not the coder's. So the tier is part of the dispatch answer, project-owned, one home for dispatch,
and the two skills that dispatch say *on the model tier that file names, where your runtime lets you choose
one*. That rubs against one of `executors.md`'s own standing rules — take the model from the executor's own
config, never from a flag written here — which is right for an external CLI and has no object for a
subagent, so the exception is written beside the rule rather than left implicit: as an alias the runtime
resolves, never a dated model id. `executors.notes.md` carries one optional line a project may add: on a
loopback, re-dispatch on the reviewer's tier rather than retrying the same one, because a phase that reaches
the cap costs more than one strong run would have.

**Existing installs keep their answer.** The stub is project-owned and `stubGaps` reports headings, not
content, so an install that recorded in-host stays in-host until somebody changes it. That is the same
property that makes a private executor safe to wire in: an MCP tool or a CLI named in `executors.md` is
outside the manifest, `update` cannot reach it, and `/onboard` — which used to re-ask Steps 2 and 3 on every
re-run — now reports a section that holds something other than the shipped answer and leaves it alone
unless asked. The public templates name no executor, which the host-name test already enforced; the seam
for a private one was always the third answer, and the only change it needed was the word *CLI* becoming
*executor, a CLI or a tool*.

### 17.5 A model per skill, and the turn it holds for

The Claude Code copy of each skill already differed from the shared body by one injected frontmatter line.
The same transform now injects two more, `model` and `effort`, from a map in `layout.ts` keyed by the
skill's own `name:` line, so the shared body stays runtime-neutral and the `.agents/` copy is untouched.
Every command's orchestration runs on `sonnet` — picking a row, writing a brief, running Gate 1, writing the
row back is bookkeeping — except `/onboard`, which runs once and whose wrong answer costs every later run.
`/roadmap` and `/feature-status` run at low effort (§30 later takes `/roadmap`'s tier off altogether), the
rest at medium, `/onboard` at high. The planner and reviewer agent files move from `model: inherit` to `opus` at high effort, which reverses a decision the
PLAN.md table recorded as cheap to reverse: aliases resolve to whatever the account has, which still assumes
those two tiers exist, and they are the two every plan has. A project that wants otherwise edits the agent
files and takes the conflict on the next `update`, which is the correct signal, or sets the host's
subagent-model environment variable and edits nothing.

**Verified against the host's documentation on 2026-09-30, not observed.** A skill's `model:` holds *for
the rest of the current turn* and the session model resumes on the next prompt. So `/feature-implement`,
whose approval checkpoint asks, and `/feature-close`, whose bump confirmation asks, run their remainder on
the session model once the user answers. The frontmatter still covers every one-turn command outright and
the first turn of the rest, and it puts the intended tier where a reader looks for it; what makes the tier
hold across the ask is running the session on `sonnet` with the specialists pinned up, which the README now
says. The same documentation settled three things the package had assumed: `disable-model-invocation: true`
removes the description from context entirely rather than only preventing auto-triggering, so the nine
skills cost nothing per turn under that host; subagents may spawn subagents, three layers deep by default,
so the sentence in `planner.agent.md` saying a subagent cannot dispatch further ones was stale and is gone;
and that host does not discover `.agents/skills/`, so the second tree costs no tokens there.

**Rejected for now: `context: fork`.** A forked skill runs in its own context on its own model for its whole
life, and it fits this design unusually well, since every command already resolves its own starting point
and a forked skill sees only its `SKILL.md`. It would be the right home for `/roadmap` and `/feature-status`.
How a forked skill asks the user is not documented, and every command here asks somewhere, so it ships
nothing unverified. **Deferred: an install-time model policy recorded in the manifest**, so `update` could
re-apply a project's own tiers. The map in `layout.ts` is the reversal path if the shipped tiers turn out
to be the wrong default for enough installs.

### 17.6 What it cost, and what is still unrun

The install grew from 103 tool-owned files to 120 and the tarball from 122 files to 134, at 238 kB. The
content tests grew from 234 to 259, the new ones asserting that the five tracker halves exist beside their
bodies and nowhere else, that every skill's tier is an alias, and that the notes files are installed and
hashed. Verified on 2026-09-30 by packing the tree, installing it into an empty repository and running
`check` and `update --dry-run`, and by installing the 0.21.1 tarball first and updating it: 40 files
written, 17 of them new, every stub untouched, nothing under **Next**, `check` clean.

None of it has been run by a live agent, which is PLAN.md item 1 in the same clothes it has worn since 0.8.0.
Two checks join that run: that a command which asks mid-turn really does continue on the session model,
and that a re-run of `/onboard` leaves a wired executor alone. Both are recorded there.

**The lesson, which is not about tokens.** Every one of the three relocations was available the day
`plan-template.notes.md` was split from its template. The design record said why that split was right and
then applied it to one file. A principle that is stated once and applied once is a precedent, not a rule;
it became a rule when the cost of not applying it was measured.

---

## 18. `/orchestrate --pr` — the push that had no answer, and the two flags that were refused with it

Asked for as `--autopilot`: a flag that makes the agent commit and open a pull request, with `/bugfix` as an
alias for it, and then `--automerge` on top, merging once CI went green. One of the three shipped.

### 18.1 The hole, and why it was only half a hole

`/orchestrate` refused to push at all — *"Nothing here branches, worktrees or pushes, whatever* Where work
lands *and* Push and pull request *say"* — because both of those `git.md` answers are written about a
feature: one branch or tree per entry, one push at `/feature-close`. An ad-hoc change has neither, so the
answers did not reach it and the command declined rather than guessing.

**Committing was never the hole.** `git.md`'s *Who commits* already governs it and step 6 already obeys, so
a flag adds nothing there. What was missing was the **push and the pull request**, and the thing that made
it look like a configuration problem is that the obvious implementation — read *Push and pull request* —
cannot work: a fresh install ships *the user commits*, *neither*, and an empty *Branch and worktree*, so the
flag would have been inert three times over until someone re-answered three unrelated questions.

### 18.2 The flag is the permission — the source `git.md` already names

`git.md`'s *What no answer here authorises* lists two sources and only two: an answer covering this command
at this point, **or** the user asking in this session, in plain words. **A typed flag is the second one.**
That settles the whole design without a new answer file, a new section in `git.md` or a fourth question in
`/onboard`:

- The flag does not need *Who commits* to say *the agent commits*, and does not read *Push and pull
  request*. Those answers stay about features, which is what they were written about.
- What it authorises is **this invocation**. Nothing it does becomes policy for the next one — which is the
  property an answer file could not have given it, since an answer is standing by construction.

**Rejected: writing the answer instead.** `--pr` could have set *Push and pull request* on first use, or
`/onboard` could have grown a fifth question. Both convert a per-invocation ask into standing leave, which
is exactly the inversion §4.7 was written to stop, and the second one asks every installer to pre-answer a
question most will never use.

### 18.3 It cannot invent a branch, and that is the interesting half

A pull request needs a branch, and `/orchestrate` lands on whatever is checked out. Three cases:

| HEAD | What happens |
|---|---|
| not the default branch | commit, push that branch, open the pull request. **Nothing was created** |
| the default branch | **stop before the commit**, unless *Branch and worktree* in `executors.md` names a command — then run that one |
| that command makes a worktree | stop and say so |

The second row is forced from two directions at once: pushing to the default branch is on `git.md`'s
asked-by-name-each-time list under every answer, and `executors.md` says an empty *Branch and worktree* means
the workflow makes no branch rather than that it should improvise `git checkout -b`. The third row keeps step
6's existing refusal — a worktree answer is not permission to move an ad-hoc change into a tree of its own —
which a flag on this command is not the user lifting.

So the flag's reach is smallest exactly where the repository has recorded least, and it never writes history
in a place no answer named. **Nothing is lost in the stopped case**: the change is in the tree, which is
where it would have been without the flag.

### 18.4 Rejected — `--automerge`

Proposed as the natural companion: merge once CI is green. Refused on four counts, the first of which is
already written down twice.

1. **`git.md` reserves it in one line** — *review and merge are yours* — and `/feature-close` says *nothing
   merges it*. The push exists so a person reads the change; `/feature-close` states the purpose outright
   (*"a pull request is where finished work goes to be read by a person"*). A merge on green CI deletes the
   only thing the push was buying, which makes `--pr --automerge` strictly worse than not pushing at all.
2. **It needs a session that outlives itself.** `/orchestrate` keeps no resumable record on purpose —
   *"nothing here is half-finished in a way the next session could resume"*. A run parked on a check suite
   is precisely that, and a session that dies mid-wait leaves an open pull request and no record anywhere
   that a merge was intended. That is a new terminal state in the one command built to have none.
3. **A merge is a write to the default branch**, which that same list says is asked for by name each time. A
   flag is standing policy for its invocation; that is fine for a push to a feature branch and not for this.
4. **"Green" is not one fact** — required checks or all checks, pending against neutral against skipped, a
   required approving review, a merge queue, a merge method. The dangerous default decides it: a repository
   with no checks configured is green because nothing ran, so the flag would be most eager where it has
   least evidence.

**The narrow version, if it is ever wanted, is the forge's own auto-merge, not an agent's** — and the first
draft of this section overstated what that buys, in the exact way §2.9's rule about sourcing exists to
catch. What was **verified against `gh` 2.100.0** is one string: `gh pr merge --auto` is *"Automatically
merge only after necessary requirements are met"*. What *necessary requirements* resolves to was not
verified against anything — it was assumed, and written down as though the tool had said it.

**Read in GitHub's documentation on 2026-10-01**, not verified against a repository: auto-merge merges once
*"all required reviews and status checks pass"*, it has to be enabled at the repository level, and the option
appears **only when the pull request cannot already merge** — that is, when a protection rule is holding it.
So the load-bearing word is **required**:

- **A CI job that is not a required check is not waited for.** A repository with branch protection that
  requires a review but does not require its checks would auto-merge with CI still running, or failing. "It
  waits for CI" is not a property of the feature; it is a property of a protection rule somebody configured.
- **With nothing required, the pull request is already mergeable**, so there is no auto-merge to enable and
  the call either merges now or errors. The dangerous default of §18.4's fourth count survives intact at the
  forge: least configuration, least waiting.

That **strengthens** the conclusion rather than weakening it. **The safety would be a property of the
repository, never of the flag** — so a flag claiming to merge on green could not honestly say what it waits
for without reading the repository's required-check list first, and that is a forge fact, which `tracking.md`
owns and a skill may not name (§10.8). Not shipped: it needs a merge-method answer, it needs that read, and
`--pr` should land a few changes first.

### 18.5 Rejected — renaming to `/implement`, and `/bugfix` as an alias

Two shapes of the same mistake: making the command's name the phrase people type.

**`/implement` is the one name this command cannot have.** `/feature-implement`'s description ends *"Do NOT
match on 'implement X', 'build this', 'let's code it'"* and `/orchestrate`'s ends *"Do NOT match on 'build
X', 'implement X'"*. Both exist because the tier model's whole job is keeping planned work from being done
unplanned. A skill **named** `implement` makes "implement X" a name match, and no description overrides its
own name — so the predictable misroute sends a planned feature into the command with no entry and no ledger,
leaving step 1's guards to catch it every single time. `implement` beside `feature-implement` is also
confusable for a reader at the one moment the distinction matters.

**`/bugfix` fails three ways.** It is the same magnet pointed at the most ambiguous phrase in the language;
it is a second home for one command's behaviour, against the invariant the content tests guard; and it fuses
two orthogonal axes — *bug* is the category of work, `--pr` is how far the run goes, and you want supervised
bug fixes and unattended non-bug ones. `/orchestrate #<issue>` is already the documented route a bug takes
(§15.4). A per-user alias in somebody's own `~/.claude/commands/` costs no install anything.

**`/task` was §3.8's own suggestion and §10.11 has since retired it.** GitHub's default type set is
`Task`/`Bug`/`Feature`, and *The word `Task` means the opposite thing here* records that an issue typed
`Task` is a workflow **feature** — loop, plan and history row. Renaming the command to `/task` puts that
collision on the form that takes an issue, where `/task #412` would read as the right command for the one
issue that must not go there.

**So the name stays, and `--pr` is an argument for keeping it.** The §3.8 complaint is cosmetic — the
command sounds larger than `/feature-implement` while being smaller. Nobody says "orchestrate this" meaning
"write this code", and that is the property you want in a command that runs on explicit invocation only.
**Raising a command's ceiling is a reason to make its name less inviting, not more**: without the flag a
misroute ends in a working tree somebody looks at, and with it a misroute ends in a pushed branch.

### 18.6 What the flag refuses to be

Two sections in the skill exist only to keep later readings out, because each one is a sentence away:

- **It suppresses no question.** Step 2's release-note level is still proposed and confirmed — §11 made it an
  ask because the level is a judgment, and the flag names where the run *ends*, not that nobody is reading. A
  run that waits there is working as intended. The first draft of this design had the flag assert the level
  and report it; that fuses *don't pause* onto *go further*, which is how `--autopilot` would have accreted
  meaning and why the flag is not called that.
- **It lifts no refusal and no stop.** Step 1's three guards, a non-clean Gate 1 and a capped Gate 2 all end
  the run **before the commit** — nothing committed, nothing pushed, the change left in the tree exactly as
  step 5 leaves it. So does a push that will not fast-forward, and a repository with no remote.

### 18.7 What it cost

One section in the skill, renumbering *Report* to 8; one row each in `workflow.md`'s tier table and command
table, the `AGENTS.md` block and the package README; and one correction, which is the part worth noting.
`workflow.md` summarised the push answer as *"a push happens once per feature, at `/feature-close`"*, and
that sentence became false the moment this flag shipped — **an answer file may not hold a false answer**, so
it now accounts for the one push outside a feature and states the merge refusal as covering any answer *and
any flag*. **Eight tests**, including that one, that the stop list ends the run before the push rather than
after it, and that every document showing the command shows the flag.

Verified on 2026-10-01 by packing the tree, installing it into an empty repository, and running `check`
(clean, exit 0) and `update --dry-run` (121 files current, nothing under **Next**, exit 0), with the flag
present in both skill trees and every relative link in the rewritten skill resolving after install.

## 19. `/release` — the pull request the answer file had been describing all along

Asked for as a command that makes a release branch with the recorded worktree command, cuts the release,
and opens a pull request to approve. It ships as all three, and the interesting part is that **none of it
needed a new rule** — the exception, the branch answer and the permission source were all already written
down, each for a different reason.

### 19.1 The hole was named in §11.10 and then not built

§11.10 settled the ship event in one sentence: *the merge of the **release pull request** — the one where
the script that consumes the notes was run.* Every answer downstream of it is phrased against that merge,
including the per-path ship table and the *this path's version moved in this merge* gate.

**And nothing in the workflow ever created that pull request.** §11.12 added
`/feature-close --release`, which runs the Bump wire on a **feature's** branch — so the pull request whose
merge ships is the feature's own, wearing the release's hat. That is coherent and it is the right shape for
a repository that releases about as often as it merges. It is not the shape the answer file describes, and
the file has been describing an artifact the tool could not produce for five versions.

**The separated shape is what makes the sentence true**: notes accumulate on the default branch as features
land, somebody decides when they go out, and the release is a branch carrying nothing but the version move
and the changelog. §11.12 was explicit that the flag did not retire the ritual it was asked to retire —
*"the flag alone would have looked like a fix"* — and this is the other half of that admission.

### 19.2 Both shapes ship, and the rule that admits them was already closed

**Kept rather than replaced**, against the §18.5 instinct that one behaviour gets one home. The two are not
one behaviour with two front doors: they differ in **which branch the version moves on** and therefore in
**what the merge ships**. The fused one lands a feature and a release together; the separated one lands a
release alone, which is the only arrangement where a reader can see that the version move is the whole of
the change. Neither dominates, so `workflow.md` carries a two-row table instead of a sentence, and
`/feature-close`'s flag section names `/release` as **the one to reach for when the user asked for a
release and typed no flag** — the misroute that would otherwise fuse a release into whatever feature
happened to be closing.

**C18's rule generalised without being edited.** *Only when the user asks for it in that turn* had no
named shape until §11.12 gave it one; the lesson recorded there was that **an exception with no named shape
is an exception an agent will size for itself**, and the fix was to name the shape rather than to narrow
the rule. A typed command is the same shape as a typed flag, so the rule admits this command as written.
What changed is one word of scope: the list is now *a command or a flag typed in the turn it takes effect*,
and the sentence that matters is **that the list is closed**, not that it has one member. The test asserts
the closure rather than quoting the member, which is what stops the third shape arriving by assertion.

**The permission is §18.2's, unchanged.** `git.md` names two sources and only two, and the second is the
user asking in this session in plain words. A typed command is that. So `/release` reads neither *Who
commits* nor *Push and pull request* — both are written about a feature and a release is not one — it
authorises **this invocation**, and nothing it does becomes policy for the next one. No answer file is
edited, no `/onboard` question is added, and the fresh-install inertness §18.1 found is avoided for the
same reason.

### 19.3 The ordering is the design, because the script cannot be run twice

Everything else in this command is a refusal. **The one genuinely new piece of reasoning is the order**,
and it is forced by a property §11 had recorded without drawing this consequence from it: the script the
*Bump* wire names **cannot be run twice**, because it deletes the notes as it goes.

| Step | Why it is there and not later |
|---|---|
| the five refusals | nothing created, nothing consumed — all five are answer-file or ref checks |
| **Gate 1** | **run before anything is consumed.** A gate run afterwards, on a default branch that turns out to be red, leaves a tree whose notes are gone and whose release cannot be cut again |
| the confirmation | the last moment a level is free; after the script there is no note left to edit |
| the branch | **before the script.** A script that eats the notes with no branch to carry them has put the only copy of every pending note on whatever was checked out — and guard 5 says that is the default branch |
| the script | once, and never again on a half-consumed set |
| read the diff | the changelog text is what the release page will say, so it is read rather than trusted |

**That is the one unrecoverable state in the whole of §11**, and it is reachable by doing the obvious
things in the obvious order: cut the release, then check that it builds. Every other failure in this
workflow leaves the working tree as the record. This one leaves a tree with no notes and no release.

**There is no Gate 2, and the skill says so with its reason.** Gate 2 reviews code against this project's
standards and this run writes none — the version move and the changelog are a script's output. Dispatching
a reviewer to read a generated changelog is theatre, and the review this change actually needs is the
person's on the pull request, which is what the command ends at. **A command that merely omitted Gate 2
would read as an oversight** next to every other command that lands anything, which is why the omission is
written down rather than left to be noticed.

### 19.4 The branch is named for the act, because the version is not knowable yet

The obvious name is `release/v0.24.0` and **it cannot exist.** The version is produced by the script, the
script runs inside the branch, and it cannot be run twice — so a branch named for the version would have to
be created after the thing that names it. Three ways out, and the first is the one that ships:

- **`release/<today>`, with `/release "<name>"` overriding it.** The branch names the *act*; the version
  goes in the commit subject and the pull request title, where it is known. A name that already exists
  **stops the run** rather than being suffixed: an existing release branch is either one in progress or one
  somebody abandoned, and both want a person.
- **Require a name every time.** No guessing, one more thing to type for the common case. Rejected as a
  cost with no matching benefit.
- **Ask the mechanism what version it *would* produce.** The nicest name, and it needs a **second wire** in
  `release.md` that most repositories will not have. §11.2 refuses to assume a mechanism that is not on
  disk, and this would have made the branch name depend on one. Rejected.

### 19.5 A separate working tree is welcome here, and §18.3 said the opposite

§18.3's third row stops `/orchestrate --pr` when the recorded invocation makes a worktree rather than a
branch: *a worktree answer is not permission to move an ad-hoc change into a tree of its own.* **This
command takes the opposite answer on the same question**, and the two have to be reconciled somewhere or
the next reader resolves it by picking one.

The distinction is what the tree is *for*. Under `/orchestrate` a tree is a side effect — the change was
going to land on whatever was checked out, and a tree appeared because `executors.md` happened to name one.
Under `/release` **a branch of its own is the entire point of the command**: guard 4 refuses to run at all
without one, because the alternative is moving a version on the default branch and pushing it, which is on
`git.md`'s asked-by-name-each-time list under every answer. So the skill states the departure and names
what it is departing from, `workflow.md`'s worktree rule gains the exception explicitly, and a test asserts
both — the one arrangement where the two commands disagreeing is a recorded decision rather than drift.

**It still makes the tree only with the recorded invocation, and it still removes nothing.** §4.3's rule is
untouched: an empty *Branch and worktree* is a refusal, not a licence to improvise, and nothing in this
workflow removes a tree under any answer.

### 19.6 Three sentences in answer files became false, and two were already false

§18.7's lesson — **an answer file may not hold a false answer** — applied again, and this time it caught
sentences that `--release` had already broken and nobody had swept:

| Where | Said | Was false since |
|---|---|---|
| `workflow.md`, the push summary | *the only push outside them is `/orchestrate --pr`* | this change |
| `workflow.md`, the typed-flag sentence | *`/orchestrate --pr` is the one the workflow ships* | this change |
| `workflow.md`, the asking rule | *`--release` ... the only shape of it this workflow ships* | this change |
| `release.md`, the header | *Nothing in this workflow bumps a version, tags, publishes, releases or deploys* | **§11.12** |
| `release.md`, *what a release ships* | *Nothing in this workflow bumps a version, creates a tag...* | **§11.12** |
| `/onboard` Step 9 | *Nothing in this workflow does any of the five* | **§11.12** |

All three of the already-false ones are blanket claims that a flag had made conditional, and all three read
as reassurance — which is why they survived: the sentence a reader wants to be true is the one nobody
re-checks. They now say **on its own initiative**, which is what they always meant and is true under both
shapes. **The generalisation worth keeping: when a command gains an exception, the sentences to sweep are
the ones that were written to be reassuring**, not the ones that mention it.

The test for the push summary now **counts** rather than quotes, for the same reason: it has been rewritten
by two consecutive changes, and an assertion naming one member of a list of two is an assertion that will
need rewriting a third time.

### 19.7 C3's gap finally closes somewhere, and the stub had to say where

C3 put the bump confirmation where the note is written, on the reasoning that a note is a tracked file
publishing nothing and a wrong level is cheap right up to the release. §11.12 recorded that `--release`
**deletes** that gap. Neither moment is where the gap actually ends in the separated shape: the note is
written at `/feature-close`, it waits, and the level stops being free at **`/release`'s confirmation.**

So the stub's own paragraph gains the sentence, and the command says it while asking — the same move
§11.12 made, for the same reason. **An answer file that describes a gap which no longer outlives any
command is describing a gap that is not there.**

### 19.8 It writes no note, which is the inverse of every other command's obligation

`LANDS_SHIPPABLE` holds three commands and each must read `release.md` and ask *what records a note*. This
command reads the same file and **writes nothing into it**, and that had to be stated as a rule rather than
left as an absence: a release commit carrying a note is a release describing itself, and it is also exactly
the placeholder §11.12 forbids. The red note check is in the skill at the point it bites, with §11.12's
conclusion — **the check is asking the wrong question, so do not answer it with a lie.**

### 19.9 What it cost, and the channel question asked before calling it done

One skill, no `tracker.md` — C8 holds, a release is an artifact of the change and not workflow state, so
`tracking.md` does not reach it. One `SKILL_NAMES` entry, one `CLAUDE_SKILL_SETTINGS` row at
`sonnet`/`medium` **matching `/feature-close`**, which already carries `--release`: the irreversible step
here is gated by a user confirmation rather than by model judgment, and inventing a tier distinction for it
would be a claim that effort buys ordering, which the written procedure buys instead. A row in each of the
four places that show the command set, and the standing-rule edits above.

**Six hardcoded "nine"s**, found by the install output reading *the nine skills* after the tenth landed.
Two were in code and are now derived from `SKILL_NAMES.length`; four were prose. The layout comment already
said a hand-maintained list *"went one file stale each time one was added"* about `context/` — the same
defect, one directory over, and this is the second time it has been paid for.

**C20's question, asked before calling it done.** An existing install has three channels: tool-owned files,
which `update` replaces; the stub, which it cannot; and `/onboard`, which rewrites the answer file.

- **The command reaches every install.** Verified: a simulated 0.22.0 install reports
  `add .claude/skills/release/SKILL.md — new in this version` in both trees.
- **The stub's corrected prose reaches new installs only**, and `update` will not even mention it —
  `stubGaps` compares `##` headings and this change adds none. **Unlike §11.12 this gap is cosmetic**: the
  operative answer is the *Bump* wire, which is already in the file of anyone who has one, and the skill
  carries everything the command needs. What an existing install misses is the paragraph saying where the
  bump-level gap closes. Said precisely so it is not later mistaken for the §11.12 shape, where the same
  channel gap left a red check in place.
- **`/onboard` Step 9 gains one line** — *say who runs the Bump wire while writing it* — so a re-run
  records the consumer rather than leaving a wire that reads as firing by itself. That is the channel, and
  it is setup-time, which means it arrives late or never. Same limit as §11.12's, accepted the same way.

**Eleven tests**, of which the ordering one is the only one worth keeping if the rest were deleted: it
asserts section order, not prose, so a future edit that moves Gate 1 below the Bump wire fails rather than
reading fine.

Verified on 2026-10-05 by packing the tree, installing it into an empty repository, and running `check`
(clean, exit 0) and `update --dry-run` (123 files current, nothing under **Next**), with the command present
in both skill trees, the Claude copy carrying `sonnet`/`medium`, every relative link in the new skill
resolving after install, and the upgrade path exercised against a simulated older manifest.

---

## 20. The plan had no size, and only the substrate with a limit ever said so

Asked why plans in real installs are so much larger than the design assumes, with the measurement attached.
Three things came out of it: the working-tree answer gets the scope check the tracker answer had for free,
the ledger's Note column gets the only bound anything in the design ever gave it, and the briefs stop
being pointed at a document when they only ever needed a section of it.

### 20.1 The measurement, which is the whole argument

Twenty-three plans under `context/plans/` and `context/archive/` in four installs — `piff/piff`,
`dynjandi/dynjandi-core`, `baldurpan.com` and `bgmusik` — **measured 2026-10-16 against the files on disk**,
not reported from memory:

| | |
|---|---|
| Median plan | **48,893 characters** |
| Mean | 56,457 |
| Over 65,536 | **6 of 23** — 134,539 (`piff` CUTOVER-PIFF-IS-TO-WORKER), 97,384 (`dynjandi-core` CLOUDFLARE), 87,927, 81,234 (`bgmusik` SITE-SCAFFOLD, for a scaffold), 72,326, 70,156 |
| Ledger rows across all 23 | 142 |
| Median ledger Note | **440 characters**; 113 of the 142 over 200, 59 over 500 |
| Longest Note | **6,714 characters** (`dynjandi-core` SENTRY-ERROR-MONITORING; the whole row is 6,805) |
| Ledger as a share of its plan | median **7.5%** |

**§10.13 said a filled plan is "a few thousand characters". That is false, and it was the load-bearing
claim.** Everything in that section followed from it: if a plan is a few thousand characters then 65,536 is
a limit nobody reaches except by writing several features into one document, and the ceiling is a free
scope check. The field says the median plan is seven times "a few thousand" and that a quarter of them are
over the line — so the ceiling is not a rare backstop, it is a boundary real work crosses, and **under the
working-tree answer nothing in the tree has ever mentioned it.** §10.13 predicted exactly this and left it
unbuilt: *"that is already a defect under the working-tree answer … and nothing in the tree ever says so."*

**The ledger share is the finding that redirected part of this change.** At a median 7.5% the Note column
is not what makes plans large — the prose is. Capping the Note is worth doing for the reason §20.3 gives
and **not** as a way to keep a plan under its budget, and saying so here stops the next reader from
treating the two as one lever.

### 20.2 One number, one home, and `/feature-plan` measures before it writes

**The budget is a ceiling plus a per-phase reserve**, and both are fields in `tracking.md`:
`**Plan size ceiling:** 65,536 characters` and `**Ledger reserve:** 500 characters per phase row`. Same
shape as `**Repository:**` beside them, so a project changes the numbers by editing the file.

**It is `tracking.md` rather than `workflow.md`, which is the one placement worth arguing.** The question
*how much may a plan hold* already lived in that file's primitive map, because under the tracker answer the
answer is a GitHub fact (§10.13's rule: the skills ask for the fact, the stub states it). Putting the tree
answer anywhere else would give one question two homes. So the row stays and the section it points at holds
both answers, outside `### Under the tracker answer` — `/onboard` deletes that subsection on a tree install,
and a budget living inside it would exist only for the answer that already has a hard limit.

**It is a `##` heading, and the first draft had it as a `###` for the wrong reason.** §17.2 recorded
"every `##` heading in every stub is unchanged, so `stubGaps` reports nothing to an existing install" as a
property worth having, and it was — in a change that asked nothing new of the stub. **This one does.**
`tracking.md` is project-owned, so `update` cannot write the section into an existing install; `stubGaps`
compares `##` headings only; and the skills now read a section those installs do not have. A `###` is
therefore silent in exactly the installs that need to hear it, which is the §11.12 shape — a gap whose
only channel was switched off to keep a report quiet. As a `##` the update says the section is missing and
names `/onboard`, which is both true and actionable, and that is the whole of the noise. **Treating §17.2's
silence as a rule rather than a side effect was the error**, and it is the second time in this record that
a property observed once got mistaken for a constraint.

**The window before `/onboard` runs is covered by naming the gap, not by a hidden default.**
`/feature-plan` says the budget is not recorded, names `/onboard` and writes the plan anyway — the same
rule this workflow applies to a path `release.md` does not cover. Inventing a ceiling mid-run would write
policy nobody chose; refusing to plan over a missing answer would be worse. `check` has a code-level
fallback to the shipped pair, so an oversized plan is still reported in that install, which is the one
place a default is safe: it changes no file and fails nothing.

**The number is the same under both answers, deliberately.** The tempting alternative is a smaller tree
threshold keyed to the reading budget, or a larger one on the grounds that nothing in the tree enforces
anything. Both break portability: `/tracking-migrate` refuses to carry an oversized plan, so a tree
threshold above 65,536 makes that refusal a trap sprung by adopting a tracker, and one below it fires on
plans a tracker would have accepted. **One number means a plan `/feature-plan` passed in the tree fits a
body**, and a repository that has been measuring never reaches the migration's refusal. The migration now
says that about itself.

**A smaller number was also rejected on its own terms.** A threshold set near "a few thousand characters"
would fire on the median plan, and a validator that fires on the median artifact is the false-positive
machine §6.4 refuses. The measurement does not say plans should be 3 KB; it says the 65,536 line was
telling the truth and nobody was listening.

**The reserve is what makes this a check rather than a formality**, and it is §10.13's *room to spare, not
room to fit* given a number. A plan is measured as its own size plus the reserve times its phase count,
because the ledger is written into for the feature's whole life. On the corpus it changes one verdict:
`baldurpan.com` SITE-CORE-PLAN is 61,912 characters across 11 phases, which fits today and is 1,876 over
once 500 is held back for each row. That plan would have failed on its last phase under the tracker answer
and nobody would have known why. **500 is derived from §20.3**: a closing row gains a sha and one line, and
the measured median Note is 440. If the Note stops being one line the reserve is wrong, so
`/feature-implement`'s tracker half names that dependency out loud — otherwise the failure arrives as a
body at its limit three phases from the end with no way to diagnose it.

**`/feature-plan` measures in step 5, between the research and the write.** Under the tracker answer the
body is one write and a failed one is the worst possible moment to learn the plan was too big; in the tree
there is no failed write at all, which is *why* that answer needed the check written down rather than
inherited. The command reports the measurement either way — a check nobody sees the result of is one
nobody trusts.

**The split prose moved out of the body into `split.md` beside it.** §17.2's rule applied a third time:
prose only some invocations need does not ride every invocation. Every `/feature-plan` run measures and
almost none split, so the refused workarounds, the propose-then-ask and what happens to each chunk are in
a supporting file the body opens only when the measurement fires. That also deduplicated it — the split
had been written out in `feature-plan/tracker.md` and had to exist under both answers now, and writing it
twice was the alternative. The tracker half keeps the four things that differ: the ceiling is the
substrate's rather than a budget, the body is one write, the chunks are issues with a `Priority:`, and the
order between them is a relationship rather than a sentence.

**Net on the reading budget**, against §17.1's 78,570 for one `/feature-implement` phase on the tree
answer: `feature-implement/SKILL.md` +1,303 and `tracking.md` +2,176 as a tree install reads it, so
**+3,479, or 4.4%.** What it buys is in §20.4 and is two orders larger.

### 20.3 The Note is one line, and the detail has somewhere to go

**One line: what a later session needs in order to understand or resume the Status beside it.** What is
underway, what remains, what is blocking, the sha where the phase is `done`. The measurements, the test
counts, the gate output and the account of how the phase went go in the commit message that carries the row
— under `git.md`'s answer, since the row lands with the work — or in the run's own report.

**It is the only column with no visible bound.** `#` is a number, `Phase` is a name, `Status` is one of
four words and `Depends on` is a short list. The Note is prose in a table cell that nothing wraps, so it
grows until a reader cannot find the Status beside it, and a 6,714-character cell is what that looks like.
The design never said otherwise; it simply never said anything, and a column with no stated bound and an
obvious use as a log becomes one.

**The rule lives in `plan-template.md` §6.1 and is cited, not restated, by `/feature-implement` step 11.**
§6.1 is the ledger's own definition and it travels with the ledger — into a plan document under one answer
and into an issue body under the other — so the rule goes wherever the table goes. The skill carries only
the sentence that is its own: where the gate output goes instead. Two independently-worded copies of one
rule is the drift §2.5 exists to prevent, and this change had a standing invitation to produce one.

**It binds the opening write as much as the closing one** (§2.8's two writes). The opening Note is the one
a resuming session reads, which makes it the most likely place to write a narrative of what is about to
happen rather than a line saying where the work got to.

**A rule that only forbids relocates nothing**, so both homes name the destination. Without that, a session
told the Note is one line drops the measurement instead of moving it, and the thing worth keeping is gone
for the sake of a column width.

### 20.4 A brief carries the phase, not the plan

**§17.1's reading budget never counted the plan, and three readers open one on every phase** — the
orchestrator, the coder and the reviewer. At the measured median that is 48,893 characters each, which is
62% of the entire 78,570 budget the §17 pass worked to produce, per reader, per phase, and it was outside
the frame the whole time.

**The dispatch briefs already pointed at the phase's own section**, which is the half of this that was
already right. What was missing was a reason a reader would respect it and a way to brief a phase without
its constraints:

- **`coder.md` said it receives "a **plan**"** — the scope, the files, the acceptance criteria. So the role
  file invited the whole-plan read that the dispatch step had just avoided. It now says it receives one
  phase as its own section, and that the section is the brief.
- **A phase's constraints live in §3 and its work lives in §6.2**, so a brief carrying only the second
  leaves the coder to either read the whole plan or re-decide what §3 settled. **Every phase section now
  carries a `Decisions:` line** — the §3 decisions that govern it, by number and in a clause each.

**That is §17.3's move applied one section over, and the second time it is applied is what makes it a
rule.** §17.3 made the plan the single traversal of the standards table because three readers were
traversing it independently; §3 is the same shape of problem, and §17.6's lesson — *a principle stated once
and applied once is a precedent, not a rule* — is the reason to notice rather than re-derive it. The
reviewer gets the line too, with the one thing that is its own: a decision on that line is settled, so an
implementation that took the rejected alternative is a blocking finding and a decision the reviewer
disagrees with is a note.

**The fallback is §17.3's, verbatim in shape.** A plan written before phases carried these lines has
neither, and both readers fall back — to the conditional table for standards, to §3 for decisions. A rule
that bricks the plans already on disk is a rule nobody can adopt.

**What it buys.** The largest `#### Phase` section in the measured plans is a median **24.4%** of its
document, so the section plus the two lines is roughly 12 KB where the plan is 49 KB — about 37 KB saved
per reader, per phase, twice over. Against §20.2's +3,479 on the orchestrator that is not a trade worth
agonising over.

### 20.5 `check` reports it, and it is the first `note` anything ever wrote

**It reports an oversized plan and nothing else about it**, as a `note` rather than an error, naming
`/feature-plan` and proposing no split.

**`note` was a level with display code and no producer** — `check.ts` filtered for it, counted it and
printed *"Notes do not fail the check"*, and every `problems.push` in `rules.ts` said `error`. That is
§2.8's shape exactly: a legal value nothing ever wrote, found the same way, which is by looking for who
writes it. The budget rule is its first producer, and the level turned out to be sized for precisely this
case.

**It had to be a note, not an error.** An oversized plan is well-formed: its columns match, its statuses
are legal, its dependencies resolve, every answer it gives is correct. What it says is that the feature is
more than one feature — a finding about the *work*, not about the document. An error would fail CI on a
repository whose documents are all structurally sound, which is how a validator earns the reputation §6.4
exists to avoid. So it exits 0, and the summary now says what a note means.

**It stays read-only and answers no workflow question.** It reads two numbers from the file that states
them and compares a file's length to them — the same kind of act as comparing a ledger's columns to
`plan-template.md`'s. It does not decide what to do about the overrun, propose a boundary, or name which
phases to cut; that is `/feature-plan`'s, with the user answering. §6.4's test still holds: delete `check`
and every workflow answer is unchanged, because the skills measure for themselves.

**It reads `plans/` and never `archive/`**, like every other rule here. A retired plan's size is not
actionable — the feature shipped — and §6.4's reason is unchanged.

**Measured in code points**, since the ceiling the tracker answer inherits counts characters, with the
numbers read from `tracking.md` and a fallback to the shipped pair when the file is missing or the fields
have been edited out — the same shape as the column set falling back when `plan-template.md` is absent.

### 20.6 What it cost, and what was verified

**Twenty-five tests**, 278 → 303. The ones worth keeping if the rest went: that the budget is a `##`
heading outside the subsection `/onboard` deletes, that no skill hardcodes either number, that the reserve
fires on room-to-fit (a 65,000-character plan with two rows reports 464 over), and that a note exits 0.

**Verified on 2026-10-16**, by packing the tree and installing it into an empty repository: `check` clean
at exit 0, `update --dry-run` reporting 126 files current and nothing under **Next**, and `split.md`
present in both skill trees.

**End to end against the field.** The 23 measured plans copied into that install report **7 notes** — the
6 over the ceiling plus SITE-CORE-PLAN on the reserve — each naming its own size, its reserve and its
margin, with the run exiting 0 on the notes alone.

**The upgrade path, which is where the `###` mistake was caught.** Installing the published 0.25.0 and
updating to this build reports `! context/tracking.md has no "How much a plan may hold" section — this
version's stub has one` under **Next**, and names `/onboard`. In that same install, whose `tracking.md`
genuinely lacks the section, `check` still reports the 134,539-character plan against the fallback pair
and still exits 0 — so the window between `update` and `/onboard` is covered rather than silent.

**Unrun, and it is PLAN.md item 1 again.** Nothing here has been executed by a live agent: whether a
session actually measures in step 5 rather than writing and hoping, whether it opens `split.md` when told
to, whether it proposes a split along phase boundaries rather than inventing one, and whether a Note stays
one line over a dozen phases are all behavioural and none of them is testable from outside a real session.

**The lesson, which is not about size.** §10.13 reasoned correctly from a number it had not measured, and
reached a conclusion that was right about the tracker and wrong about the field. It even wrote down the gap
it was leaving. **A claim about what the artifacts look like is the one kind of premise that can be checked
against the artifacts**, and this design record says so about itself: *claims in either file are
load-bearing.* Four installs and twenty minutes were what it took.

### 20.7 The reserve was held for rows that had already closed

The rule read `budget.reserve * ledger.rows.length` — **every** row, including the `done` ones. A closed
row has already gained its sha and its Note, and those characters are already in the plan's own size, so
the check charged for them twice. The consequence is backwards: **a plan that passed at planning time
starts reporting as its phases land**, one row at a time, for making progress. On the measured corpus
that is the common case rather than an edge — §20.1 found the field's Notes at a median 440 characters and
99 of 142 rows over 400, so the reserve is real money.

**It is `reserve × rows not done`**, and the test that pinned the old arithmetic moved with it: the shipped
fixture's first row is `done`, so the test about room-to-spare now uses a ledger where both rows are still
to be written, which is what the test was always about.

**The stub says it too, in one clause**, because *the reserve times its phase count* is the sentence
`check` cites and it is written for the moment the plan is measured — when every row is still to be
written and the two readings agree. The difference only appears once phases land, so that is where the
stub now points: what is still growing then is the Notes, not the prose.

**And the remedy it named was the one `/feature-plan` refuses.** The message said *run /feature-plan to
split it* in every case, including a plan already under way — which `split.md` and step 5 refuse, because a
plan being worked cannot be cut in two without stranding phases somebody is mid-way through. So where any
row has closed, the message points at **§6.1's one-line Note rule** instead: the plan's prose is finished
by then, and what is still growing is the column with no visible bound.

**A fallback that changed the verdict now says so.** §20.2 gave `check` a code-level fallback to the
shipped pair and called it *the one place a default is safe: it changes no file and fails nothing.* True,
and silent — a plan reported against 65,536 in an install whose `tracking.md` says nothing read exactly
like one reported against a number the project chose. `planBudget` now returns which fields it could not
read, and `check` says so **once**, at `context/tracking.md`, naming `/onboard` — and **only where there was
a plan to measure**, because with no plan the fallback changed nothing and the gap is a fact about the stub
that `update` already reports to that install.

**What it cost:** `stubs/tracking.md` 18,965 → **19,317** for the clause above, `context/tracking.notes.md`
4,030 → **4,137** for the heading move, and `skills/feature-plan/SKILL.md` 14,457 → **14,773** for the
measurement step — against `split.md` and the stub each losing a sentence that was false. **Four new tests**
in `check.test.ts`, and one existing one re-pointed at a ledger whose rows are all still open.

**Three claims about the budget were wrong in prose, two of them load-bearing.** `PLAN.md` said the section
was placed *above* the subsection `/onboard` deletes and as a `###` — the opposite of what §20.2 argued at
length and of what the stub ships, in the file this repository says holds claims that are load-bearing.
`tracking.notes.md` filed it as a `###` under *Where tracking lives* while claiming to mirror a stub where
it is a `##` after the tracker subsection; it is now a `##` in the same position, which is the whole point
of a notes file that mirrors a stub. And **"a filled plan was meant to be a few thousand characters"
survived in `split.md` and in the stub** — the sentence §20.1 falsified by measuring, still arguing for
over-splitting in the two files a run reads when it is deciding whether to split.

**Step 5 never said how to measure.** Nothing can count the characters of a draft it is holding in context,
so the step that says *measure the drafted plan* was asking for a number an agent would have to invent.
It now says to write the draft outside `context/` and run `wc -m` on it, and to report the number — and
the *do this before the write* sentence came out of the missing-section paragraph it had been glued to,
where it read as advice about installs with no budget rather than the rule for every run.

---

## 21. The owner check — the question no gate can close, and the file it was archived into

`/feature-plan` writes §9 Open questions. `/feature-implement` step 2 surfaces it at activation and
requires an acknowledgement. **Nothing reads it again.** `/feature-close` archives the plan, writes
`shipped`, and the questions go to `context/archive/`, where no command in this workflow looks.

So a feature retires with its human checks open, and the only trace is a sentence in the `history.md` Why
that reads well and is read by nothing.

### 21.1 The field evidence

`baldurpan/baldurpan.com` runs this workflow on the working-tree answer. Its `context/history.md` on
2026-10-16 carries thirteen rows, every one `shipped`, and these among them:

| Feature | The Why column, verbatim |
|---|---|
| `moon-over-the-mountains` | "The Icelandic and VoiceOver check await the owner." |
| `solar-eclipses` | "All 8 phases done; the owner's Icelandic wording and VoiceOver reads await." |
| `night-sky-stars` | "All 9 phases done; the owner's wording (Q11, Q18), the halo and look (Q16, Q20) and an iPhone check (Q14) await." |
| `site-core` | "All 11 phases done; the owner's read of the 404 copy, the About text (Q1, still lorem ipsum), the real project covers and Gosi's year are outstanding." |
| `sky-devtools` | "All 4 phases done; the keyboard and contrast pass by a person (§8) is outstanding." |
| `sky-page` | "the sky project's summary and year (Q6) are still `TODO(owner)`, the home's link words are placeholders (Q5)" |

Six of thirteen, and `english-icelandic-switcher`, `sun-calendar-feed` and `visitor-sun-compare` carry the
same clause about an unread Icelandic translation — **nine rows in all.** `NIGHT-SKY-STARS-PLAN.md`'s §9
holds twenty items, nine of them marked `(owner)`, and `MOON-OVER-THE-MOUNTAINS-PLAN.md`'s holds sixteen
with no marker at all. Both are now in `archive/`.

**The rows were not negligence — they are the workflow working as written.** Every phase was `done`, both
gates passed on each, the ledger check at the top of Mode 1 was satisfied, and `/feature-close` has no step
that reads §9. The writer did the honest thing twice: raised the question in the plan, and said in the
history row that it was still open. The second honest act is the one that disappears, because `history.md`
is an append-only index that nothing queries.

**And note which section `sky-devtools` cites: §8, not §9.** That is not a second hole.
`plan-template.notes.md` already requires it — *"a feature whose project has no such driver says that in §9
rather than naming one"* — so a verification pass with no driver belongs in §9 by a rule four versions old.
That row is a plan that did not follow it, which is why the sweep reads §9 and not two sections. One place,
already written down.

### 21.2 Why none of the three existing endings fitted

*What happens to a defect the gate found* (§12, §14, §15) enumerates every end the workflow had. Apply each
to *the owner reads the Icelandic*:

| End | Why not |
|---|---|
| **fixed**, or the phase goes **`blocked`** | there is nothing to fix. The code landed and both gates passed; what is missing is a person's attention, which no loopback supplies |
| **a bug** | the test is *a real defect, user-visible or a regression would land green.* Nothing is known to be wrong. §15.2's lesson in reverse: a bug closes when a fix ships, and there is no fix |
| **a backlog entry** | the backlog is a list of features — work you would want a `history.md` row for. Nobody wants one for *read the Icelandic*, and §15.3 is explicit that a gate appending to that list is the defect |
| **a note in `notes.md`** | `/feature-close` **deletes it whole**, unconditionally (§14.5). The close is the exact moment the check becomes real, so the one store that could hold it is emptied at the one moment it would matter |

**It is a fourth kind, and the fourth kind is defined by its closer.** A defect is closed by a fix, a
feature by a plan, a note by the branch ending — and an owner check is closed by **a person looking at it**
and by nothing else. That is the whole of what makes it its own category, and it is why it needed one.

### 21.3 The destination is the bug shelf; the kind is not a bug

§15.5 found this shape and stated its general form:

> **The project's own bug label already is the answer.** What was missing was never a label — it was the
> sentence saying a bug is outside that bit, and a command that could act on one.

The same applies, and the argument is by elimination. The workflow has exactly three durable homes, and two
are refused on sight:

| Home | Verdict |
|---|---|
| the backlog | refused — a list of features (§15.3) |
| `history.md` / `archive/` | append-only and frozen. **No closer exists**, which is precisely the defect |
| whatever this project already files bugs in | the only one left — and it has every property needed |

An owner check needs five things: durability past the branch, a position **outside** `tracking.md`'s one
bit, an **assignee**, a close performed by a person, and to be **read by nothing in the workflow**. A bug
already has all five on that shelf. Inventing a second shelf next to it would buy a word and nothing else.

**But it is filed as what it is, not as a bug**, and that distinction is load-bearing rather than
cosmetic: a pending screen-reader pass written up as a defect is a defect report nobody can reproduce, and
the next person to triage it closes it as *cannot reproduce*. So the issue says what has to be looked at
and who it waits on. **Destination reused, kind named** — which is what the instruction to reuse an
existing ending can mean without collapsing two categories.

**Under both tracking answers this is one answer, not two.** `tracking.md` already puts a bug outside its
bit under either, and the stub's own rule says so: *"A defect goes wherever this project already files bugs
… under either answer."* So the tracker delta for `/feature-close` gains three rows about **where the words
are written** — a body edit rather than a document edit, a comment rather than a Why column — and not one
about what happens. That asymmetry is the test §10 set for itself, and it passes here for free.

**Where this project files bugs nowhere, there are two ends rather than three.** Said out loud, because the
alternative shapes are both wrong: inventing a store is what §12 and §14 each removed once, and refusing the
retirement blocks a finished feature over a gap in somebody's project. It is `release.md`'s *a path this
file does not cover is named, not guessed at*, applied to a different gap.

### 21.4 Why not a file — the property §14.5 got right, read the other way

§14.5 brought `notes.md` back on three properties, the first of which was *nothing reads it*. The cheap-end
argument is:

> A line in a branch-local file costs nothing to write, **nothing to ignore** and nothing to delete.

For a note, *nothing to ignore* is the feature. **For a check somebody has to perform, it is the failure.**
The fact *this has not been done yet* has to be **observable in a place a person already looks** — §10.4's
test, which asks whether a primitive lets a fact be observed or requires a stored copy somebody maintains.
An open issue with an assignee is observed: it is in the list, it has a name on it, and closing it is the
same act as doing the work. A heading accumulating lines is maintained, which is how the 76 KB
`findings.md` happened and what the one-file-per-note directory in §14.6 was refused for.

So: **no new file, no stub, no `check` rule, no new status word.** §14.6's refusal of a `check` rule applies
unchanged — *a store should be unable to accumulate, rather than watched while it does* — and here the store
that cannot accumulate is the plan's own §9, written once, read at activation, disposed of at the close, and
archived with a plan nothing opens again.

### 21.5 The Outcome column gains no value

The tempting fix is a fourth word: `shipped`, qualified, so the row itself says a check is pending. It is
wrong twice, and the second reason is the structural one.

1. **`history.md` is append-only and never edited.** The stub says so in its second line. A row reading
   *pending* is still reading *pending* a year after the owner looked, and nothing in this workflow would
   ever go back to change it. **A status in an append-only file is a status nothing can withdraw** — which
   is §2.1's rule arriving from a new direction: the Outcome column is the single home for *what became of
   this feature*, a fact that is settled at the close, and a fact that is **not** settled cannot share it.
2. **Under the tracker answer that column is the issue's close reason**, and the tracker offers *completed*
   and *not planned*. There is no third value to map a fourth word onto, so the vocabulary would exist under
   one answer and not the other — which the tier model forbids outright (§10.8: the tier model is identical
   under both answers, and only where a fact is read changes).

**So the Why column names what is waiting and the issue that carries it.** This is one clause different
from what the field was already writing, and the one clause is the whole fix: today the sentence **is** the
record, and after this it is a **pointer**. A sentence that is the record is a record nothing reads — which
is the generalisation of §12.1 (an unbounded file silently disables the check that reads it) for a file that
has no reader at all.

### 21.6 Why the close, and why it is not the ceremony §12.2 was refused for

§12.2 built a disposition sweep at retirement, with three dispositions and a `check` rule for orphans, and
it was rejected for bounding the tail while leaving the accumulation — and for costing *"a triage ceremony
at every retirement, for objects that are mostly noise."* This sweep has to answer that, and it does, on
three counts:

- **The store is bounded by construction.** One plan's §9, written once by `/feature-plan`, read at
  activation, read again here. It cannot grow across features because the plan is archived and never read
  again. That is a lifecycle property, not a rule somebody keeps — §14.5's own test.
- **The objects are not noise.** `notes.md` holds gate observations, where anything worth keeping was
  promoted while the branch was alive. §9 holds questions a planner wrote down **on purpose** and a user
  already acknowledged once at activation.
- **The filter is one bit, not a disposition per line.** *Does this need a person.* Most of §9 does not, and
  an item a phase settled reads as settled, because `/feature-implement` step 7 now writes the answer into
  the item it settles — the documentation rule (§2.9) applied to the plan's own open questions, and the
  second application is what makes it a pattern rather than a one-off.

**Why the close rather than the phase that raised it.** The phases answer what they settle; what reaches the
close is precisely what no phase could finish. The retirement is the last moment anyone decides anything
about this feature with its code still in front of them, which is the same argument that puts the promotion
of a note while the branch is alive (§14.5) and the release note's bump-level confirmation (§11.12) where
they are. **It is the second thing `/feature-close` asks rather than reads**, and the two cannot be merged:
this one feeds the `history.md` row, so it runs before the writes; the bump level is asked when the note is
written, which is after them.

**`--dropped` runs it too**, which was not obvious. The mode's existing release-note rule already settles
it: *"a note belongs to the change that landed, not to the outcome the feature was later given."* An owner
check about a phase that landed is the same case. An item about work that was never written is **waived by
construction** and costs one line, not a walk.

### 21.7 What was refused

**A fourth Outcome value.** §21.5. Two independent reasons, and the second is fatal rather than merely
costly.

**A `context/checks.md`, or any file of pending checks.** §21.4. It is `findings.md` with a friendlier name
and the same closer problem — nothing in the workflow could close a line in it, so the only bound available
is a sweep, which §12.2 built and §14.6 refused.

**A `workflow:check` label, or any new label.** §15.5 refused a `workflow:bug` label on §10.4's test and
nothing has changed: nothing would read it, the only candidate reader is a command that would then have a
queue, and a queue needs ranking. The project's own labels are the answer under both tracking answers.

**A `check` rule faulting a plan archived with unresolved owner items.** The same rule §14.6 withdrew on
inspection, for the same two reasons: it needs a parser for prose nothing else parses, and it is a reader —
which is the mechanism by which a store fails silently rather than loudly.

**Marking owner items with a parsed token** — `(owner)`, which two of the field's plans already use by hand.
Attractive, and refused: a marker the sweep **relies** on is a mechanism maintained by discipline, and a
plan that forgot it would sweep clean. The sweep has to read the prose either way, so the marker can only
ever be help for a human reader. It is therefore requested in the template and the planner's brief, and
**depended on nowhere** — the same standing the planned label has (*a rendering, and nothing reads it*).

**Widening the sweep to §8.** §21.1. A pass with no driver is already required to land in §9.

### 21.8 What it cost

| File | What changed |
|---|---|
| `context/workflow.md` | one `##` section with two `###` children, and one cell in the commands table |
| `context/workflow.notes.md` | the reasoning, under the matching heading |
| `skills/feature-close/SKILL.md` | the pass, before the writes; the Why clause on step 1; §9 travelling with the document on step 3; one paragraph in Mode 2 |
| `skills/feature-close/tracker.md` | three delta rows and one paragraph — all about where the words go |
| `skills/feature-implement/SKILL.md` | one paragraph in step 7: a phase answers what it settles |
| `skills/feature-plan/SKILL.md` | one bullet extended |
| `context/plan-template.md`, `.notes.md` | §9's guidance says it has readers after the planner |
| `claude/agents/planner.agent.md` | *mark them clearly* gains *and say which need a person* |
| `stubs/history.md` | two sentences, where the person who would invent a fourth Outcome value is reading |

**Thirteen tests.** No new file, no new stub, no `check` rule, no new status vocabulary, and no change to
`check`, the manifest or any code path. **Verified on 2026-10-16** by packing the tree and installing it
into an empty repository: `check` clean at exit 0, `update --dry-run` reporting 126 files current with
nothing under **Next**.

**Unrun, like everything else in PLAN.md item 1.** Whether a session actually reads §9 at the close rather
than skipping to the writes, whether it applies the one bit instead of disposing of twenty lines, and
whether it files an owner check as a check rather than as a bug are all behavioural and none is testable
from outside a real session.

### 21.9 The lesson

§14.7 said: **when a store is deleted its contents go somewhere, and that somewhere is a design decision
even when nobody makes it.** This is the inverse, and it is the sharper half.

**When a document is archived, its unfinished business goes somewhere too — and if nothing decides where,
the answer is the archive.** §9 was never a store anybody chose to keep; it was a section of a document
that stopped being read. The two reads it had were both at the front of the feature's life, and nothing
looked at it at the end, so the last honest act of nine features in a row — writing down that a person
still had to look — was performed into a file whose only reader is somebody who already knew.

The test that would have caught it is cheap and generalises past this section: **for every section of every
document this tool ships, name the command that reads it, and name when.** A section with a writer and no
reader is not documentation; it is a drain. §12.5 found two report lines asking for counts out of a deleted
file, and the lesson taken was about deletion tests keyed on paths. The larger version was sitting beside
it: **a reference nothing reads and a reader nothing references fail the same way, and only one of them
looks like a bug.**

---

## 22. The sentence §15.3 replaced and nobody deleted — and the guard that was keyed on the wrong words

Found while §21 was being written, in the paragraph next door. `/orchestrate` step 4 said:

> **A non-blocking observation goes in this run's report and dies with the session** — unless it needs code
> changes, in which case it is work and belongs in the backlog per `context/tracking.md`.

That is the rule §14.3 took apart — *"every true observation about code needs code changes; the condition
admitted essentially everything, which is not a bar"* — routing to the destination §15.3 forbade, and it
had been shipping for four versions after both sections landed.

### 22.1 It contradicted the same file, two paragraphs down

Step 5 of the same skill already said the right thing:

> **If the work is still worth doing, it is a bug** — file it wherever this project files bugs and name it.
> **Never the backlog label**, for the reason in `context/workflow.md`.

So one command held both answers at once, eleven lines apart. A session reading top to bottom met the stale
one first, at the step where the decision is actually made, and the correct one later in a paragraph about
a capped gate. **The fix reached `/feature-implement` and stopped there** — §15.3 names
`/feature-implement` §9 as the line it was repairing, quotes it, and never looked for the sibling.

### 22.2 Why the guard missed it, which is the part worth keeping

§15.3 shipped a test rather than prose, deliberately, because the rule distinguishes reading the backlog
from writing to it. It looked for a sentence containing **`backlog label`** plus an applying verb, and
allowed it only if the sentence was also a refusal.

The stale sentence contains **neither**. It says "the backlog", not "the backlog label" — and "belongs in",
not "apply" or "add". It passed every version of the test while saying the opposite of the rule the test
exists to enforce.

**This is §12.5 exactly, a second time.** That section found two surviving references to a deleted file and
drew the lesson: *a deletion test that matches the path misses every reference that never needed the path.*
Here the test matched the **label**, and the violation never needed the label — the backlog is reachable by
name, and a sentence can put something in it without naming the mechanism. The general form is one step up
from both: **a guard keyed on the words of the violation it was written for catches that violation and no
sibling.** Key it on the *fact* — something is being routed into the backlog — and the family is covered.

**And the test comments asserted the fix had landed.** Two of them describe the old rule in the past tense
— *"The old rule sent every non-blocking observation that 'needs code changes' to the backlog"* — beside a
suite that was not checking the file where it was still in force. A comment is not a check, and a comment
written at the moment of a repair is the most confident thing in the repository.

### 22.3 The repair, in two halves

**The prose.** Step 4 now carries the three ends by kind, as `/feature-implement` step 9 does, with the
cheap one collapsed into the report because this command writes no `notes.md`. The dead condition is
**named where it bit** — *not size, and not whether it needs code changes, which every true observation
about code does* — rather than quietly dropped, so the next reader of that paragraph meets the reason and
not just the rule. Step 5's summary line went too: *"an observation that is work becomes an issue"* is the
same loose framing in softer clothing, since *work* spans a bug and a feature and the two have different
destinations.

**The guard**, keyed on `backlog` rather than `backlog label`, with a routing-verb set and two exemptions —
the sentence refuses, or it hands the decision to `/roadmap`. Verified by reverting the one sentence and
watching it fail, quoting the sentence verbatim. The exemptions are what keep it usable: *"the open issues
carrying the backlog label"* is how half these commands find the backlog at all, and
`/feature-implement`'s correct ending — *"that is a backlog entry, and adding one is `/roadmap`'s"* —
names the command rather than refusing, which is the shape a correct hand-off has.

**One leftover went with it:** `OWNS_A_GATE`, declared in the sibling describe block and never read, a
duplicate of the `GATES` const two blocks down. Dead test scaffolding from the same repair.

### 22.4 What it cost

`skills/orchestrate/SKILL.md` — step 4's paragraph becomes three bullets, step 5's summary line rewritten.
One test strengthened, one dead const removed, **no new test and no new rule**: the rule was already right
in `workflow.md` and in two of the three places that cite it.

**The lesson, which is about tests and not about backlogs.** A content test is written at the moment of a
fix, against the sentence that was wrong, by somebody holding that sentence in their head. That is the
worst possible moment to choose what the test matches on, and the best possible moment to think it is
obvious. **Ask what else would violate this rule and not match this pattern** — and if the answer needs a
grep, run the grep then, while the rule is still in frame.

### 22.5 Two more copies of the rule, in the files the guard does not read

§22.4 ended with an instruction to itself: *ask what else would violate this rule and not match this
pattern — and if the answer needs a grep, run the grep then.* It was not run. Two copies survived.

**`INVARIANTS.md` still had the sentence.** *"A non-blocking one goes in the run's report and dies with the
session, unless it needs code changes — in which case it is work, and work already has a home."* That is
the §22 sentence almost verbatim, in the document that explains the workflow's guarantees to somebody
deciding whether to trust the tool, and **the guard ran over `skills/` only.** It now carries the three
ends by kind, with the dead condition named where it bit — *not size and not whether it needs code
changes, which every true observation about code does.*

**The guard now runs over `INVARIANTS.md` and `README.md` too.** Those are the two files at the package
root whose prose is ours and whose job is to describe the rules rather than execute them, which makes them
the likeliest place for a replaced rule to survive — nothing routes work from them, so nobody rereads them
when the routing changes. The lesson generalises one step past §22.2: **a guard scoped to the files that
*act* on a rule misses the files that *describe* it**, and a description is what a reader believes.

**And the reviewer's description promised a verdict it does not give.** `reviewer.agent.md`'s frontmatter
said *"returning a verdict with severities and cited evidence"* while its own body says *every item is
blocking or it is not, and there is no scale in between* — the §13 answer, contradicted on line 3 of the
same file. **A subagent's description is the line a host shows when it picks one**, so it is the only part
of that file a caller may ever read. The existing guard looked for `P0`–`P3`, which is the shape the
deleted findings file used; a promise of *severities* spells none of them. It is now keyed on the fact — a
verdict, review or report described as carrying severity — which is the same repair §22.2 made to the
backlog guard, applied before a second sibling turned up rather than after.

## 23. The gates never asked where an expected value came from

Asked for after a reading of a second repository's agent tree, which had solved this and whose solution was
entangled with its domain. The hole in this tool, stated as the request did: **a test can assert whatever
the code returned, and both gates pass.**

`context/roles/coder.md` had nine coding principles, the last of which says *"favour deterministic,
testable behaviour; keep tests focused on observable behaviour"* — and no step saying when a test is
written or where its expected value comes from. `claude/agents/reviewer.agent.md` walks the plan's review
checklist and the standards files the phase names, and asks of each item whether the implementation
satisfies it. Neither file, and no standards file in the vendored tree, asks the one question that
separates a test from a transcript.

### 23.1 Why neither gate catches it

**Gate 1 is the suite, and a copied expectation is the one assertion that cannot fail.** It passed on the
run that produced the number and it will pass on every run after, including the run where the behaviour
changes — because the change moves the expectation with it, and nothing outside the code ever said which
value was right.

**Gate 2 reads a checklist that was written before the tests existed.** The planner drafts review items
that name specific standards; the standards say to test behaviour rather than internals, which a copied
expectation satisfies perfectly. A reviewer answering *is this behaviour covered* gets a yes.

This is the third instance of the shape §13.1 named and §2.9 named before it: **no gate fails.** A README
describing a renamed flag, a control no keyboard can reach, and an assertion copied out of the code are
all invisible to a run that exits 0. The pattern is now established enough to state as a design fact rather
than a coincidence — *the three holes in this workflow are all outputs with no gate behind them*, and each
fix has had the same two halves: a question asked out loud, and a place to write the answer down.

### 23.2 What was taken from the reference tree, and what was left

The reference is a Temporal date-time library whose `tdd-dev` role, `gmt-reviewer` § *Why a green suite
proves nothing*, and `scripts/test-markers.mjs` carry the answer. Almost all of it is domain:
`@js-temporal/polyfill`'s catalogued defects, TC39 and RFC 9557 as authorities, `pnpm compat:oracle`,
test262 files, a priority-tier table, a zone matrix. **Three sentences survive the removal of the domain:**

1. **Decide what should be returned before any code runs**, and be able to say why in one line.
2. **Check it against something independent of the implementation** — never the code under test, never a
   helper the same change touches, never a reference implementation written for the task.
3. **A green suite establishes that the tests and the implementation agree with each other**, and nothing
   else.

The vertical-slice loop survives too, as a loop rather than as a tier table. What did not survive: every
named authority, every named tool, the word *oracle* — which carries the reference's whole apparatus of
approved sources and means nothing without it — and the *zero known bugs* rule, which is a project's
policy about its own defects and not a property of a correct test.

**One sentence was added that the reference does not have**, because this tool installs into repositories
that are not a specification-governed library: **say where the rule does not apply.** Documentation,
configuration and wiring that only passes a value through have no seam to observe, and test-first against
them produces a test of the framework. The reference never needed this — every task in it computes a date
— and a tool that ships everywhere does, or the rule gets quietly ignored on the two thirds of changes it
was never about and loses its force on the third it was.

### 23.3 The rule has one home, and four readers cite it

`context/workflow.md` gains a standing rule, placed beside the two it is kin to, with the blockquote
carrying all three sentences plus the exemption. **The four obligations are different work, which is why
they are in four files and not four copies:**

| File | Its obligation |
|---|---|
| `roles/coder.md` | the slice loop, in five steps: derive, check independently, watch it fail, minimal change, next |
| `plan-template.md` §8 + its notes | a row per value the feature computes, naming what decides it |
| `planner.agent.md` | finding those sources is research, and an unfound one is a §9 open question |
| `reviewer.agent.md` | two standing checks, run whether or not the checklist names them |

The content test asserts the blockquote appears in exactly one shipped file and the rule's **title** in the
other four — the §22 lesson applied before the fact: a test keyed on the rule's sentences would pass a
fifth file that restated them in its own words, which is the drift the standing-rules section exists to
stop.

**The reviewer's two checks are split because they fail differently.** A sourceless expectation is a check
that cannot fail; a rule nothing asserts is a check that was never switched on. A reviewer looking only for
the first leaves the second in place, and the second is the one that makes the next refactor free to break
a requirement silently.

**Why the reviewer and not the coder is the enforcement point.** The coder is the party with the motive —
it is the one who can make a test green by moving the expectation — so the check belongs to the reader who
never saw the implementation being written. The coder's own instruction is the weaker one on purpose: *say
where the value came from*, which is a thing to write rather than a thing to judge.

### 23.4 Gate 1's half: a marker check, offered and never installed

The reference's `test-markers.mjs` fails on a skipped, focused or expected-to-fail test, and on a
known-defect note. The transferable part is the first: **a runner reports a skip as a pass, and a focused
test silences every test beside it**, so the Test section can exit 0 while the suite asserts almost
nothing. That is a gap the four headings cannot see, which makes it exactly the case §13.2 opened *a heading
of your own* for.

**It ships as an offer in `/onboard` Step 7 and as a paragraph in `verify.notes.md`, and nothing else.**
Three refusals, each deliberate:

- **No script.** §4.2's rule is that `verify.md` is the only file naming a command; a shipped script would
  be a command in a file the project did not choose, in a runner this tool cannot know. What a project uses
  to detect markers — a lint rule, a runner flag, a few lines of its own — is its answer to write down.
- **No stub heading.** Adding a `##` to `stubs/verify.md` would make `stubGaps` report a gap to every
  existing install, for a section most of them will decline. §17.2's constraint, unchanged.
- **Optional, and declining is an answer.** A project that marks work in progress with a skip has chosen
  something this check forbids. The reference can forbid it because *zero known bugs* is its policy; this
  tool has no standing to make that choice for a repository it is installed into, and the one it does make
  — offer it, name what it protects, record the answer — is the same shape as every other `/onboard` step.

**The category is named and the syntax never is**, which is a new content test over every shipped template:
a marker's spelling is per-runner, so a template that writes one has picked a stack. *Skipped, focused or
expected to fail* is what every runner has.

### 23.5 What was not done

**No standards file was touched.** `context/standards/` is vendored verbatim from another repository (§6.3) and
`update` replaces the tree wholesale, so a rule written there is a rule lost on the next sync. The three
files checked for overlap — `react/testing.md`, `php/testing.md`, `philosophy/ai-agent-behavior.md` — all
say *test behaviour, not implementation*, and none says where an expected value comes from; the two rules
compose rather than conflict, so the workflow rule cites them for the half they own and states only its
own half. The citation is to the phase's `Standards:` line rather than to a path, per §17.3.

**No skill body changed.** The rule's readers are the two role files and the two agent prompts, and the
host-review fallback — the session reviewing its own diff — reads `workflow.md` already, since the
`AGENTS.md` block names it first. Adding a citation to `/feature-implement` and `/orchestrate` would have
bought nothing and cost the per-phase reading budget twice.

**No new status, no new file, no `check` rule.** A sourceless expectation is a review finding, which has
the three ends §12 and §15 already defined.

### 23.6 What it cost

`context/workflow.md` +1,643 bytes on the per-phase read, which is the only addition inside §17.1's budget;
`workflow.notes.md`, `plan-template.notes.md` and `verify.notes.md` are outside it by construction.
`roles/coder.md` +2,785 bytes, paid once per phase in the coder's own context rather than the
orchestrator's, and §17.4 moved that read into a subagent for this exact reason. `reviewer.agent.md`
+1,556, same argument. **Nine tests.** Verified by packing the tarball, installing into an empty
repository, and running `check` and `update --dry-run` against it.

## 24. The prose budget — a cut with no ratchet comes back, and the test that would hold one

Asked to shrink the tool's own prose and to propose before editing, on three premises: `README.md` is
26 KB, `onboard/SKILL.md` is 49 KB, `workflow.md` is 20.7 KB against §17.2's 14–16 KB target, and every
command loads these files. Two of the three sizes are right, the third is sixteen days stale in the wrong
direction, and the last clause is true of exactly one of them. **Nothing below moves a rule or deletes
one.** Measured first, because the interesting finding is not that the files are large — it is that
§17.2's cut has already been given back, that every byte of it was recorded on the way in, and that
nothing added the record up.

### 24.1 The measurement — ten commands, both answers, and the plan in the frame

**Method, same as §17.1 so the numbers compose.** Bytes, measured 2026-10-16 against the files on disk;
divide by four for a token estimate, which is an approximation held constant rather than a tokenizer. The
read set per command is **derived from the links the skill body carries** — a tool-owned file a command
tells you to read is written as a markdown link to `../../../context/<file>.md`, and a project-owned state
file it names in passing is bare backticks. That convention turns out to be exact in 10 of 10 skills for
the tool-owned half, and recomputing §17.1's five rows at `5a86de4` from it gives **78,570 — the recorded
total to the byte**, which is how the derivation was checked rather than assumed. §24.5 makes it a test.

What each command loads before it opens a source file. *Tool prose* is what this package ships;
*standards* is vendored and excluded from our own budget by the same rule `ourTemplates()` uses; *plan* is
the project's own document, at §20.1's measured median:

| Command | its `SKILL.md` | tool prose, tree as shipped | tree after `/onboard` | tracker answer | + standards | + the plan | total, shipped tree |
|---|---|---|---|---|---|---|---|
| `/roadmap` | 5,653 | 56,312 | 44,504 | 67,343 | — | — | **56,312** |
| `/feature-plan` | 14,418 | 86,834 | 75,026 | 96,619 | 31,808 | — | **118,642** |
| `/feature-implement` | 22,722 | 93,802 | 81,994 | 102,016 | — | 15,597 | **109,399** |
| `/feature-status` | 7,545 | 68,330 | 56,522 | 73,465 | — | 3,667 | **71,997** |
| `/feature-close` | 18,759 | 88,202 | 76,394 | 93,144 | — | 3,667 | **91,869** |
| `/orchestrate` | 16,615 | 88,399 | 76,591 | 88,399 | 31,808 | — | **120,207** |
| `/release` | 16,234 | 68,349 | 68,349 | 68,349 | — | — | **68,349** |
| `/prototype` | 6,557 | 45,038 | 45,038 | 45,038 | — | — | **45,038** |
| `/onboard` | 51,581 | 154,987 | 143,179 | 154,987 | — | — | **154,987** |
| `/tracking-migrate` | 13,382 | 70,124 | 58,316 | 70,124 | — | — | **70,124** |

**The floor under every row is 31,694 bytes** — `agents-block.md` 3,183 plus `workflow.md` 28,511 — paid
before a command's own body is read, because the block says to read that file first. `/prototype`, the
command whose own text says nothing in the workflow requires it, loads 45,038 bytes to draw two static
files.

**The tree-after-`/onboard` column is the honest one for a working install.** `/onboard` deletes
`tracking.md`'s *Under the tracker answer* subsection on a tree install, and that run is 11,808 bytes of
the 18,965 the stub ships with. The shipped-tree column is a pre-`/onboard` transient and is in the table
only because §17.1 measured there.

**The tracker answer costs 39,107 more across the ten commands** and is the answer that reads the same
rule in two files, which §17.2 chose deliberately: the relocation was neutral there and the tree answer
was what gained.

**The plan is counted as the orchestrator now reads it, not whole.** §20.4 observed that §17.1's budget
never counted the plan at all and that three readers opened one per phase. Since then the briefs carry a
phase, so the orchestrator's share is the ledger — §20.1's median 7.5% of 48,893, or 3,667 — plus, for
`/feature-implement`, the median largest phase section at §20.4's 24.4%, or 11,930. **A plan written
before phases carried `Standards:` and `Decisions:` lines still costs the full 48,893 per reader**, by
both those sections' own fallback rule, so the table understates every install that has a plan from before
0.25.0.

**What is still outside the frame, named so the next measurement does not re-discover it:** the coder's and
reviewer's own contexts (`coder.md` 7,689, `reviewer.agent.md` 6,866, `planner.agent.md` 6,379, each paid
in a subagent since §17.4), `context/README.md` 6,642 — linked from the always-loaded block, read by no
command — and the per-tool-call re-send of the orchestrator's whole context, which §17.1 priced at about
3M tokens for a thirty-call in-host coder and which §17.4's subagent default is what actually fixed.

### 24.2 §17.2's cut came back in sixteen days, and every byte of it was recorded on the way in

`context/workflow.md`, by commit:

| Commit | Date | Bytes | |
|---|---|---|---|
| `7a2afdb` | 2026-09-06 | 10,727 | `git.md` says where work lands |
| `d4a5bd8` | 2026-09-15 | 26,627 | the size §17.1 measured as *before* |
| `5a86de4` | 2026-09-30 | **20,656** | §17.2's cut — the 20.7 KB the premise quotes |
| `a5eccc8` | 2026-10-05 | 22,095 | `/release` |
| `b50ad14` | 2026-10-16 | 26,868 | an end for a plan's open questions |
| `6f5192a` | 2026-10-16 | **28,511** | the coder's correctness rule |

**+7,855 in sixteen days, which is 39% of everything the §17 pass recovered, and the file is now 1,884
bytes larger than before it was cut.** §17.1's five-row like-for-like total has gone 78,570 → **90,619,
+15.3%**.

**It is not drift and it is not duplication: 6,328 of the 7,855 is two new rules.** `b50ad14` added *What
happens to a question the plan could not settle* and its two subsections, 4,685 bytes; `6f5192a` added *An
expected value has a source, and it is never the code under test*, 1,643. Both are rules. Rules stay, so
**no proposal below reclaims those bytes by deleting what they say.**

**Each addition was reported against §17.1 in its own section of this record, and nothing ever summed
them.** §20.2 closed with *+3,479, or 4.4%*; §23.6 closed with *+1,643 bytes on the per-phase read, which
is the only addition inside §17.1's budget*. Both true, both local, and three sections apart there is no
reader who sees 15%. **A budget reported per change and never totalled is a changelog, not a budget** —
and that, rather than any one file, is what this section is about. PLAN.md already wrote the governing
finding for this shape: *a ban is only real if a test enforces it.*

**The same sixteen days, the other files:** `onboard/SKILL.md` 49,240 → 51,581; `feature-implement/SKILL.md`
20,668 → 22,722 (its §17.2 cut, +2,054 back); the package `README.md` 24,670 → 26,099;
`test/templates.test.ts` 106,068 → 150,005, **+41%**, which is the one number here that is pure good news
and is also why the test file is the thing a size rule has to be written carefully against.

### 24.3 Read-weight, not size — and the one premise that is false

**`README.md` is on no command's path.** The 26,099 bytes are the npm package page and the GitHub landing
read; the repository root `README.md` is a separate 3,670. Both are read by people, neither by a command.
It is worth fixing (§24.7) for the reader it is for, and it buys nothing on any invocation.

**`onboard/SKILL.md` is the largest file in the package and the cheapest to leave alone.** 51,581 bytes,
one reader, **once per install** — re-run after a stack change, which is rare by its own description.

**`workflow.md` is the only one of the three on the always path**, and the premise quoted it 7,855 bytes
light, from this record rather than from the file. The record's number was true on 2026-09-30 and is a
claim about a file that moves, which is the kind of claim this repository's own rule says to verify against
the thing rather than recall.

So the axis is **bytes × readers**, and the ranking it gives is not the ranking by size:

| File | Bytes | Commands that read it | Read-weight |
|---|---|---|---|
| `context/workflow.md` | 28,511 | 10 | **285,110** |
| `stubs/tracking.md` | 18,965 | 8 | **151,720** |
| `stubs/git.md` | 6,083 | 9 | 54,747 |
| `skills/onboard/SKILL.md` | 51,581 | 1, once per install | 51,581 |
| `stubs/release.md` | 7,816 | 6 | 46,896 |
| `blocks/agents-block.md` | 3,183 | 10 | 31,830 |
| `stubs/executors.md` | 4,043 | 6 | 24,258 |
| `context/workflow.notes.md` | 23,702 | 0 — cited by nothing in the loop | 0 |
| `README.md` (package) | 26,099 | 0 | 0 |

**`workflow.md` and `tracking.md` are 57% of all read-weight between them**, and `workflow.notes.md` —
the second-largest of our files — is free by construction, which is §17.2's relocation working exactly as
designed and is the destination every reduction below reaches for.

### 24.4 What is actually restated — three scans, and the answer that duplication is not where the bytes are

Three mechanical passes over the 39 our-owned templates (`standards/` excluded, as everywhere): identical
9-word runs across files, identical runs inside one file, and a hand-written pattern per rule family to
catch the same idea in different words. Every count below is from those scans, not from reading
impressions.

**Identical text in several files, and why none of it is worth touching.** The three largest are
deliberate one-per-file lines: the *Explicit invocation only — run this when the user types* clause in all
ten skill descriptions (a frontmatter contract, and a test asserts it), the *the stub is the answer; this
file is never read by a command* preamble in all six `<stub>.notes.md` (§17.2's whole point, stated where a
reader of that file needs it), and the *read this after `SKILL.md`, and only where `tracking.md` names the
tracker* preamble in all five `tracker.md`. Together about 2 KB, spread one sentence per file, each on a
path where the other copies are not loaded. **Parallel text in parallel files is not duplication in the
sense that costs anything** — the cost is bytes on one read, and none of these puts two copies on one read.

**Rules with more than one home — the family scan.** The shape to compare against is §23.3, which is the
newest and is right: the rule's blockquote lives in `workflow.md`, four readers name it by title and point
at the file, and a test asserts both halves. Measured against that:

| Rule family | Files | Verdict |
|---|---|---|
| *An expected value has a source…* | 6 | **cited, not restated** — §23.3's shape, test-enforced |
| *A bug is not a backlog entry* | 7 | **cited by title** in `/orchestrate` and `/feature-implement`; one restatement, below |
| *Documentation is part of the change* | 5 | cited; the plan template and `stack.md` hold their own halves |
| Gate 1's *Lint → Typecheck → Build → Test* | 7 | **deliberate**, and §17.2 recorded the decision: the test keeps the line in both skills |
| git-on-instruction-only | 8 | three homes by design — the block, `workflow.md`, `git.md` — each a different length |
| *a subagent if your runtime provides one* | 6 | the sentence that reaches a host mechanism without naming one; one copy per dispatching skill |
| the tracker-answer pointer | 17 | one sentence per file, §24.4's parallel case |

**Nothing in that table is a rule with two bodies**, which is the failure §2.5 predicts and §17.2's fourth
cut went after. The restating-rather-than-citing cases are small and specific, and they are in-file:

- **`workflow.md` says where a bug goes twice.** *A bug is not a backlog entry* (296 bytes of destination
  rule) and *Where a filed owner check goes* (389 bytes) carry the same three facts — the project's own bug
  shelf, never the backlog label, the workflow neither reads nor ranks it — for two different kinds of
  thing. The second can cite the first and keep only what is its own (*filed as what it is, not as a bug*,
  and that the person doing the check closes it). **~350 bytes**, and the citation convention for it
  already exists.
- **Three `| End | When | Where the record lives |` tables** in one file, at lines 310, 319 and 390. The
  first two are one rule split by blocking/non-blocking and belong together; the third is the open-question
  section's and shares two of its three rows with them. **~400 bytes** if the destinations are stated once
  and the two sections name their ends against them.
- **Argument prose in the two newest sections, which has a home that is already free.** *An object with an
  assignee, in a list somebody reads, is the point* (395 bytes, and it is the reasoning that sank two
  rejected stores) and *Two reasons it could not say otherwise even if it should* (500 bytes, one of the
  two reasons being this record's own §21 argument). `workflow.notes.md` is cited by nothing in the loop
  and exists for exactly this. **~900 bytes.**
- **`release.notes.md` says *true of every repository before anyone has looked* three times** and *a
  mechanism that is not on disk is a false answer, and every command would dutifully write into it forever*
  twice. **~800 bytes**, on a path only `/onboard` reads, once.
- **`stubs/tracking.md` says *the issue's type — set by the workflow, read by nothing in it* twice**, at
  lines 43 and 84, once as a table cell and once as prose. **~100 bytes**, and it is on eight commands'
  path until `/onboard` runs.

**Total identified, with every rule kept: about 1.75 KB on the always path and 800 bytes behind
`/onboard`.** Against a `workflow.md` that grew 7,855 bytes in sixteen days, **that is the finding**: the
restatements are real and worth fixing, and they are a quarter of one month's growth. **Duplication is not
where the bytes are. New rules are.** So the only lever that holds is one that makes the author of the
next rule choose — which is a limit — and the limit has to be a test, because a cut without one has now
been observed to come back in full.

### 24.5 The limit — one table, a ratchet, and the number the ratchet is for

**One limit per file, in bytes, committed, and checked by a test.** Bytes rather than words or tokens:
there is no tokenizer in this package and adding one for a test would be a dependency bought to measure an
approximation, while §17.1's bytes-over-four has been stable across every measurement in this record.

**`packages/create-ai-workflow/templates.budget.json`**, at the package root. Not under `templates/`,
because `files` ships that directory wholesale and an install has no use for the number; not in
`src/layout.ts`, because a generated table in a hand-written module is a merge conflict waiting for the
next two branches. `files` is `dist`, `templates`, `README.md`, `LICENSE`, so a root-level JSON is
developer-facing by construction.

**The limits are today's sizes rounded up to the next 512 bytes.** Not a target, not an aspiration — the
line the file is already at, so the test passes on the commit that introduces it and the first thing it
ever does is refuse the next unbudgeted paragraph:

| File | Now | Limit |
|---|---|---|
| `context/workflow.md` | 28,511 | 28,672 |
| `context/workflow.notes.md` | 23,702 | 24,064 |
| `stubs/tracking.md` | 18,965 | 19,456 |
| `stubs/release.md` | 7,816 | 8,192 |
| `stubs/git.md` | 6,083 | 6,144 |
| `stubs/executors.md` | 4,043 | 4,096 |
| `stubs/verify.md` | 2,479 | 2,560 |
| `blocks/agents-block.md` | 3,183 | 3,584 |
| `skills/onboard/SKILL.md` | 51,581 | 51,712 |
| `skills/feature-implement/SKILL.md` | 22,722 | 23,040 |
| `skills/feature-close/SKILL.md` | 18,759 | 18,944 |
| `skills/orchestrate/SKILL.md` | 16,615 | 16,896 |
| `skills/release/SKILL.md` | 16,234 | 16,384 |
| … | | every other our-owned template, same rule |

**`npm run budget:relock` writes the file; nobody types a number.** The table is generated, the generator
is the same walk `ourTemplates()` uses, and a new template appears in it automatically rather than being
unbudgeted because somebody forgot a line. **Superseded in one respect by §24.10**: the script only ever
lowers a limit, and a raise is typed by hand with a `why` naming the section that justifies it.

**The ratchet is the half that matters, and it fails in both directions.** Over the limit fails, with the
file, the size and the overage named. **More than 2,048 bytes under it also fails**, and says to re-lock —
so a reduction is written into the table in the commit that earns it and cannot be spent again on prose.
§17.2 recovered 30,756 bytes with no ratchet and 39% of it is back; this is the whole mechanism for not
repeating that. 2,048 is slack enough that an ordinary sentence costs nothing and a section does not slip
through: the smallest of §24.2's two additions was 1,643.

**Two hard ceilings on top, because per-file limits let growth spread.**

- **The always-loaded pair**, `agents-block.md` + `workflow.md`, today 31,694: **32,768**. This is the only
  number in the design that every invocation of every command pays, and it is 1,074 bytes from its line.
- **Every our-owned template summed**, today 385,755 across 39 files: **393,216**.

**The per-command totals are reported, not limited.** The test prints §24.1's table on every run and
writes nothing; a second set of hard numbers would mean two bookkeeping edits for one sentence, and the
tighter of two ratchets is the only one anybody ever sees fail. What the report buys is that the number in
§24.2's story — the one three sections of this record each reported a piece of — is in front of whoever
runs `npm test`.

**The read set behind the report is derived, and that makes it a second invariant worth having.** A
command may read only what it links: the test extracts the linked tool-owned files from each skill body,
and a file the prose names in bare backticks is not in the set. This is true today for the tool-owned half
of all ten skills except four mentions — `stack.md` in `/prototype`, `/orchestrate` and
`/feature-implement`, and `plan-template.md` in `/feature-plan` — each of which *is* read and should be a
link. **Four prose edits, no rule touched**, and the budget then cannot go stale against the skills the way
§17.1's table went stale against the files.

**Rejected — a per-directory total instead of per-file limits.** Growth inside a directory just moves
between its files, which is how `onboard/SKILL.md` could absorb a step and report nothing.

**Rejected — a limit on `test/templates.test.ts`.** It grew 41% in sixteen days and that is the only growth
in this repository nobody should discourage. The test file is not read by an agent and ships nowhere.

**Rejected — a `check` rule in the installed tool.** The limit is a fact about this package's development,
not about an install; a project's own `context/` files are theirs, and §20.5 already put the one size rule
an install needs — the plan ceiling — where it belongs.

### 24.6 Pinning an invariant without pinning its wording — and the measurement that says this is not the lever

**The census first, because the premise attributes §17.2's missed target to the tests.** 606 regex literals
in `test/templates.test.ts`, classified by the longest run of consecutive literal characters each one
requires: **45 pin 60 characters or more, 125 pin 40–59, 264 pin 20–39, 172 pin under 20.** Of 554
assertions, 333 resolve to a template by static reading; `context/workflow.md` is the largest single target
with **56 assertions, 20 of them pinning 40 characters or more.** The 221 unresolved ones assert against
local slices and are not attributed here — the attribution is a script, and it is reported as approximate
rather than cleaned up by hand.

**Four classes, and only one of them holds wording.** Read against what each protects:

- **Heading pins** — `/^### Documentation is part of the change$/m` and six more. These assert *this rule
  has a home and it is this file*, which is §17.2's load-bearing property. They cost nothing: a heading is
  a name, and the paragraph under it is free. **Keep, and prefer.**
- **Data pins** — `| whether a change owes a release note |`, `` | `/release` | the one act that consumes
  notes | ``, the Gate 1 order, the four phase states, `not started` spelled as two words. These are not
  prose; they are the table rows and the vocabulary an agent matches on, and §17.2 already recorded the
  decision to keep the Gate 1 line in two skills on purpose. **Keep, unchanged.**
- **Token pins** — `/\bunstaged\b/`, `/never standing policy/i`, `/not inferred/i`, `/option text/i`,
  `/written twice/`. Short, operative, and each one was added because its absence had been satisfiable: the
  `git add` case in the comment above the staging pin is the model. **Keep — these are already the shape
  this section is proposing.**
- **Sentence pins** — the ones that hold wording. In `workflow.md`: *the only pushes outside them are the
  two asked for by name…*, *Landing a change is not shipping it, and that holds for a deployed app as much
  as a published package*, *`/release` is the one command that may make one for something that is not a
  feature*, *A typed flag or a typed command is that ask*, *One run is one phase, unless `--all`*, and
  §23.3's three test-first phrases. **These are what to convert.**

**Measured, the sentence pins hold 508 bytes of `workflow.md`'s 28,511.** That is the sum of the literal
characters all nine require. Halving every one of those sentences recovers under a kilobyte, and the file
grew 7,855 bytes in sixteen days. **So the premise is wrong on this point, and §17.2's own account is the
right one:** the 14–16 KB target was missed because the rules were kept where the test says they live, and
the regrowth since is two new rules, not pinned wording. This proposal is worth doing for the next rewrite
and for the next author who wants to say a rule in fewer words. **It is not the lever for the ceiling, and
proposing it as one would have been the §20.1 error again** — a load-bearing claim nobody measured.

**The shape to generalise already exists in the newest test in the file.** §23.3's three tests are, in
order: the rule's heading is in `workflow.md`; the blockquote's opening appears in **exactly one** file,
asserted with `deepEqual(holders, ['context/workflow.md'])`; and each of four readers *names the rule by
its italicised title and points at the file*. Only the third test touches wording, and what it pins is a
**title**, which is a name the whole design already treats as stable. **Applied backwards over the other
32 describe blocks, that is the conversion.**

**The helper, so the conversion is mechanical rather than a judgement per pin:**

```ts
/** The rule's own section, from its heading to the next of the same or higher level. */
const saysIn = (file: string, heading: RegExp, terms: RegExp[]) => { … };

// before — one sentence, 101 literal characters, unrewritable
assert.match(flat(workflow), /Landing a change is not shipping it, and that holds for a deployed app as much as a published package/i);

// after — the operative terms, scoped to the section that must carry them
saysIn('context/workflow.md', /^### What a change announces is an answer/m, [
  /landing .{0,24}not shipping/i,   // the claim
  /deployed app/i,                  // and both halves it has to cover,
  /published package/i,             // which is what the sentence was there to hold
]);
```

**Scoping to the section is what makes the short terms safe.** `/deployed app/i` against the whole file
would pass on a mention three sections away; against the rule's own section it asserts that *this* rule
still names that case. The three pins together are 38 literal characters where the sentence was 101, and
the sentence can be rewritten, shortened, or split in two without the test noticing.

**The citation convention is already consistent and simply untested.** Thirteen italicised citations across
ten files resolve **exactly** to a `##` or `###` heading in `workflow.md`, and **22 of its 23 headings are
named verbatim somewhere outside the file** — the sole exception is *Where a filed owner check goes*, which
is also §24.4's one restatement. So two more structural tests cost nothing to satisfy:

1. **Every rule has one body.** For each standing rule, the opening of its blockquote appears in exactly
   one file — `holders`, generalised from §23.3 over a list of rule titles rather than written per rule.
2. **Every citation names its home.** An italicised phrase that matches a heading in a home file must be
   accompanied by a reference to that file, in the same file. This is §23.3's `TITLE` loop, hoisted out of
   one describe block and run over all of them.

**Optional, and cheap because it ships nowhere: one name per invariant.** The test file's 33 describe
strings, `workflow.md`'s 23 headings and the README's 30 bold claims are three vocabularies for one set of
properties — *one home for commands* and *Commands live in one file*; *git happens on instruction, never on
initiative* and *Nothing stages, commits, branches or pushes on your own initiative*. Measured agreement
today is **6 of 33 against the headings and 4 of 33 against the README.** Picking the heading's wording as
the name everywhere is a rename pass over about 27 describe strings and no shipped prose, and it is what
makes §24.7's new document provably complete rather than marketing.

**Rejected — ids or markers in the template prose.** A `<!-- inv:note-one-line -->` or a `[R12]` tag would
make every pin exact and wording-free, and it would put bookkeeping in a file whose only job is to be read
by an agent. §17.2's principle applies to noise as much as to bytes: the rule file is the one every command
loads.

**Rejected — snapshotting whole files.** Every edit becomes a snapshot update, and a test that is updated
by reflex is a test nobody reads. The 210 tests in this file are read, which is the property worth
protecting.

### 24.7 The README — ten lines that get somebody running, and the 9 KB that is not for a first reader

**Measured:** `packages/create-ai-workflow/README.md` is 26,099 bytes. *What makes it different* is
**9,102 of them, 34.9%**, 18 bold claims deep. The install command is in line 6; **`/onboard` — the step
without which `verify.md` names no command and `git.md` authorises nothing — first appears in row 9 of a
ten-row table**, 11 KB in. A first reader is told what is unusual about the design before being told the
second thing to type.

**The quickstart, as proposed, replacing nothing above it except by sitting there:**

````md
## Quickstart

```bash
npx @baldurpan/create-ai-workflow      # writes context/ and both skill trees; commits nothing
```

Then, in your coding agent:

| | |
|---|---|
| `/onboard` | **first, and once.** Writes your answers: the real test commands, who commits, where the backlog lives |
| `/roadmap "an idea"` | puts it on the backlog |
| `/feature-plan` | turns one backlog entry into a plan with a phase ledger — then stops |
| `/feature-implement` | runs the next phase: code, verify, review. One phase a run, or `--all` |
| `/orchestrate "fix X"` | one commit-sized change through the same gates, with no plan |

Six more commands below. Why it is built this way: [the invariants](…/INVARIANTS.md).
````

**The four are derived from the commands' own text, not chosen by taste.** `/onboard` and
`/tracking-migrate` run once per install by their own descriptions; `/prototype` says *nothing in the
workflow requires this command — skip it and every other command behaves identically*;
`/feature-status` says *it is never a prerequisite… it exists for when you want to know*; `/feature-close`
runs once per feature and `/release` when somebody decides. What is left is the four that move work:
three tier boundaries and the ad-hoc route.

**The 9 KB goes to `packages/create-ai-workflow/INVARIANTS.md`, one claim per property, each with the test
that holds it.** Not a WHY document and not a second design record — §24.6's naming pass is what makes this
worth more than the prose it replaces: the claims in that section *are* the describe blocks of
`templates.test.ts`, and a reader who wants to know whether *no skill names GitHub* is aspiration or fact
gets the test's name next to it. A test can then assert the two lists agree, which is the one thing a
marketing section can never be.

**It is not added to `files`, and the link from the README is absolute.** `files` is `dist`, `templates`,
`README.md`, `LICENSE`; the reader this document is for is deciding whether to adopt the tool, which
happens on npm or GitHub and before any install. A relative link would depend on the registry rewriting it
against the repository — plausible, **not verified here**, and an absolute `https://github.com/…` URL is
true on npm, on GitHub and in an unpacked tarball without the assumption.

**The command table stays in the README**, and so do the three tests that pin cells in it —
`/feature-implement [--all]`, *With `--pr` the run ends at a pull request*, and `/release`'s row. It is the
reference a returning reader comes for, it is 2,125 bytes, and moving it would move three pins for nothing.

**Result: about 17.7 KB**, in the order install → quickstart → tiers → commands → what gets installed →
`release-init` / `check` → scope.

**Not proposed, and named so it is a decision rather than an oversight:** `## Scope` (3,081 bytes) carries
the executor and model argument, which overlaps what `INVARIANTS.md` would hold. It is a reference section
for somebody already running the tool, it is where the `sonnet`/`opus` answer lives, and splitting it is a
second judgement call that should not ride along with this one.

### 24.8 What it would cost, and what is deliberately not proposed

**The work.** One `templates.budget.json` and its generator; a budget test with the two-direction ratchet
and the two hard ceilings; the derived read-set report; **four prose edits** to make a read a link
(`stack.md` in three skills, `plan-template.md` in one); the five named reductions in §24.4, about 1.75 KB
on the always path; the README restructure and `INVARIANTS.md`. Then, as separate work: the `saysIn`
conversion of 45 long pins, the two structural citation tests, and optionally the 27-string rename pass.

**Not proposed — moving a rule out of `workflow.md` to meet a number.** §17.2 was asked the same question
and refused, and it was right: *the rule has one home, and it is the file every command already cites.*
Every limit in §24.5 is set at the file's **current** size for exactly that reason — the ceiling's job is
to make the next addition deliberate, never to make a rule homeless.

**Not proposed — splitting `/onboard` into per-step files.** Its three detection recipes are 15,355 bytes
between them (step 4's git sweep 5,335, step 7's verification sweep 5,341, step 9's release sweep 4,679),
and a `detect.md` beside the body would take about 10 KB off a 51,581-byte read. It is declined for now on
read-weight: one reader, once per install, against a real risk that a command which fetches its own steps
skips one. Recorded here with the number so the next person does not have to measure it again.

**Not proposed — anything about `context/standards/`.** Vendored verbatim (§6.3), 26 files of it on a
`/feature-plan` or `/orchestrate` read, and §17.3 already bought the only reduction available to us by
making the plan traverse the table once.

**No release note is owed for this section.** `DESIGN-RECORD.md` is not the package, and nothing under
`packages/` changed. The edits it proposes are a different matter: `templates/` is what every install
inherits, so the reductions and the four link edits are a **minor** when they land, and the budget test,
the README and `INVARIANTS.md` are not.

### 24.9 The placement rule — a section only one command acts on lives in that command

**Asked for beside the duplication work, and it is the lever §24.4 said duplication was not.** A rule
restated in two files is a rule with two bodies; a rule stated once, in the file every command loads, that
only *one* command ever acts on is a different defect with the same cost — nine commands pay for it on
every invocation and none of them uses it.

**Measured across all 23 sections of `workflow.md`**, by which skills name the section's title verbatim and
then by reading what each one does with it:

| Readers | Bytes | Sections |
|---|---|---|
| Several commands, or every command | ~23,800 | the tier model, the two tables, every standing rule, *Phase status*, *The gates*, the defect contract and `notes.md` |
| **Exactly one** | **4,665** | *What happens to a question the plan could not settle*, *Where a filed owner check goes*, *The history row says what is waiting, in the Why* |

**One section qualifies, and it is 16% of the file.** The owner-check contract is `/feature-close`'s: that
command is the only one that reads a plan's §9 after activation — its own prose says so, *this is the last
command that ever will* — and the other nine never file, waive or write a history row.

**It was already a rule with two bodies as well**, which the §24.4 scan missed by looking for restated
*rules* rather than restated *procedure*. `/feature-close` carried the three ends, their destinations,
*never the backlog label*, *silence is not a waiver*, the two-ends case and the Outcome rule **in full**,
in its own words, before this change. `stubs/history.md` carried the Outcome rule a third time, where the
person who would invent a fourth value is reading. So the move is mostly a deletion.

**What stayed in `workflow.md`**, 1,172 bytes against the 4,665 the three sections held: that §9 has
readers after the planner and that in between it is the phases' to answer — which is
`/feature-implement`'s and `/feature-plan`'s as much as `/feature-close`'s, and is the half with several
readers; that what is still open at the retirement is an
owner check and **is not a defect**; one blockquote saying every one of them gets an end before anything is
written; and a pointer naming the command that has the ends and the shelf rule that already names the
destination.

**What moved into `/feature-close`**, +809 bytes on the one command that is the reader: the definition with
its four examples, *filed as what it is, and not as a bug*, that the person who does the check is what
closes it, and that this adds no status and no fourth phase state.

**Nothing moved into `workflow.notes.md`, because it was already there.** §21.8 recorded putting the
reasoning under a matching heading, and it is intact: *why not a file*, *why the outcome column gains no
value*, *the destination is the bug shelf and the kind is not a bug*. The two argument paragraphs §24.4
proposed relocating were **third copies** and are simply gone.

**Net: `workflow.md` 28,511 → 24,998, −3,513 on every invocation of every command**, against +809 on one
command and nothing on the other nine. The tests that pinned the moved sentences now read the file they
moved to, which is §17.2's rule for a relocation, and one new test asserts the ends have exactly one home
and that no third copy of the destinations table is left behind.

**`/prototype` needs no more than the two rules it says it reads** — checked, since it is the command with
the least to do and the same 28,511-byte floor. Its text cites the tier model and the feature/task rule;
it restates *never transcribe a credential* itself, in its own step 3; the git rule it needs is in the
always-loaded `AGENTS.md` block; and nothing else in `workflow.md` governs writing two static files under
`prototypes/`. **What it needs is about 1,900 bytes of a 24,998-byte file** — the preamble's tier model and
*Feature or task?* — and it reads all of it because the block says to read that file first, not because the
command asked. **That is a property of the block, not of the command**, so no per-command trimming follows
from it and none is proposed: a command that reads a subset of the rules is a command that misses the rule
nobody predicted it needed. It is recorded as the measured floor, and as the reason the always-loaded
ceiling in §24.5 is the number worth defending.

**The rule, for the next section somebody adds:** *a rule several commands act on lives in `workflow.md`; a
contract one command acts on lives in that command, with the standing rule and a pointer left behind.*
Both halves matter — §17.2 refused to move a rule to hit a size target and was right, and this is not that
move: the standing rule did not move, and the thing that did had one reader.

### 24.10 What was decided

**The ratchet fails on slack rather than warning.** A warning is a line of output nobody reads on a green
run, and §24.2 is the record of what happens to a cut nothing holds.

**A limit is never raised by a script.** `npm run budget:relock` lowers limits and refuses to raise one,
printing what it refused and why. A raise is typed by hand, and **the entry's `why` must name the section
of `DESIGN-RECORD.md` that justifies it** — the test parses the `§N.M`, checks that section exists, and
fails on an entry that names none. A generated file regenerates; a file whose numbers each carry a citation
is a decision somebody made.

**This is affordable here because this repository already writes a section per change.** §18 through §23
each did. In a repository that did not, the rule would price an ordinary paragraph at a design document,
which is the one way it could become the thing people route around.

**The rename pass is skipped and `saysIn` is deferred** until a pin actually blocks a cut. The pins are
about a kilobyte of `workflow.md`, and what §24.9's move needed from them was not a conversion at all: six
tests now read the file the prose moved to, which is §17.2's rule and cost nothing. §24.6 stands as
written and is not implemented.

**The `detect.md` split of `/onboard` is declined**, per §24.8.

**The agreement test between `INVARIANTS.md` and the describe blocks is skipped**, because it needs the
rename pass to pass. The document names the test file and **says that the pairing is maintained by hand
and not checked**, citing this section — a claim about its own reliability is the one thing a document
like that can always make true.

### 24.11 What was done, and what it cost

| File | Before | After | |
|---|---|---|---|
| `context/workflow.md` | 28,511 | **24,998** | §24.9's move; −3,513 on every command |
| `skills/feature-close/SKILL.md` | 18,759 | 19,568 | +809 on the one command that reads §9 |
| `context/release.notes.md` | 13,050 | 12,948 | −102; the restated standard became a pointer |
| `README.md` | 26,099 | **18,356** | −7,743; the quickstart, and §24.7's split |
| `INVARIANTS.md` | — | 9,528 | new, unshipped, linked absolutely |
| Three skill bodies | | +97 | a read is a link, so the budget's read sets are derived |

**The always-loaded pair is 28,181 bytes, down from 31,694** — the only number every invocation of every
command pays, and the one §24.5 set a ceiling on. **Our template prose totals 383,046 across 39 files.**

**`/feature-close` is the only command that got more expensive**, and it is the command the bytes are for.
Every other command's read falls by 3,513.

**The duplication cuts came in under their estimate, and the estimate was wrong in a way worth recording.**
§24.4 priced the `release.notes.md` repeats at about 800 bytes and the realised cut is 102. Each of the
three repetitions carried a clause that was *not* duplicated — *including one that publishes, where it says
the answer has not been set* — so what could go was the restated standard, not the sentence around it. **A
duplication scan measures the matching text, not the recoverable text**, and the difference was a factor of
eight here. The `stubs/tracking.md` repeat was **declined** on reading it: the two copies are a primitive
map's lookup cell and the prose section it points at, and a lookup table whose cell says *see below* costs
a reader a jump to save 100 bytes. Both are project-owned files besides, so a cut there reaches new
installs only — `update` cannot touch a stub.

**The budget.** `templates.budget.json` at the package root — 39 files, two ceilings, `slack: 2048` — and
`scripts/budget.ts` behind `npm run budget:report` and `npm run budget:relock`. It is not under
`templates/`, which `files` ships wholesale, and not in `src/`, which compiles into `dist/`: the number is
a fact about developing this package and an install has no use for it.

**The read sets are derived from the links**, so §24.1's table is recomputed rather than remembered. The
convention held exactly once the four reads became links, and the discipline it enforces is sharper than
expected: `/feature-plan` names `stack.md` twice and links it neither time, because both mentions are
inside the *planner's* brief — the subagent reads it, not the command. The same was true of
`/feature-implement`'s one mention, which was reverted to bare backticks for that reason.

**The derived numbers are not §24.1's to the byte, and every difference is the derivation being
stricter.** That table was built from read sets written out by hand against the same convention, and three
entries were generous: `stubs/history.md` counted in `/feature-close`'s, which writes a row to that file
rather than reading its prose; `stubs/stack.md` counted in `/feature-plan`'s, where both mentions are
paths handed to the planner; and `plan-template.notes.md` left out of it, which `/feature-plan` does link
and does read. `npm run budget:report` is the number from here on, because it is the one that is
recomputed: `/onboard` 151,372 across 15 files, `/feature-implement` 90,289, `/prototype` 41,554.

**Tests: 211 content tests** (one new: the ends have one home and no third destinations table survives)
**and 128 budget tests** — a limit and a ratchet per file, a cited section per limit, the two ceilings, and
the derived read sets. **All four refusals were exercised rather than assumed**: 600 bytes added to
`workflow.md` fails its limit, 2,500 removed fails the ratchet with the relock instruction, `relock`
refuses the raise and says why, and an entry citing a section `DESIGN-RECORD.md` does not have fails on
that alone — which is how §24.9's three new citations were caught before they were written. **Verified** by
packing the tarball, installing it into an empty repository, and running `check` and `update --dry-run`
against it: `check` clean at exit 0, 126 files current, nothing under **Next**, and `INVARIANTS.md`,
`templates.budget.json` and `scripts/` absent from the 137 files the tarball holds.

**What this does not do.** It buys nothing on the 48,893-byte median plan (§20.1), nothing on the vendored
standards, and nothing on `/onboard`'s 51,581 bytes. The budget's job from here is that the next
measurement is not a rediscovery.

---

## 25. The standards stop being vendored — the copy here is the source

**Decided 2026-10-16, by the owner:** `templates/standards/` is where the default standards are written
and maintained. `baldurpan/ai-engineering-standards` is retired. Nothing syncs from it, nothing links to
it, and `standards add` no longer has a default upstream to point at. This reverses §6.3's rule that *a
correction to vendored content belongs upstream, not here*.

### 25.1 Why

- **The owner edits the standards here.** The two upstream commits after 0.20.1 (2026-10-06 and
  2026-10-13) were made by agents following §6.3, each within a minute of the matching commit in this
  repository. The other repository had become a second place to remember, and nothing else.
- **The upstream rule failed a third time.** §6.3 records two: the 0.20.1 scope fix that held only here,
  and the re-vendor that reverted the `biome-example.json` rename. The third turned up while doing this.
  The copy's `README.md` lacked three rows sending validation, forms and "any `Date`" work to
  `tooling/dates.md`. Upstream added them on 2026-10-06, and `.source` claimed `f6feda35`, which has
  them. So the marker named a ref the tree did not match. That is the divergence §6.3 said `.source`
  cannot express, this time with the copy *behind* its ref instead of ahead of it.
- **One tree in two places is the drift this design exists to prevent.** A tree edited here is one fact
  with one home.
- **PLAN.md item 2 existed only because the content was copied from a repository with no licence.** Now
  that the content is written here, the package's MIT licence covers it.

### 25.2 What changed

- **What the copy lacked was brought over**, checked by diffing upstream `e69b3b9` against
  `templates/standards/`. That was the SSRF section in `security/api-security.md` (§13.4, which closes
  PLAN.md item 9) and the three `tooling/dates.md` rows. The deliberate differences stay:
  `biome-example.json`, `_dot_gitignore`, and blank lines in `tooling/ci.md`.
- **`templates/standards/.source` is deleted.** An install made by 0.25.0 or earlier has one in its
  manifest, so `update` removes it as *no longer shipped* and keeps managing the rest of the tree.
  `install.test.ts` holds that. The *bundled standards moved* line in `update` is gone, along with the code
  that compared refs. Per-file hashes already report every standards file that changed, so the line added
  nothing.
- **`standards add` is unchanged.** A tree someone swaps in still gets a `.source`, which is project-owned
  and which `update` never reads.
- **The tree stopped pointing agents at GitHub.** Its `README.md` said all paths were relative to the
  retired repository, and `templates/AGENTS.md` told agents to load that repository's README. Both now
  point at `context/standards/`. `standards.test.ts` asserts there is no `.source` and no template link to
  the retired repository.
- **The content guards in `standards.test.ts` stay.** They were written to survive a re-vendor, and now
  they simply hold the tree's invariants.
- **The budget still leaves `standards/` out**, for a different reason. It is reference content that a
  phase loads row by row through its `Standards:` line, not prose a command reads whole. Budgeting it is a
  separate decision with no trigger yet. `scripts/budget.ts`, `links.test.ts` and `templates.test.ts` now
  give their real reasons for excluding the tree, instead of "vendored".

### 25.3 What it costs

There is no standalone copy of the default to point `standards add` at. Anyone who wants the default as a
starting point for their own set takes it from an install's `context/standards/`. That was accepted.

**Verified** by `npm run check`, `npm run build` and `npm test` (455), then by packing the tarball (136
files, no `.source`), installing it into an empty repository, and running `check` (exit 0) and
`update --dry-run`. On a copy of `quotavero` at 0.25.0, `update` removed `context/standards/.source` as no
longer shipped, with no conflict, and kept all 78 standards files in the manifest. `check` still exits 0
afterwards.

---

## 26. Parallel phases — the round, the scratch tree, and the measurement that priced it

Asked for as: independent phases of one plan run at the same time, each with its own coder; isolation per
phase; a cap on concurrent coders; a merge back in phase order. **Designed first, reviewed, then built on
2026-10-17** with three parts of the design changed by the user — the flag, the refusals and what happens
to an overlap. §26.16 holds the recommendation it was built against, which was not to build it.

Three things changed on the way. The **round** turned out not to be a function of the `Depends on` column,
which is the half of the request the measurement does not support. The isolation turned out to be a
**scratch checkout rather than a workspace**, which is what makes it cost almost nothing and what keeps the
worktree rule intact. And **the flag went away**, which moved the permission for that checkout off §18.2's
typed flag and onto a written exception in `workflow.md` — §26.2 and §26.10.

### 26.1 The measurement, re-run — and the column it does not answer

**Re-measured 2026-10-16** across `baldurpan.com`, `bgmusik` and `piff`. Method: the `Depends on` column of
each archived plan's §6.1 ledger for the edges, each §6.2 section's **Files:** line for the paths, longest-
path levels for the unbounded round count, and greedy lowest-numbered-first list scheduling for the capped
ones. 19 files in the three `context/archive/` directories; **18 carry a phase ledger** — `piff`'s
`archive/PLAN.md` predates the shape and has none.

| | |
|---|---|
| Phases | **115** |
| Rounds, width unbounded | **80** |
| Rounds, cap 3 | **81** |
| Plans with no round wider than one | **3 of 18** |

**The 80 reproduces exactly.** The 121 does not: the gap is `CUTOVER-PIFF-IS-TO-WORKER`, which has **8**
ledger rows and 8 §6.2 sections, not 14 — its first round really is 6 wide. `SOLAR-ECLIPSES` (8 phases, 4
rounds) and `SUN-CALENDAR-FEED` (9 in 4) reproduce, and so does *most of `baldurpan.com` is nearly linear*:
10 of its 13 plans have a widest round of 2.

**Then the column that was not measured.** A round is only runnable in parallel if its phases do not write
the same file, and `Depends on` says nothing about that — it orders *information*, not paths. Of the **26
rounds that hold more than one phase** at cap 3:

| | Rounds |
|---|---|
| no shared **Files:** path | **3** |
| share only prose — a `.md` file, or anything under `context/` | 11 |
| share a path that is neither | **12** |

So the yield depends entirely on which rule forms the round, and the three candidate rules are three
different features:

| Round formed from | Rounds | Rounds holding >1 phase |
|---|---|---|
| `Depends on` alone | 81 | 26 |
| `Depends on` ∧ disjoint non-prose **Files:** | 94 | 18 |
| `Depends on` ∧ disjoint **Files:** | **107** | **7** |

**115 phases in 107 rounds is the honest number for the safe rule: 8 rounds saved, and 12 of 18 plans gain
nothing.** The six that gain are `ISAFJORDUR-SKY` (5+6), `SITE-CORE` (3+5), `SUN-CALENDAR-FEED` (4+5, 6+7),
`CUTOVER` (1+5+8), `FILMFREEWAY-IMPORT` (1+2) and `TESTING` (2+3).

**Prose overlap cannot be allowed, and the reason is mechanical.** The 11 rounds overlap on
`context/verify.md`, `README.md` and `context/stack.md` — the answer files. Two phases that each add a
section to one of those both append, in two trees, from one base: that is a conflict every time, in the
file that names this project's commands. §4.5 settled the same shape for `history.md` with `merge=union`
and refused it for a file whose lines are also deleted; `verify.md` is such a file. Overlap on prose is
not the cheap case, it is the certain one.

**And `Files:` is a prediction, not a contract.** Read in `CUTOVER-PIFF-IS-TO-WORKER`'s ledger: Phase 6's
*"**Files:** line grew from three paths to eleven, by the phase itself"*, Phase 7's *"grew from four paths
to five"*. Step 7 of the skill asks for exactly that — whatever a phase makes untrue is fixed by it. So the
round is formed on a prediction that the field says grows, which is why §26.3 checks it twice.

**The lever is the planner, not this command.** The 12 code-overlapping rounds are a choice `/feature-plan`
made: §7's documentation rows are already assigned per phase, and two independent phases both listing
`README.md` is a plan that could have assigned it to one of them. A planner that wrote disjoint phases
would move the 107 toward the 81. That is a `/feature-plan` change and it is not proposed here.

### 26.2 How it is asked for — it is not. The command decides, each round

**No flag.** `/feature-implement` forms a round itself, every time step 3 runs, out of the ledger, the
phases' **Files:** lines and the cap in `executors.md`. `--all` keeps exactly the meaning it had: it decides
whether there is a *next* round, never how wide one is. The design had a typed `--parallel` and the user
removed it — *how many phases run at once is the command's own decision, not a setting the user types.*

**What that costs is the permission argument, and it has to be paid somewhere else.** §18.2's model is that
`git.md` names two sources of permission and only two, the second being the user asking in this session —
and a typed flag is that ask. Without the flag, the scratch tree is this command acting on its own
initiative, which is the thing `workflow.md` and the always-loaded block both forbid by name. So the
exception is **written into the rule** instead of being carried by a flag: one sentence in `workflow.md`
beside the absolute one, and `git.md` or `workflow.md` — not `git.md` alone — as the block's answer to
*where does permission come from*. §26.10 has the words. This is strictly more durable than the flag was:
a flag authorises an invocation and is forgotten, where a written exception is a sentence a reader can
check the behaviour against.

**It also removes the axis question.** §18.5 refused `/bugfix` partly for fusing two orthogonal axes, and
width and distance were that same pair — `--parallel` for how wide, `--all` for how far. With width no
longer typed there is one flag and one axis, which is the version with nothing to argue about.

**Still rejected — `--parallel=N`.** The cap is a fact about the machine and the account, which is §4.3's
whole reason for `executors.md`: a number typed per invocation is one the next invocation forgets, and the
usage limit it exists for does not change between them. It lives in that file, and `1` is how a project
turns the whole thing off.

### 26.3 What forms a round — and the check that happens twice

**Forming it, from the plan:** the runnable phases — not `done`, every `Depends on` `done` — taken
lowest-numbered first, skipping any whose **Files:** line shares a path with a phase already in the round,
up to the cap. Say the round out loud before any coder starts: which phases, and for each one left out,
whether it was a dependency, an overlap (naming the path) or the cap.

**Checking it again, from the diffs:** before anything lands, each phase's actual work is compared against
what the round has already landed — `git diff --name-only <base>..<tip>`, the base recorded when the tree
was made and the tip that tree's HEAD, read out of the feature's own tree with no checkout. **A path in
both means the earlier phase stands and the later phase's work is thrown away**, and that phase **runs
again, one at a time, on the combined tree**, from step 7, with its row still `in progress`.

**And the tree is checked for uncommitted changes before either** — `git -C <tree> status --porcelain`.
Work a coder left uncommitted is in no commit, so there is nothing to cherry-pick and nothing to compare:
that phase is a coder that stopped short, which is step 11's *some landed* row with its tree kept, not a
landing. Landing what was committed and dropping the rest silently is the one failure in this design that
would produce a `done` phase missing half its work.

The design closed the later phase `blocked` instead; the user changed it, and the change is better. A
`blocked` row for a phase nothing is wrong with is a lie in the ledger, and it leaves a run that could have
finished the plan handing back work it is perfectly able to do — re-running on the combined tree is the
sequential run it would have had anyway, minus one wasted coder. It cannot loop: the re-run is alone, so
there is nothing left for it to overlap with. The discarded sha goes in the report, because it is readable
until git collects it.

What did not change is that **the two versions are never merged.** Nothing in this workflow has the
standing to decide which of two coders' versions of a file wins — `git.md`'s *discarding someone's work*
list is the same instinct one level down. And the check stays **before** the cherry-pick: verified against
git 2.56.0, a `git cherry-pick -n` that conflicts leaves *no cherry-pick in progress*, so
`git cherry-pick --abort` fails with `no cherry-pick or revert in progress` and the only way out is a hard
reset over the conflict markers. Checking the diffs one command earlier means that state never exists.

### 26.4 When it falls back, and which line said so

**Nothing refuses.** The design had these as refusals, with the flag reporting that it could not run; the
user replaced every one of them with a fallback to one phase at a time, said once, at the start of the run.
That is the right shape for a decision nobody typed: a refusal is a sensible answer to *you asked for
something this project cannot do*, and nobody asked. What survives is the **naming** — each line says which
file and which answer decided it, the way `--all` names the line that declined the continuation.

| The line | Why a round cannot run under it |
|---|---|
| `git.md` *Who commits* — **the user commits** | every mechanism below is a commit. A round that cannot commit cannot be cherry-picked back, and a tree carrying three phases at once cannot be cut into three commits — `--all`'s existing argument, one level down |
| `executors.md` *Coder* — **not configured, implement in-host** | one coder, by construction. This is the shipped answer, so a fresh install runs one phase at a time until that answer changes |
| the runtime cannot run two coders at once, whatever that answer says | same outcome — and **say which of the two it was**, the recorded answer or the host, because they are fixed in different places |
| `verify.md` has no **Prepare a fresh tree** answer (§26.12) | a scratch tree cannot be made runnable, so the coder cannot write a failing assertion and run it, which is step 3 of the loop §23 put in `roles/coder.md`. Name the file and `/onboard` |
| the cap is **1** | the project said one at a time. An answer, not a gap |
| `git worktree add` fails, for any reason | report the error and run the phase. A tree that cannot be made is not a phase that cannot be run — this row is new, and it exists because a fallback has to cover the mechanism failing as well as the policy forbidding it |

**The row for *where work lands* was wrong and is gone.** It said a round could not run in the main
working tree with the default branch checked out, because landing it *writes the default branch, which is
asked for by name each time*. That is `/orchestrate --pr`'s rule and it is about **pushing**: `git.md`'s
asked-by-name list has *pushing to the default branch*, not committing to it, and under the shipped answers
an ordinary one-at-a-time phase already commits there. A round commits and never pushes, so there was
nothing for the row to protect — and it turned the feature off in exactly the shape most of the measured
corpus has: 13 of the 18 archived plans live in a repository with one working tree and work going to
`main`. Caught by the user before this was committed.

**The round of one is not a fallback either.** Where the dependencies, the overlaps or the cap leave one
runnable phase, this is an ordinary run with no scratch tree and nothing to land — and it is the measured
common case for 3 of the 18 plans. Say the round was one phase and why; do not make a tree to run it in.

### 26.5 The scratch tree — a checkout, not a workspace

**One tree per phase in the round, made by the command itself with plain git**, at the feature branch's
HEAD, detached, under the repository's own admin directory:

```
git worktree add --detach "$(git rev-parse --git-dir)/phase-trees/<PLAN>-phase-<n>" HEAD
```

**The directory name is fixed — `phase-trees/` — because the location is the only thing that identifies
these trees as this command's**, which is what §26.10's sweep is keyed on.

**The sha `HEAD` resolved to is recorded with the tree.** It is the tree's base, and `<base>..HEAD` is the
phase's whole work however many commits its coder made — §26.8. It has to be recorded at that moment
because the feature branch moves as the round lands, so by the time the second phase is landed the first
phase's base is no longer anything the branch can be asked for.

**No branch is created**, and the recorded invocation in `executors.md` is not used — these are not
workspaces and they are not to be handed to anything that manages one.

Verified against **git 2.56.0** on 2026-10-16, in a scratch repository:

- A worktree **inside the git directory works**, and `git worktree list` still reports it — observable to
  git, invisible to anything that scans the working tree.
- **`git rev-parse --git-dir`, not `--git-common-dir`.** From inside a linked worktree it resolves to
  `.git/worktrees/<name>`, so under `git.md`'s worktree answer each feature's scratch trees sit under that
  feature's own admin directory. Two features in flight cannot collide, and §26.10's cleanup-by-location
  cannot reach another feature's leftovers.
- **`git worktree remove` refuses a tree with tracked modifications or untracked files** — exit 128,
  *"contains modified or untracked files, use --force to delete it"* — and **succeeds when the only
  leftovers are ignored**, taking an installed `node_modules` with it. So removal without `--force` cannot
  destroy work a coder failed to commit, and the cleanup needs no judgment to be safe.
- A detached commit has no branch, so **the worktree's HEAD is the only thing keeping it reachable.** That
  is why a blocked phase's tree is kept rather than its work being copied somewhere, and why removing a
  landed phase's tree is safe: the content is already a commit on the feature branch.
- **`git worktree list --porcelain` prints `branch refs/heads/…` for an ordinary worktree and `detached`
  for these** — re-verified 2026-10-17. That is the discriminator the removal rule needs, and it is a fact
  about git rather than about a naming convention anybody has to honour.
- **`git worktree remove` on a tree whose directory has already gone exits 0 and drops the record.** So the
  sweep never needs `git worktree prune`, which is repo-wide and would touch records that are not ours.

**Why the git directory and not the OS temp directory.** Same filesystem, so nothing is copied across
devices; and the temp directory can be swept by the OS mid-run, which would destroy the only copy of a
blocked phase's work. The property that makes the location safe is the one that makes it cleanable.

**The runtime's own isolation counts, where it has it**, and is described by what it does rather than named:
where a coder can be given its own temporary tree **of this same repository — one whose commits are objects
in this repository** — the command creates nothing and takes the same handle. A copy or a fresh clone is not
that: its commits cannot be cherry-picked from here, so it falls back the way an in-host coder does.

**The brief gains four sentences and `roles/coder.md` gains none.** Work in this directory; the plan here
is a stale copy and is not yours to edit; commit your work in this tree when you are done, because that
commit is what the caller takes; and other coders are running beside you, so a test that needs a server or
a fixed port is Gate 1's — leave it, and say which assertions you did not run. Committing is a property of
this dispatch, not of the role, and a role file that is one prompt for three dispatch shapes does not learn
about the third one. The fourth sentence is §26.6's problem stated to the one party that can act on it.

### 26.6 Gate 1 runs in one place, and the integration failure is designed out

**Both gates run in the feature's own tree, one phase at a time, in phase order** — not in the scratch
trees. This is a deliberate departure from the brief's *Gate 1 and Gate 2 run per worktree*, and it keeps
what that was for while removing what it costs:

- **Attribution is unchanged.** Phase *k*'s gates run on a tree holding phases 1…*k* of this round and
  nothing else. The tree with 1…*k*−1 just passed, so a failure at *k* is *k*'s, exactly as in a sequential
  run. The loopback cap stays two per gate per phase.
- **The combined Gate 1 is not a second thing.** The last phase of the round is gated on the whole round by
  construction — so the question *what happens when it fails here having passed in every worktree* has no
  state to answer for. That state was the design's weakest point and it is gone.
- **Nothing runs the verification stack twice at once.** `verify.md` names commands that may bind a port, a
  database or a lock, and there is no answer anywhere about whether two of them can run side by side. A
  design that gated in three trees at once would need that answer; this one does not.
- **One verification run per phase**, as today, rather than one per phase plus one for the round.

**What is concurrent is the coders, and only the coders.** That is also the only thing the cap in §26.11
ever has to count.

**But a coder runs commands too, and that is where the port collision survives.** §23 put a loop in
`roles/coder.md` — write the failing assertion, then make it pass — so three coders in three trees run
three test commands at the same time, and anything binding a fixed port collides on the second one.
The field case is `baldurpan.com`: its Playwright config binds **47321** with `reuseExistingServer: false`,
so a second run does not attach to the first server, it fails to start one. There is no answer anywhere
about this, and inventing a port-allocation answer for `verify.md` would be a second feature.

So it is **moved rather than solved**, to the one place that is already serial: the coder is told the others
are running and that a test needing a server or a fixed port belongs to Gate 1, which runs one phase at a
time in the feature's own tree — §26.5's fourth sentence. What the coder owes in return is to **say which
assertions it did not run**, because the alternative is a phase that reports green having skipped the half
of its own loop that needed a server. Gate 1 then runs them on the combined tree, which is strictly better
evidence than the same test run three times in three half-built trees.

**The same collision reaches *Prepare a fresh tree***, which the orchestrator runs once per tree per round
and which `verify.notes.md` already says may start a local service. There it is caught rather than
described: a prepare step that fails in a tree means the round does not run, no coder has started yet, the
trees are removed and the run falls back to one phase at a time naming the command and its output.

### 26.7 The ledger — one writer, and the row still rides the work

**Only the orchestrator writes rows, in the feature's own tree.** Coders never touch the plan — and this has
to be said rather than assumed, because in the field they would: `SUN-CALENDAR-FEED`'s phases 6 and 9 both
carry `context/plans/SUN-CALENDAR-FEED-PLAN.md` on their own **Files:** line.

- **The round's rows open in one write**, before any tree is made, as step 6 requires — one `in progress`
  and one Note each, naming the round.
- **A scratch tree carries a stale ledger and that is harmless.** It is branched before the opening write
  is committed, so its copy of the plan reads `not started`. Nothing in the tree reads it: the coder is
  briefed with its §6.2 section, and the one rule the brief adds is that the plan there is not to be
  edited.
- **The row still lands with the work, so §12's rule needs no exception.** `git cherry-pick -n` stages the
  phase's change without committing it; the row is written on top; one commit carries both. Verified on git
  2.56.0 — two scratch commits, each staged with `-n`, each committed with its row, one commit per phase on
  the feature branch.
- **No sha in the Note, and that is the difference from the tracker answer.** `tracker.md` needs one because
  a body edit is a remote write that cannot be part of a commit; here the row is in the commit, so the Note
  stays what §20.3 says it is — one line.

### 26.8 Bringing it back — the whole tree, as a range, in phase order

Each phase, in phase order: the finished-tree and overlap checks (§26.3) → `git cherry-pick -n <base>..<tip>`
→ Gate 1 → Gate 2 on the staged diff → close the row → **one commit**, carrying the phase's code and its
row.

**The range, not the tip.** The design landed one commit per tree, which assumed a coder makes exactly one.
Nothing tells it to, and nothing should: how a coder gets to the end in a tree nobody is going to read is
its own business, and `git.md`'s *one commit per phase* is about this branch, not about that one. Taking the
tip alone would drop everything before it **silently** — no conflict, no gate failure, a `done` row and a
phase missing most of its work. `<base>..<tip>` is the phase under either habit. Verified on git 2.56.0:
`git cherry-pick -n <base>..<tip>` applies every commit in the range, stages all of it, commits nothing, and
leaves no `sequencer` directory and no `CHERRY_PICK_HEAD` behind.

**Why cherry-pick and not merge or rebase.**

- **Merge** adds a merge commit per phase that `git.md`'s *one commit per phase* does not name, and
  `--squash` is cherry-pick by another name with the phase's own commit message thrown away.
- **Rebase** rewrites the scratch commit, which is the only durable record of what Gate 2 reviewed, and for
  a blocked phase the only copy of the work at all.
- **Cherry-pick by sha reads the scratch tree without touching it**, which is the property that lets a
  blocked phase's tree be kept exactly as its coder left it.

**Gate 2 is not re-run on the round.** Each phase's diff is reviewed once, as its own phase, against its own
§6.2 section. A second review of the combination would be re-reviewing passed work against no checklist.

**A gate failure loops back in the feature's own tree, and nothing is reset.** The design sent the loopback
to the phase's scratch tree and reset the staged cherry-pick to make room for the new commit, which is what
the second exception in §26.10 was for. Both were unnecessary and the scratch tree is the wrong place
besides:

- **The state is already right here.** The cherry-pick is staged in the feature's own tree, which is exactly
  what step 10 re-briefs a coder in on any ordinary phase. A coder works on top of it; nothing has to come
  off first.
- **The scratch tree cannot see the failure.** It was branched before the round started, so it is missing
  every phase that landed earlier in the round. A failure the *combination* caused — a shared bundle
  ceiling two phases each fit under alone — is invisible from there, and a coder briefed to fix it there
  would be fixing it against a tree where it does not reproduce.
- **And the scratch commit stays the durable record**, which is §26.8's reason for cherry-pick over rebase.
  A loopback that committed into the scratch tree would move it.

### 26.9 Mixed results

**The phases that passed land, and the round stops.**

- **A phase that ends `blocked`** — the cap, an overlap, or something external — does not hold the others
  back. Their work passed both gates in the feature's own tree and withholding it buys nothing.
- **A blocked phase's row Note names the scratch tree its work is in.** That is the one thing a later
  session cannot rediscover: `git worktree list` shows the tree, and nothing but the row says which phase it
  belongs to. One line, per §20.3.
- **A phase whose work was discarded for an overlap is not one of these.** It is not `blocked`, it has not
  part-landed, and the run finishes it — §26.3. The only phases that end a run are the ones that would have
  ended a sequential one.
- **The next round does not start.** `--all`'s stop list already stops on a phase that closed `blocked` or
  part-landed, and §18.6's rule holds here: a round does not widen a stop list.
- **Report per phase, as it lands** — `--all`'s rule, one level up. A run that dies three phases into a
  round has to leave that evidence behind it.

### 26.10 The one narrow exception, written out

It is an exception to a sentence that is currently absolute, so it is written where the rule is rather than
left to be inferred — §4.7's lesson about an implicit scope reading as a grant.

**A scratch checkout is not a worktree the rule is about.** `workflow.md` says nothing removes a
worktree *under any answer, any flag or any command*, and `executors.md` says a worktree is only ever made
by the recorded invocation. The reason §4.7 gives is a workspace that *"looks like a worktree and is missing
the half that made the answer worth choosing"* — the env files, the naming, the parent directory, the editor
or agent it is handed to.

**With the flag gone, this sentence is the whole of the permission**, so it is written beside the absolute
rule in `workflow.md` rather than inferred from the behaviour, and the always-loaded block's *only where
`git.md` says so* becomes *`git.md` or `workflow.md`* — otherwise the two always-loaded files contradict the
command on every run. That cost the block one line, and the content test that caps its length was raised by
one with the reason written in it.

- **What it covers:** a detached checkout with no branch, under the repository's own admin directory, at the
  fixed `phase-trees/` path, made and removed by one invocation of this one command for a phase of a plan it
  is running — never handed to a person, an editor or a tool.
- **Why it is safe:** there is no naming convention to honour because nobody looks for it; no editor to open
  it in; no env file to copy, because what makes it runnable is `verify.md`'s own answer and a project that
  needs a secret file says so there; and **no branch, so nothing can be pushed from it and no ref is left
  behind.**
- **What removes it:** `git worktree remove` without `--force`, **as soon as its phase lands.** One rule
  does the rest: **a tree whose phase did not land is kept, with its path in the report** — which covers a
  blocked phase and a discarded one without a second clause. A later run sweeps the same path and
  **never a worktree with a branch on it**, which `--porcelain` tells it apart and which is every worktree
  the recorded invocation has ever made.
- **What it cannot do:** destroy work. Without `--force`, git refuses a tree holding modified or untracked
  files (exit 128) and succeeds where the only leftovers are ignored — so an uncommitted half-phase stops
  the removal rather than being swept up by it, and the refusal goes in the report.
- **`/feature-status` had to learn about it**, because that command reads `git worktree list` and treats a
  tree as a feature in flight. A scratch checkout is a checkout of this repository, `roadmap.md` and all, so
  without one line there it would be reported as a second feature with a stale ledger. A tree with no branch
  is nobody's claim: skip it, name a leftover's path, remove nothing.

**There was a second exception and it is gone.** It read: a Gate 1 or Gate 2 failure on a staged cherry-pick
has to come off before the loopback's new commit goes on, which is `git reset --hard` territory — on
`git.md`'s asked-by-name-each-time list because *"uncommitted work has no second copy"* — and here it has
one, so the reset is allowed within that scope. The argument was sound and the premise was false: nothing
has to come off at all. The loopback re-briefs the coder in the feature's own tree, on top of the staged
cherry-pick, exactly as step 10 does on any ordinary phase (§26.8). **An exception nobody needs is still a
carve-out in an absolute rule**, which is the §4.7 failure one step removed, so the whole of it came out of
`parallel.md` and out of here. `git.md`'s list is untouched by this feature.

### 26.11 The cap — 3, and it costs one round in 115

**Recorded in `executors.md`, in the Coder answer, and 3 where that file says nothing.** The measurement
makes it close to free:

| Cap | Rounds for 115 phases |
|---|---|
| 2 | 86 |
| **3** | **81** |
| 4 | 81 |
| unbounded | 80 |

**A cap of 3 costs one round across eighteen plans.** `CUTOVER`'s 6-wide first round becomes two rounds and
nothing else in the corpus is wider than 3 once §26.3's overlap rule has run.

**`1` turns round-forming off**, which is the answer for a project whose account cannot carry three agents
and the reason the number is in a file rather than in a flag.

**It goes in the Coder section rather than a heading of its own**, which §4.6 notes means `update` will not
report it to an existing install. That is acceptable here and would not be for a stub section the command
cannot run without: an absent cap has a safe default, so an install that never hears about it gets 3. The
*Prepare a fresh tree* answer is the opposite case and got a `##` heading for exactly that reason — tested,
and confirmed against an install that predates it.

**It counts coders, which is all there is to count** — §26.6 made the gates serial.

### 26.12 `verify.md` gains the answer the field already wrote in prose

A scratch checkout has no `node_modules`, no `.env` and no build cache, so the coder cannot run the failing
assertion §23 requires. Read on 2026-10-16, all three live `context/verify.md` files already record what a
fresh tree needs — and none of them records it as a command anything runs:

- `baldurpan.com`: *"Prerequisites: Node 24, pnpm 10, `pnpm install` already run, and Playwright's Chromium
  installed."*
- `bgmusik`: *"`pnpm install` from the repository root, once per clone and after any dependency change."*
- `piff`: *"**In a new worktree this is not optional and not shared** — `node_modules` does not come across
  from the main checkout, so a fresh tree has none and every command below fails until it is installed."*

**So the answer exists, in the right file, as prose with no reader.** `/onboard` Step 7.2 already asks for it
— *"Ask about prerequisites too — a package manager version, an install step, a service that must be up"* —
and the answer has had nowhere to land. It gets a section:

- **`## Prepare a fresh tree`**, in `stubs/verify.md`, placed **below *Not run by Gate 1*** so Gate 1 never
  runs it on an ordinary phase. The existing rule — *Gate 1 runs every section above that one* — already
  covers it, so nothing about the gate contract changes.
- **Empty means one phase at a time**, per §26.4 — not a refusal and not a gate failure. *Nothing to
  prepare* is a real answer and is not the same as silence, which is the distinction `verify.md` already
  draws for a missing section.
- **One sentence in `/onboard` Step 7.2**, so the prerequisite answer is written into the section instead of
  into the preamble. The guidance goes in `verify.notes.md`, which no command reads.
- **The cost is paid per phase, per round.** An install in every scratch tree is the one cost that scales
  with the width being bought, and on these three repositories it is a `pnpm install` against a warm store
  against a coder run measured in minutes. Named rather than hidden.

### 26.13 The tracker answer

The ledger in an issue body changes four things and leaves the hazard it already has unchanged.

- **The assignee is unchanged, and a phase gets no object of its own.** §10.10 superseded sub-issues; three
  coders working at once do not bring them back. A feature still has exactly one writer, which is what makes
  the body safe to edit, and a coder holds nothing.
- **One body write per round boundary**, not one per phase: the round's rows open in one read-modify-write
  and close in one. Fewer windows against a person editing the body, which is `tracker.md`'s one hazard the
  tree answer does not have.
- **The sha rule applies, and here it is load-bearing.** A body edit cannot ride a commit, so each closing
  row names the commit that landed its phase — **the cherry-picked commit on the feature branch**, never the
  scratch commit, which has no branch and stops existing when the tree is removed. A row naming a sha
  nothing can resolve is worse than one naming none.
- **The heartbeat comment is per round, naming every phase in it.** An assignee is a lock with no expiry;
  a run that dies mid-round leaves three open rows instead of one, and the comment is the only thing outside
  the process that can say so.

### 26.14 Where the prose goes, and what the budget pays

**Almost all of it in `skills/feature-implement/parallel.md`**, read only where step 3 forms a round of more
than one phase — the `feature-plan/split.md` shape, and §24.9's placement rule: a contract one command acts
on lives in that command.

| File | Was | Is | Note |
|---|---|---|---|
| `skills/feature-implement/parallel.md` | — | **12,720** | the round, the fallbacks, the scratch tree, the landing, the overlap, the removal, the report |
| `skills/feature-implement/SKILL.md` | 22,722 | 23,804 | the header's *one round*, step 3's round and its pointer, step 14's unit |
| `skills/feature-implement/tracker.md` | 8,214 | 9,019 | one body write per round boundary, and a sha that resolves |
| `skills/feature-status/SKILL.md` | 7,545 | 7,862 | a detached tree is nobody's claim |
| `skills/onboard/SKILL.md` | 51,581 | 52,842 | Step 7.2's answer gets a destination, and Step 7.7 proves it in a clone |
| `context/workflow.md` | 24,999 | 25,396 | the exception beside the absolute rule, and *one run is one round* |
| `context/verify.notes.md` | 3,016 | 4,326 | what *Prepare a fresh tree* takes, and what keeps it clean |
| `context/executors.notes.md` | 5,150 | 5,503 | the cap, documented where `/onboard` reads it |
| `stubs/executors.md` | 4,043 | 4,601 | the cap, in the Coder answer |
| `stubs/verify.md` | 2,479 | 3,015 | `## Prepare a fresh tree` |
| `blocks/agents-block.md` | 3,183 | 3,231 | the standing rule's second permission home |

**The always-loaded pair stayed inside its ceiling: 28,627 against 28,672**, 45 bytes to spare. That was the
constraint the user set — *put the detail in the files `/feature-implement` loads* — and it held, at the
price of the exception in `workflow.md` being three lines rather than a paragraph.

**Eight per-file limits were raised by hand** — `workflow.md`, `verify.notes.md`, `stubs/verify.md`,
`stubs/executors.md`, both of `/feature-implement`'s files, `/feature-status` and `/onboard` — each with a
`why` naming a subsection of this one, plus an entry for `parallel.md`. Only `executors.notes.md` and
`agents-block.md` fit as they stood.

**And the our-templates ceiling went from 383,488 to 402,944 — a raise of 19,456 bytes, 5.1%.** That is the
honest headline number for this feature, and 12,720 of it is one file that is read only when a round of more
than one phase forms. §24.5's point is that this is a typed decision with a reason beside it rather than
drift; it is still the largest single raise that ceiling has taken. The corrections after the first build
are 3,584 of it — §26.18's whole-tree landing and port rule, and §26.19's clean-tree check in all three
files that answer for it.

### 26.15 What was refused

- **Coders in the feature's own tree, no worktrees at all.** It is the cheapest version and it cannot have
  per-phase gates: Gate 1 reads the working tree, so a tree holding three phases' work — one of them
  half-written — gives a failure that belongs to nobody. The worktree is load-bearing, and this is why.
- **Letting prose paths overlap** (the 94-round rule). It buys 11 rounds and pays in guaranteed conflicts in
  `verify.md` and `README.md`, which are the files that answer what the commands are.
- **The orchestrator writing the shared prose path itself**, for both phases, so a wider round could form.
  It recovers those 11 rounds and lands an edit **Gate 2 never saw**, in the one file class where being
  wrong is most expensive.
- **Resolving a conflict between two coders.** Nothing here has the standing to decide whose version of a
  file wins. §26.3 detects the overlap one step earlier instead.
- **Closing a phase `blocked` because another phase touched its files.** The design did this and it was
  wrong: nothing is the matter with that phase, and the run can finish it. §26.3 re-runs it alone.
- **A typed flag**, which the design had. It made the permission cheap to argue for and the feature cost
  the user a word to remember; §26.2 pays for it with a written exception instead.
- **Reusing scratch trees across rounds**, re-pointing them at the new HEAD to keep the dependency install.
  It would pay for itself — §26.12's cost is per phase per round — and a tree that outlives its phase is a
  workspace again, carrying the previous phase's ignored build output into the next one's gate: §4.7's
  *looks right and is missing half*, in a new costume.
- **Making the scratch trees through the recorded invocation.** They would arrive named, env-copied and
  possibly handed to an editor or an agent — a workspace per phase, three per round, in the user's tools.
- **`--parallel=N`**, and **a fifth `/onboard` question for the cap**: §18.2's rejection of writing the
  answer instead of asking, and §4.3's reason the number belongs in `executors.md`. The cap ships at 3 with
  a safe default, so an install that never hears of it is correct rather than broken.
- **A `check` rule.** Nothing here is a fact about an install, per §24.5's third refusal. A leftover scratch
  tree is the one candidate, and `git worktree list` already answers it — `/feature-status` reports it.
- **`git worktree prune` in the sweep.** It is repo-wide, and removal of a vanished directory works without
  it (§26.5). A command whose exception is *only our own trees* does not run a repo-wide command.

### 26.16 What it would cost, and what I would decide

**The build:** one new ~6 KB file, seven edits totalling about 1.8 KB, five budget raises, and the content
tests — the round's two checks, each refusal with the line that caused it, the scratch-tree location and its
detached shape, cherry-pick-by-sha in phase order, the row riding the work, the per-phase report, the two
exceptions with all three of their parts, the cap and its default, and the `verify.md` section with its
refusal. Then CLAUDE.md's three checks and the tarball install.

**What it buys, measured: 8 rounds out of 115 phases, in 6 of 18 plans** — and that is an upper bound,
because it is computed from **Files:** lines the field says grow, and every growth turns a round into
§26.3's second check firing.

**Two things worth weighing before building it.** The parallelism already exists one tier up: `git.md`'s
worktree answer puts several *features* in flight at once, bounded by nothing but the same usage limit, and
that is built, running in five repositories, and needs no exception to any rule. And the measurement says
the within-plan version is small **because plans write overlapping phases** — which makes `/feature-plan`
the cheaper place to spend the next change, and would raise the ceiling this flag is working under before
the flag is built.

**So: the design is settled and I would not build it on these numbers.** If it is built anyway, build it as
written — the scratch tree, the two checks, the serial gates — because that version costs one prose file and
breaks nothing, and the version that looked valuable at 30% is the one that merges the answer files by hand.

**The user read that and chose to build it anyway, on 2026-10-17**, with the flag removed, the refusals
turned into fallbacks and the overlap re-run instead of blocked.

### 26.17 What was built, and what it cost

One new file — `skills/feature-implement/parallel.md`, 11,036 bytes as first written and 12,116 after
§26.18, read only where step 3 forms a round of more than one phase. Ten edits elsewhere, listed in §26.14, the largest being the exception in
`workflow.md` and the cap in `stubs/executors.md`. Two existing content tests changed: the one pinning
`workflow.md`'s *one run is one phase*, which is no longer true, and the cap on the always-loaded block's
line count, raised by one for the second permission home with the reason in the test.

**25 new content tests**, in one block covering what forms a round, the prose-counts rule, the cap and its
default, every fallback with the line that caused it, the scratch tree's shape and location, the
runtime's own isolation being described and not named, the one ledger writer, cherry-pick by sha in phase
order, the overlap sending the later phase back to run alone, the removal rule and the `--porcelain`
discriminator, the sweep by location, the reset exception, the report, and the `verify.md` section. **480
pass, 0 fail**, up from 455 — and 482 after §26.18.

**Verified** by `npm run check`, `npm run build` and `npm test`, then by packing the tarball (137 files),
installing it into an empty repository, and running `check` (exit 0) and `update --dry-run` (clean). Then
against an install that predates the new section: `update --dry-run` reports *`context/verify.md` has no
"Prepare a fresh tree" section* and names `/onboard`, which is the path an existing install takes to the
fallback rather than to a broken run. Every git mechanic in this section was re-verified against **git
2.56.0** on 2026-10-17 in a scratch repository: the detached tree under the git directory, `--porcelain`'s
`branch` versus `detached`, the overlap read from the feature tree with no checkout, `cherry-pick -n` plus a
row in one commit, removal refusing a dirty tree (exit 128) and succeeding with only ignored files, removal
of a vanished directory exiting 0, and a discarded commit still readable by sha after its tree is gone.

### 26.18 Four corrections, before any of it was committed

The user read the built version and found four things wrong with it. All four are now in `parallel.md` and
in the sections above; this is what they were and what each one was worth.

**One — the *where work lands* fallback was borrowed from the wrong rule.** §26.4 turned rounds off in the
main working tree with the default branch checked out, reasoning that landing a round *writes the default
branch, which is asked for by name each time*. `git.md`'s asked-by-name list says **pushing** to the
default branch, not committing to it; that sentence came from `/orchestrate --pr`, which pushes. A round
commits, which an ordinary one-at-a-time phase on that branch already does under the same answers. The row
bought nothing and cost everything: **13 of the 18 archived plans in the measurement live in a repository
shaped exactly that way**, so the feature would have been off in most of the corpus it was measured
against. Gone — and the test now asserts its absence rather than its presence.

**Two — the gate loopback belongs in the feature's own tree.** The design re-briefed the coder in the
phase's scratch tree and reset the staged cherry-pick to make room, which needed the second exception in
§26.10. Two things were wrong at once. The state was already right in the feature's own tree — a staged
cherry-pick is what step 10 re-briefs a coder in on any ordinary phase, so nothing has to come off. And the
scratch tree is **missing every phase that landed earlier in the round**, so a failure the combination
caused cannot be reproduced there, let alone fixed. §26.8 has the replacement; the exception came out of
`parallel.md` and out of §26.10, and `git.md`'s *discarding someone's work* list ends this feature
untouched. **The best outcome available to a design is an exception it turns out not to need.**

**Three — land the tree, not the commit.** The design cherry-picked one sha per phase, which assumed a coder
makes exactly one commit in its own tree. Nothing tells it to and nothing should. So the base sha is
recorded when the tree is made (§26.5), the overlap check and the landing both read `<base>..<tip>`, and a
tree with uncommitted changes in it is **a coder that stopped short rather than something to land** —
step 11's *some landed* row, tree kept. The failure this removes is the quiet one: landing the tip alone
produces a `done` phase missing most of its work, with no conflict and no gate failure to notice it by.
Verified on git 2.56.0 — `git cherry-pick -n <base>..<tip>` applies every commit in the range, stages all of
it, commits nothing, and leaves no `sequencer` and no `CHERRY_PICK_HEAD`; and `git -C <tree> status
--porcelain` is empty in a tree whose coder committed everything.

**Four — coders in a round collide on a fixed port.** §26.6 had designed the collision out of the *gates*
and left it in the *coders*, which §23 requires to run their own failing assertion. Three at once means
three test commands at once, and `baldurpan.com`'s Playwright config binds **47321** with
`reuseExistingServer: false` — so the second one does not attach to the first server, it fails to start
one. Rather than invent a port-allocation answer for `verify.md`, the brief gains a fourth sentence: the
others are running, a test needing a server or a fixed port is Gate 1's, and **say which assertions you did
not run.** Gate 1 is already serial and already on the combined tree, so those assertions end up with
better evidence than they had. The same collision reaches *Prepare a fresh tree*, which the orchestrator
runs per tree — there a failure means the round does not run, and since no coder has started, the trees are
removed and the run falls back naming the command.

**What it cost:** `parallel.md` 11,036 → **12,116** bytes, its limit and the our-templates ceiling each
raised once more by hand (§26.14), and **two new content tests** — an unfinished tree landing nothing, and
the brief's fourth sentence — with four rewritten to the range form, the loopback and the absent row.
**482 pass, 0 fail.**

**One claim in §26.3 changed with the form.** Re-verified on git 2.56.0: a conflicting `cherry-pick -n` of a
**single sha** leaves no cherry-pick in progress, so `--abort` fails with *no cherry-pick or revert in
progress* (exit 128) — the fact the design was written against. A conflicting **range** is different: it
stops part-applied with the `sequencer` directory open, and `--abort` exits 0. The rule is unaffected, and
it is not the reason for the rule either: the check stays before the cherry-pick because the way out of a
conflict is a choice between two coders' versions of a file, which is the decision nothing here has the
standing to make. Recoverable or not, that state is one this command never creates.

### 26.19 A prepared tree has to come back clean

§26.12 gave `/feature-implement` a section to run in a fresh checkout and §26.18 caught it failing. It can
also **succeed and still ruin the round**, which the user caught next: an install that rewrites the
lockfile, or a step that generates a file nobody ignores, leaves the tree dirty **before the phase has
started**. Nothing downstream can tell that from the phase's own work:

- **Landing reads it as a coder that stopped short.** §26.18's finished-tree check is
  `git -C <tree> status --porcelain` empty, and a rewritten lockfile is exactly what that check reports. A
  phase whose coder did everything right lands nothing.
- **Or it lands and the overlap check discards the round.** §26.3 compares the real diffs, and a lockfile
  every tree rewrote is a path every phase in the round touched — so every phase after the first is thrown
  away and re-run one at a time, which is the fallback with the cost of the round already paid.

**So the tree is checked after *Prepare a fresh tree* runs**, with the same command and the same outcome as
a failure: remove the trees, **name the files it changed**, and run one phase at a time. An installed
dependency directory is not dirt — verified on git 2.56.0, `status --porcelain` lists no ignored file, so an
ignored `node_modules` reads clean, a rewritten lockfile reads ` M` and an unignored generated file reads
`??`.

**The two answers that prevent it belong where that section is filled in**, so `verify.notes.md` carries
them: the install form that reads the lockfile instead of rewriting it, and a `.gitignore` entry for
anything a step here generates. **Named by shape, not by package manager** — §4.2 keeps every real command
in `verify.md`, and the content test that enforces it caught the first draft of this paragraph naming three.
Three of the four violations in the reference repo named a tool the project did not have, which is the same
mistake one level up.

**And `/onboard` proves it rather than asking.** Step 7 already runs every gate candidate; *Prepare a fresh
tree* is below the Gate 1 line, so step 4 skips it, and the tree `/onboard` is standing in is the one tree
where the answer cannot be tested. It gets its own step: clone the repository into a temporary directory —
`git clone --no-hardlinks . <tmp>`, **not a worktree**, so §26.10's exception stays the only one and
`workflow.md`'s *no other command makes or removes one* stays true — run the candidates there, then check
`status --porcelain` is empty. A dirty tree is a wrong answer and is fixed as one, in the answer rather
than around it. Where the repository has no commit there is nothing to clone, so the section is written
unverified and says so.

**What it cost:** `parallel.md` 12,116 → **12,720**, `verify.notes.md` 3,655 → **4,326**, `onboard/SKILL.md`
51,818 → **52,842**, three more hand-typed per-file limits and the our-templates ceiling at **402,944** —
19,456 above where §26 found it. **One new content test**, and one existing one — *one home for commands* — did its job
on the way through. **483 pass, 0 fail.**

### 26.20 The sweep deleted the work the keep rule had just promised to keep

§26.10 wrote the removal rule as one sentence with a keep clause — *a tree whose phase did not land is
kept, with its path in the report* — and then a second sentence that took it back: **a later run sweeps
the same path, removing what it finds there by the same test.** That test is the *removal* test, which is
about the tree's **shape**: detached, no branch, no `--force`. It says nothing about whether the phase
landed.

**And the shape test passes on exactly the tree worth keeping.** A coder that followed its brief
*committed* — that is the third of the four sentences the brief adds — so its tree is clean, and removal
without `--force` succeeds on a clean tree. Re-verified on **git 2.56.0** on 2026-10-17: two commits in a
detached tree under a working tree, `git worktree remove` exits 0, and the tip is unreachable afterwards.
The next run would have destroyed a blocked phase's work and left the Note naming a path that no longer
exists. **The keep rule was correct and the sweep was keyed on the wrong fact.**

**The fix is that the test is the row, not the shape.** A tree goes when its phase's row reads `done`, and
the sweep reads the ledger before it removes anything. Three consequences, all of them cheaper than the
alternative:

- **A tree whose path names another plan is left alone**, and named in the report. This run has not read
  that plan's ledger and has no business guessing at it — the same reason §26.15 refused a repo-wide
  `git worktree prune`.
- **The Note carries the tip beside the path.** The path is what a sweep destroys; the tip is what survives
  one, and `git merge-base <branch> <tip>` recovers the base if the recorded one is lost. Still one line,
  so §20.3 is untouched.
- **A resumed phase lands its kept tree rather than re-running the coder.** The work is finished and
  nothing has reviewed it; briefing a second coder over it throws a phase away to arrive back where it
  already was.

**That last one needed a second reader, which is the same bug one level up.** `parallel.md` opens *where
step 3 formed a round of more than one phase* — and a resumed phase is a round of **one**, so the rule
telling it to land the tree would have lived in a file that run never opens. The header now names the
second case and step 4 points at it, because a row whose Note names a tree is where a session finds out.
**A rule written in a file its reader does not open is the failure this section is about, written twice.**

### 26.21 A phase that blocked mid-landing cascaded into every phase after it

§26.9's first bullet — *a phase that ends `blocked` does not hold the others back* — was written when the
loopback ran in the phase's own scratch tree. **§26.18 moved the loopback into the feature's tree and the
bullet was not re-read.** After that move, a gate that hits its cap at phase *k* leaves *k*'s half-work
**in the one tree every later phase is landed on top of**, and step 12 commits it with the `blocked` row.

So carrying on does this: phase *k*+1 is cherry-picked onto *k*'s broken state, Gate 1 fails for reasons
*k*+1 did not cause, its loopback briefs a coder to fix somebody else's phase, and the cap blocks it too.
**One blocked phase becomes a round of blocked phases, each with a Note about a failure it did not cause.**

**A blocked phase now ends the round's landing**, exactly as it ends an `--all` run. Every later tree is
kept and landed by the next run under §26.20, from rows that still read `in progress` from the opening
write. The bullet was true of the phases that landed **before** the blocked one and false of the ones after
— and §26.9's own heading already said the right thing, *the phases that passed land, and the round stops*.

**The general shape, which is §22's with no guard in it at all.** A sentence that was true under the old
mechanism, sitting under a heading that already described the new one, in the section the correction itself
edited. §22 found a stale sentence a *test* was keyed too narrowly to catch; this one had no test, so the
content test now pins the cascade and the reason rather than the bullet's wording.

### 26.22 Where a coder's tree can live, once the host is asked

The scratch tree was placed under the repository's own admin directory — §26.5 — and every claim made
about it as *git* is true, re-verified on git 2.56.0: the worktree works there, `git worktree list`
reports it, `--git-dir` resolves per-feature inside a linked worktree, and nothing scanning the working
tree sees it. **What was never asked is whether the host running the coder may write there**, which the
user asked for before letting the placement stand.

**The host all seven installs run on says no.** Read first-hand from the documentation on 2026-10-17 —
`code.claude.com/docs/en/permission-modes` and `/worktrees`, not reported from memory:

- **`.git` is a protected directory.** Protected-path writes are **Prompted** in `default` and
  `acceptEdits`, routed to a classifier in `auto`, **Denied** in `dontAsk`, and allowed only in
  `bypassPermissions`. And they cannot be allowlisted out: *"`permissions.allow` rules in settings files do
  not pre-approve protected-path writes."* A coder in a tree there is asked about **every file it writes**
  — which is not a coder running unattended, and the round exists to run three of them at once.
- **A subagent in its own worktree is sealed out of the main checkout entirely**: an `Edit`, `Write` or
  `NotebookEdit` targeting a path in it, a command whose working directory resolves into it, and git
  redirected there by `-C`, `--git-dir`, `GIT_DIR`, `GIT_WORK_TREE` or a `cd` are all blocked — and *"they
  also cover the main checkout a linked worktree is linked from."* The admin directory is inside the main
  checkout under both of `git.md`'s answers, so that coder could not be pointed at a tree there at all.
- **Under the worktree answer it is not even inside the session's directory.** Verified on git 2.56.0:
  `--absolute-git-dir` from a linked worktree is `<main>/.git/worktrees/<name>`, and a linked worktree's
  own `.git` is a *file*, so nothing can be placed "under" it from there.
- **And the runtime's own isolation is not the way out.** Its worktrees land in `.claude/worktrees/<name>`
  on a new branch, and they *"branch from your repository's default branch unless `worktree.baseRef` is set
  to `head`"* — a tree with none of this feature's work in it. It is removed automatically only when the
  subagent *"finishes without changes"*; with changes it waits for a periodic sweep that **keeps** anything
  holding *"changed or untracked files, or unpushed commits"*, which a committed phase is for as long as
  the branch is unpushed. Parent-initiated removal is not documented.

**So this was not a fallback row. The location was wrong**, and it moves into the working tree the run is
standing in: **`.phase-trees/<PLAN>-phase-<n>`**, still detached, still plain git, still removed without
`--force`. The three requirements the user set, each verified rather than argued:

| Requirement | Why the new location holds it |
|---|---|
| no prompt per edit | it is inside the session's own working directory — the scope `acceptEdits` and auto mode auto-approve — and not a protected path |
| a defined removal | unchanged: `git worktree remove` without `--force`, which refuses a dirty tree, now gated on the row (§26.20) |
| not picked up by the feature tree's own tools | the directory is git-ignored, and `/onboard` proves that against this project's own commands — **§26.25**, which is where this row was wrong once |

**The dot is not the load-bearing part, and §26.25 is the correction.** What was measured here is narrow
and still true: TypeScript 5.9 with `include: ["**/*.ts"]` does not see a broken file inside a nested
checkout at `.claude/worktrees/…` and reports it the instant the pattern names the dotted directory, and
node's own `fs.globSync("**/*.ts")` behaves the same. Those are two glob *libraries*. **The tools a project
actually puts in `verify.md` walk the tree themselves**, and two of them walk straight into a dotted
directory — so what keeps Gate 1 out is the ignore entry, written and **proved** by `/onboard`.

**What it cost before the ignore entry, and why that entry pays for itself twice.** A tree in the working
tree showed up as one untracked line — `?? .phase-trees/`, because git stops at the nested checkout's
boundary rather than listing its contents — and **`git add -A` stages a nested checkout as a gitlink**
(mode `160000`), with a warning and exit 0, so the first draft of this section carried a rule about
staging by path. §26.25's entry removes both: verified on git 2.56.0, an ignored tree is absent from
`status --porcelain` and `git add -A` leaves it alone. The rule came back out of `parallel.md`.

**Two things the old location was chosen for survive.** Per-feature isolation is now structural rather than
a trick of `--git-dir`: each feature's trees are inside that feature's own working tree, so a sweep cannot
reach another's. And the recorded path is **absolute** — `git rev-parse --show-toplevel` plus the fixed
path — which is the other half of the review's `--absolute-git-dir` finding, since `--git-dir` prints a
relative `.git` from a main tree's top level and an absolute path from a subdirectory, so what landed in a
Note depended on where the command happened to be standing.

**The host limit is named by shape, in a fallback row**: *the host will not let a coder write in the tree
this command can make, or confines it to one of the host's own.* §4.2's rule — this record names the
product and the template names the shape, because a template that names one host is wrong everywhere else.
Under that row the runtime's tree is taken if it passes three tests, the first a command rather than a
claim: `git -C <tree> rev-parse HEAD` is the sha this round recorded; something removes it when the phase
lands; and it is outside this working tree or dotted inside it. **What is different about it is written
down rather than worked around** — it has a branch, so the detached test does not cover it, removing it
leaves a ref this workflow never deletes, and `/feature-status` cannot tell it from a feature in flight for
as long as it exists. All three go in the report.

**Three placements were refused.** Writing into the host's own worktree directory, because it is the host's
to sweep and that is §26.5's argument against the OS temp directory wearing new clothes. A sibling
directory outside the repository, because outside the working directory is a prompt's or a classifier's
business in every mode that matters. And **adding `.gitignore` entry for `.phase-trees/`**, which would
make the untracked entry disappear and is a repository edit this command has no permission to make; a
project that wants it can add the line, and nothing here depends on it.

### 26.23 Four holes in the round's contract

Smaller, and each one a sentence that was right about the sequential run it was lifted from.

- **A round is formed from `not started` phases only.** An `in progress` or `blocked` phase passed step 3's
  runnable test and could join a round — but its half-work and its Note are in the feature's own tree, and
  a scratch tree branched from HEAD has neither. A resumed phase runs alone, as it does today.
- **A path that contains another is an overlap.** *Compared whole* read `src/` on one **Files:** line and
  `src/a.ts` on another as disjoint. They are one place, and the two coders find out by both editing it.
  **The plan's own path is the one exclusion**, because this command is its only writer and the field puts
  it on a phase's `Files:` line — `SUN-CALENDAR-FEED`'s phases 6 and 9 both do.
- **Step 7's §9 answer keeps its reader.** *An open question this phase settles is answered in the plan's
  §9, by this phase* — and in a round the phase is a coder that may not touch the plan. The coder reports
  what it settled; this command writes it, in the commit that carries the row.
- **A discarded phase's Note stops naming its tree.** The opening write puts the tree's path in every
  row, and step 4 now reads a Note that names one as *land that tree* — so the one tree whose work the
  overlap rule threw away would have been landed by the next run, which is §26.20's bug with the sign
  flipped. The tree is still kept and still named in the report; the Note is what changes.
- **Under the tracker answer the closing rows are one write per phase, as each lands.** §26.13 batched both
  boundaries for symmetry. The opening write can be batched because no phase has landed yet; the closing
  ones cannot, because the row does not travel inside the commit under that answer — so a run that died two
  phases into a round would leave two commits recorded nowhere but git, and the sha is the row's only
  evidence. One more write window costs less than that.

**And the brief's fourth sentence gained the third thing a fresh checkout does not have.** §26.18 gave it a
server and a fixed port; a `.env` is untracked by definition, so `git worktree add` leaves it behind and
*Prepare a fresh tree* cannot write one. A test that needs a secret fails in the tree for a reason that has
nothing to do with the phase, which is the same disposal the other two get: leave it to Gate 1, and say
which assertions you did not run.

### 26.25 "Invisible to a glob" was a claim about two glob libraries, not about Gate 1

§26.22 moved the phase trees into the working tree on the strength of a measurement, and **the
measurement did not cover the tools that matter.** What was run was TypeScript's `include` globs and
node's `fs.globSync` — both of which skip a path segment beginning with a dot. What was written down was
*a tool that finds its own work by glob does not descend into a path segment starting with one*, as a
property of tools in general. It is a property of two glob libraries.

**The field runs tools that walk the tree themselves.** Measured by the user against the real versions,
and the configurations confirmed here by reading the three repositories on 2026-10-17:

- **Biome 2.5.15 lints files under `.phase-trees/`**, including under `baldurpan.com`'s own `biome.json`.
  It skips them once the folder is git-ignored **and** `vcs.useIgnoreFile` is on — which `baldurpan.com`
  and `quotavero` both set. **`dynjandi-core` has no `vcs` key at all**, so Biome there lints whatever git
  ignores, its `files.includes` opens with `"**"`, and its `check` script is `biome check --write .`:
  that gate would have **written into three coders' trees** mid-round.
- **Vitest 5 with its default `include` runs tests under `.phase-trees/`.** `baldurpan.com` and
  `quotavero` are safe only because their configs narrow `include` to `src/**`.

So during a round, phase *k*'s Gate 1 would have linted and tested the other phases' unfinished trees —
the exact failure the placement was chosen to avoid, in the two repositories the measurement was drawn
from.

**The ignore entry is the load-bearing property, and it is necessary rather than sufficient.**
`/onboard` writes `.phase-trees/` into the project's own `.gitignore` — not `.git/info/exclude`, which is
per-clone rather than shared and which sits inside the one directory §26.22 found a host refusing to write
to. Then **it proves it**: plant a file the lint command must reject and a test that must fail under
`.phase-trees/probe/`, run every command bound for a gate section, and none of them may see either. Where
one does, the fix is that tool's own setting — its ignore switch, its file list, its test exclude — named
in the report, because that edit belongs to the project. **Where it cannot be fixed, the cap goes to 1**,
which §26.11 already made an answer rather than a gap, so nothing new has to exist to say *rounds cannot
run here*.

**And the command checks the cheap half of it every round**: `git check-ignore -q .phase-trees/` at the top
of the working tree, non-zero being a fallback with its reason named. Verified on git 2.56.0 — exit 1
before the entry and 0 after, and it answers **before the directory exists**, which is when a round needs
it. Two details the test has to carry: **the trailing slash is required**, because a directory-only pattern
cannot match a path git cannot see is a directory, so the bare form reports *not ignored* until the tree is
there and *ignored* afterwards; and it runs **at the top level**, because a project that anchors the pattern
as `/.phase-trees/` reports not-ignored from a subdirectory.

**What it buys back:** the untracked `??` line and the `git add -A` gitlink rule both go, since an ignored
tree is absent from `status --porcelain` and `git add -A` leaves it alone.

**The lesson, which is about the word *verified*.** This record's own rule is that a verified claim says
what it was verified against. It did — *TypeScript 5.9 and node's `fs.globSync`* — and then the sentence
next to it generalised past that scope, which is the failure §20.1 recorded one level down: reasoning
correctly from a premise nobody had measured, except here the premise *was* measured and the conclusion was
widened anyway. **The tools that decide this question are the ones in `verify.md`, which is the file that
exists because this workflow does not know them** — so the only evidence that settles it is running them,
and the only command that can is the one that already runs them all.

### 26.24 What the corrections cost

`skills/feature-implement/parallel.md` **12,720 → 18,302**, the largest single move the file has taken and
the reason its limit and the our-templates ceiling were each raised by hand once more — **411,136**, which
is 27,648 above where §26 found it. `skills/onboard/SKILL.md` 52,842 → **54,528** for §26.25's step 7.8,
`feature-implement/tracker.md` 9,019 → 9,358, `feature-implement/SKILL.md` 23,804 → 24,046 for step 4's
pointer and step 3's `not started`, `feature-status/SKILL.md` and `context/workflow.md` byte-neutral at the
new path — the always-loaded pair came out one byte *lighter*, at 28,626 against its 28,672 ceiling.

**Verified** by `npm run check`, `npm run build` and `npm test`, then by packing the tarball, installing it
into an empty repository and running `check` and `update --dry-run` against it. Every git mechanic above was
re-verified on **git 2.56.0** on 2026-10-17 in a scratch repository with a linked worktree in it: the
detached tree in a dotted directory inside a working tree, `?? .phase-trees/` as the whole of what `status`
reports, `git add -A` staging a gitlink with exit 0, `git worktree remove` exiting 0 on a clean detached
tree and leaving its commit unreachable, removal of a branch worktree leaving the branch behind, and a tree
cut from the default branch failing the recorded-sha test. §26.25 adds `git check-ignore` answering before
the directory exists and only with the trailing slash, an ignored tree absent from `status --porcelain`,
and `git add -A` leaving one alone. The host's rules were read from its documentation, which is the only
place they are stated, and this record says so rather than claiming a tool verified them; the lint and
test behaviour in §26.25 was measured by the user against Biome 2.5.15 and Vitest 5, with the three
repositories' configurations read here.

---

## 27. `npm run check` was not checking the files most likely to be wrong

`tsconfig.json` is the **build**: `rootDir` is `src`, `outDir` is `dist`, and its `include` is
`src/**/*.ts` because that is what `tsc` emits. `check` was `tsc --noEmit` against that same config — so it
typechecked exactly what the build already typechecks, and **nothing else in the package had ever been
typechecked**: `scripts/budget.ts`, which decides every byte limit, and the whole of `test/`, where
`templates.test.ts` alone is 175 KB of assertions about prose.

**Those are the files most likely to go stale**, because they read the code rather than being read by it.
A content test names a function, an exported shape and a template path; when one of the three moves, the
test still compiles under no compiler at all and fails at run time with an assertion message about prose.

**A second config, `tsconfig.check.json`**, extends the build config, turns emit off, resets `rootDir` to
the package root and includes `src`, `scripts` and `test`. `check` runs that one; `build` still runs the
first, so `dist/` is written by exactly one configuration and the emit boundary is unchanged. **A single
config could not do both**: `rootDir: src` and a `test/` include are contradictory, and widening `rootDir`
for the build would change where `dist/` lands.

**It found a real error on its first run** — `test/standards.test.ts` destructured a regex capture group
and used it without a guard, under `noUncheckedIndexedAccess`, in the test added to catch a broken link in
the vendored standards. Nothing was failing; the test was one input away from throwing instead of
asserting. That is the whole argument for the config, found by the config, in the first minute it existed.

Housekeeping that rode along: four prose lines that had escaped the 110-column wrap during earlier edits
(`feature-implement/SKILL.md`, `feature-plan/SKILL.md`, `tracking-migrate/SKILL.md` and
`verify.notes.md`), and `tracking.notes.md`'s budget heading promoted to a `##` in the stub's own position
— §20.7.


---

## 28. `--pr` stays for the review — the half §18 pushed and then walked away from

Asked for as a loop: `/orchestrate --pr` should watch for code review, answer it, push fixes, resolve
threads and comment where one is wanted — and, added in the same conversation, put a label on the pull
request so that an automated reviewer picks it up. Both shipped. The interesting part is that §18.4
**already rejected** a long-lived `--pr`, and the argument it rejected is not this one.

### 28.1 §18.4's second count, read against what is actually being waited for

The refusal of `--automerge` ran on four counts. Three are about merging and are untouched here — nothing
below merges, approves, deletes a branch, enables auto-merge or reads a check run. **The second count is
the one that looks like it covers this, and does not:**

> It needs a session that outlives itself. `/orchestrate` keeps no resumable record on purpose — *"nothing
> here is half-finished in a way the next session could resume"*. A run parked on a check suite is
> precisely that, and a session that dies mid-wait leaves an open pull request and no record anywhere that
> a merge was intended. **That is a new terminal state in the one command built to have none.**

The load-bearing clause is the last one, and it is about **where the intention lives**. An intended merge
is recorded nowhere: the pull request looks identical whether or not anybody meant to merge it, so a dead
session loses the only copy of the plan.

**An unanswered review comment is the opposite case. The forge is already the record** — written by the
reviewer, in a thread that is either resolved or is not, visible to everybody who can see the change. A
session that dies mid-loop leaves exactly what every pull request on earth looks like between a review and
a reply, and a later run reads the same threads back. **So there is no new terminal state**, which is the
whole of §18.4's second count, and nothing resumable has to be invented to get it.

That is also why this is not the thin end of `--automerge`. The two differ in a property that can be
checked rather than in how far they go: *is the thing being waited for written down by somebody other than
this session?* A review is. A merge is not.

### 28.2 It completes the purchase rather than extending it

§18.4's first count states the flag's purpose outright — the push exists **so that a person reads the
change**, and *"a pull request nobody reads is the one thing this flag must not produce."* A run that
pushes and vanishes satisfies that halfway: the reader reads, writes a comment, and is handed a chore. The
reply is not a new capability bolted onto `--pr`; it is the second half of the one it already had.

**So it is not a flag of its own.** `--pr --watch` would make the useful half opt-in and leave the
abandoning half as the default, which is the wrong way round. The run is `--pr`, and the review is part of
where it ends.

**The pull request is still reported before the first round.** Today's deliverable is in front of the user
whether or not a comment ever arrives, so nothing that worked before this section is now contingent on a
loop finishing.

### 28.3 Threads, not statuses — the line that keeps §18.4's fourth count intact

What the loop reads is a **review comment** — a review, a line thread, a comment on the pull request —
whoever wrote it, person or bot. **A check run is not one.** That boundary is not squeamishness; it is
§18.4's fourth count, which found that *"green" is not one fact* and that deciding it needs the
repository's required-check list, **a forge fact `tracking.md` owns and a skill may not name.** A loop that
read statuses would have to decide what *required* means, in a skill, which is the thing that cannot be
written down there.

**A bot that writes its failure into a comment has written a comment**, and gets answered like any other —
so the useful part of reacting to CI arrives through the door that was already open, without the flag
having an opinion about check configuration.

### 28.4 Resolve only what landed — the asymmetry is the design

Replying and resolving are not one action. A resolved thread is gone from the reviewer's queue, so
resolving is **a claim that the thread is finished**, and the loop may only make that claim about something
checkable:

| The loop's answer | Thread |
|---|---|
| a fix, landed and pushed | reply naming the commit, **resolve** |
| words — answered, declined, out of scope, or a fix that failed its gates | reply, **leave open** |

The second row is where a reviewer still has to agree, and resolving it would take the change out of their
queue before they had. This is the same shape as §18.4's first count one level down: the value of the push
is a person's attention, and an agent that tidies away the record of what it was asked is spending that
attention rather than answering it.

**One reply in the thread it answers, and no new top-level comment.** A summary comment per round turns the
pull request into a transcript of the agent's own run.

### 28.5 Two bounds, and why a round count alone is not one

A cap on rounds is obvious and insufficient: a reviewer who re-opens the same thread after its fix would
spend all three rounds on one disagreement, and a bot that re-posts would spend them on nothing. So there
are two, and the per-thread one does the real work:

- **One fix attempt per thread.** A thread that comes back after its fix is a **disagreement, not a second
  defect** — reply, leave it open, hand it over.
- **Three rounds per run**, as the backstop.

**The gates are not a third bound, they are the existing ones.** Every fix a round produces runs Gate 1 and
Gate 2 with the same two-loops-per-gate cap, and a round whose gates do not come back clean **pushes
nothing**: it replies in the thread saying so and ends the run, which is §18.6's handback with a pull
request attached. A one-line fix a named reviewer asked for is still code nothing has verified, and the
push is what makes it everyone's.

### 28.6 A comment is a request, not an instruction

Everything this loop reads was written outside the session and arrives asking for work, which makes it the
first **untrusted input** any command in this workflow consumes. The skill says what a comment cannot do,
one line each: widen the scope past step 1's guards, lift a refusal or a cap, or authorise anything —
a merge, a force-push, a push to the default branch, a rewrite of published history.

**The permission a run carries is the user's, typed in this session** (§18.2). A sentence in a pull request
thread is not that, however it is phrased and whoever wrote it — and an approving review is the pointed
case: it is where the loop **stops**, not where it merges.

**Rejected: treating a comment as a brief.** The shortest implementation reads a thread and briefs a coder
with its text, and inherits whatever the thread asks for, including a scope step 1 would have refused. The
one bit each thread gets — *does it ask for a change to the change under review?* — is what keeps a comment
asking for a feature on `/roadmap`'s side of the tier boundary instead of quietly becoming unplanned work
with a pull request already open.

### 28.7 The label is an answer, not a string in a skill

The request named a literal label: `ai-review`. **A skill may not hold it.** `tracking.md`'s two labels are
parameters of a project-owned file for the reason §10.8 gives, and a test asserts no skill spells one —
hardcoding this one would ship one repository's label to every install, and `--add-label` against a label a
repository does not have is an error on an otherwise finished run.

**It is a fifth `git.md` answer: *What a pull request carries*.** Four reasons that file rather than
`tracking.md`:

1. The question is *what does a pull request this workflow opens look like*, and `git.md` is where the
   pull request already comes from.
2. It is independent of the tracking answer — a project can track in `roadmap.md` and still want its pull
   requests labelled — so putting it under *Under the tracker answer* would have been false.
3. It holds for **every** pull request the workflow opens, `/feature-close`'s and `/release`'s as much as
   this flag's, so it is not a flag parameter wearing a general name. Those two need no new sentence: the
   stub's opening line already has them read the file before any `git` or `gh` command that changes
   something.
4. §4.5's orthogonality survives — it implies nothing about the other four and they imply nothing about it.

**And it does not contradict §18.2.** That section says the flag does not read *Push and pull request*,
because that answer decides **whether** the workflow may push and the flag is itself the permission. This
answer decides nothing about permission; it is read only where a command is *already* allowed to open a
pull request. The stub says so in those words, since the sentence is one careless reading away from
becoming a loophole.

**Shipped as *no label*,** and §18.1's lesson is why that is not inertness. A fresh install has no reviewer
to summon, so the honest default applies none and says so — and the rounds still answer whoever comments
unasked, which is the behaviour that works with zero configuration. `/onboard` asks for the name **only
where a pull request is in the push answer**, since a project that pushes nothing has no artifact to label,
and it is a follow-up to a question already asked rather than a fifth question — §18.2 refused to make
every installer pre-answer something most will never use, and that still holds. The one thing `/onboard`
must do is **check the label exists before writing it down**: this is the only answer in the file that
fails when it is *used* rather than when it is written.

### 28.8 What it cost

A new conditional file, `skills/orchestrate/review.md`, on §24.9's rule — the loop is prose only `--pr`
needs, and plain `/orchestrate` should not pay for it. One new step in the skill, *Report* renumbered to 9,
one new section in `git.md` and in `git.notes.md`, one follow-up in `/onboard` Step 4, and one clause each
in `workflow.md`'s command table, its push summary, the always-loaded block and the package README.

**One fused sentence had to be split**, and it is the part worth recording. `--pr`'s refusals read *"does
not delete a branch, enable the forge's own auto-merge, or stay alive watching a check run"* — three
refusals in one list, with a content test asserting the string. Two of the three stand; the third was
**two refusals written as one**, *stay alive* and *watch a check run*, and only the second survives. A test
that matched the whole string would have failed for the right reason and been fixed the wrong way, by
deleting the assertion. It is split into one assertion each, so the two that still hold keep holding.

Budget raises, each named in `templates.budget.json` with `§28.8` as its `why`:
`skills/orchestrate/SKILL.md` to 18432 for the new step, `stubs/git.md` to 7168 and
`context/git.notes.md` to 5120 for the fifth answer, `skills/onboard/SKILL.md` to 55808 for the follow-up,
`context/workflow.md` to 25600 and the always-loaded ceiling to 29184 for one clause in each of two
sentences, `review.md` entered at 7680, and `our-templates` to 423424 for the sum. **Every number was
typed and then handed to `budget:relock`**, which lowered three of them to the 512-byte line the files
actually sit at — the script's one direction, and the reason a raise cannot quietly leave slack behind.

**Verified on 2026-10-19** by packing the tree, installing the tarball into an empty git repository, and
running `check` (clean, exit 0) and `update --dry-run` (129 files current, nothing under **Next**, exit 0),
with `review.md` present in both skill trees and every relative link in it resolving after install. `check`,
`build` and the 502 tests pass from the root; `budget:relock` reports every limit at its floor.

## 29. The loop answered a review it had not waited for — what one real pull request found in §28

§28 shipped in 0.27.0, and the first repository to take the update opened a pull request for it carrying
the `ai-review` answer that section invented. The app that answer summons reviewed that pull request, and
its review was about the loop that would have answered it. Three findings held; checking them turned up two
more. They share a cause worth naming: **§28 reasoned hard about what the loop must refuse and left the
mechanics of being reviewed at all implicit** — who summons the reviewer, when, whether anything has
arrived yet, and whose comment is worth a commit.

### 29.1 The label was promised by three commands and applied by one

§28.7 wrote the answer as the shape of the artifact rather than a flag parameter, and said so in `git.md`:
*every pull request this workflow opens carries it — `/feature-close`'s, `/release`'s and
`/orchestrate --pr`'s alike*. Only `review.md` ever read the section. `/feature-close`'s push step and
`/release`'s step 6 both open pull requests and said nothing about a label, and neither file's hash moved
in 0.27.0.

Two ways out. **Narrowing the sentence to `--pr` was rejected**: it is §28.7's own argument thrown away.
The answer is about the artifact, and a feature's pull request — a whole plan's worth of phases, landed
over days — is the one most worth a reviewer's attention. Labelling the ad-hoc change and not the feature
is the opposite of what the answer is for. So the other two commands read the section at the point they
open a pull request, and the *not created* rule travels with it: a missing label is reported and the pull
request is left alone, because a finished feature does not fail on a label.

**How the claim survived review in the first place** is the part to remember. A content test asserted the
sentence, and its rationale read *"it is not a flag parameter — `/feature-close` and `/release` open pull
requests too"*. The test was pinning prose that described behaviour nothing implemented, which is exactly
the failure §22 recorded in a different costume: an assertion about words cannot tell you whether anything
reads them.

### 29.2 A review asked for arrives in minutes, and round one read the threads at once

The loop said: apply the label *before the first round*; a round is *one pass over everything the review
has left unaddressed*; and **Nothing is unaddressed** ends the run. Run as written on a pull request thirty
seconds old, those three lines end the run before the review exists. The feature the user asked for was
*watch for the review and answer it*, and the loop as shipped could finish before being reviewed at all.

So a round reads, waits, reads again, and **gives each round up to fifteen minutes** before concluding
there is nothing. A number rather than *until it arrives*, because a bound somebody can check is the only
kind this file accepts; fifteen because an app-sized review of one pull request is a matter of minutes —
on the pull request that found this, the review landed **50 seconds** after the label — and past that the
thing being waited for is a person, which §28.1 already answered: the threads are on the forge and a later
run reads them back. A wait that expires reports the pull request as *opened, labelled and unread*, which
is a result and not a failure.

**This is not the wait §18.4 refused.** That was a wait for a merge, whose intention is recorded nowhere;
this is a wait for a comment, bounded, on an artifact that holds the record either way.

### 29.3 The label goes back on, because the reviewer takes it off

**Verified against the live forge on 2026-10-19**, on both pull requests that have used this answer: the
label was applied by the user and **removed by the reviewing app** three seconds to a minute later — the
app clears its own queue. A label applied once therefore buys exactly one review, of the first commit, and
every fix the loop pushes afterwards is unread by the thing the label exists to summon. The three-round cap
would have run its rounds against a reviewer the first round un-invited.

So the label goes on **whenever there is something new to read**: at the pull request, and again after each
round's fixes are pushed. Re-applying one that is still sitting there changes nothing, so this needs no
state, no bookkeeping and no forge fact consulted first — the cheapest possible shape for the fix.

**Rejected: writing in `git.md` that fix rounds are not re-reviewed**, which is what the review itself
suggested as the alternative. It documents the defect instead of removing it, and it bills every project
whose reviewer leaves the label alone for a limitation they do not have.

### 29.4 Standing — the axis §28.6 did not have

§28.6 bounded *what* a comment may ask for: it cannot widen the scope, lift a refusal or authorise
anything. It said nothing about *who* asked, and step 1 went out of its way to say the loop answers a
comment *whoever or whatever wrote it, a person or a bot*. On a repository anybody can read, that is a path
from a stranger's sentence to code written, gated and pushed on the user's credentials — into a pull
request the owner then reads as having been through the gates. The scope guards hold the whole way down
that path. None of them is about the author.

So step 2 asks two bits, and standing is the first: **the author of this pull request, an account the forge
says can write to this repository, or an app the repository has installed.** Anything else is replied to,
left open, and reported on its own line, because the user's sentence is what turns it into work — §18.2's
second source of permission, doing exactly the job it was written for.

**Why an installed app has standing is the part that had to be checked rather than reasoned.** The obvious
rule — trust whoever the forge associates with the repository — excludes the one reviewer this feature
exists to answer. On the pull request that found all of this, the reviewing app's comments carry
`author_association: NONE` while the human author's carry `MEMBER`, **verified against the live forge on
2026-10-19**. An association test alone would have silenced the reviewer the project wrote down in its own
`git.md`. An app earns standing a different way: it cannot comment on a repository nobody installed it on,
and installing one takes admin. A bot's comment is an installed app's comment by construction, and
somebody's decision is upstream of it.

**Rejected: naming the reviewer in the skill.** §10.8's rule — a literal in a skill ships one repository's
tooling to every install. **Rejected: extending the `git.md` answer to name who answers the label**, so the
loop could match the author against it. It makes trust depend on a clause the user may not have written,
and the installed-app argument needs nothing written down at all.

**Standing is never read off the comment** — not from a name, a title, a claim made inside it, or how much
it reads like a reviewer. The comment is untrusted input in full, including whatever its account says it
is.

### 29.5 The permission paragraph was still counting three things

`workflow.md`'s *A typed flag or a typed command is that ask* said each of the two authorises *that
invocation's commit, push and pull request*. Under §28 the flag also applies a label, commits and pushes
once per round, replies in threads and resolves them. That sentence is the always-loaded statement of what
a typed flag buys, so under-counting it is the §18.2 failure running backwards: the command does more than
the file says it may. One clause added, naming the rounds.

### 29.6 A section added to an older file leaves the sentence that counted them

§28.7 took `git.md` from four answers to five. The stub says five; a project-owned `git.md` written by an
earlier `/onboard` still says *four*, and the 0.27.0 `/onboard` added the fifth section without touching the
intro — which is what the install that found all this is now carrying. `git.md` is project-owned, so §6.2
puts it out of `update`'s reach by construction: nothing else was ever going to fix it.

One line in Step 4: where the file predates a section, the sentences that count them are part of the edit.
The class of bug is general and comes back at the sixth answer.

### 29.7 What it cost

Three hand-typed raises, each named in `templates.budget.json` with a `§29` section as its `why`:
`skills/orchestrate/review.md` 7680 → 10240 for the wait, the re-applied label and the standing bit;
`skills/release/SKILL.md` 16384 → 16896, its first raise since the budget was written, for the label
sentence; `context/workflow.md` 25600 → 26112 for §29.5's clause; and `our-templates` 423424 → 427008 for
the sum. `skills/feature-close/SKILL.md`, `skills/orchestrate/SKILL.md` and `skills/onboard/SKILL.md`
absorbed theirs inside limits §28.8 had already raised. **The always-loaded ceiling stayed at 29184**: it
was typed at 29696 and `budget:relock` took it back down, the script's one direction again.

Nothing was added to `/orchestrate`'s own load — §24.9 is still doing the work it was built for. All of
§29.2 to §29.4 lands in the conditional file, which only `--pr` reads.

**Verified on 2026-10-19** by packing the tree, installing the tarball into an empty git repository, and
running `check` (clean, exit 0) and `update --dry-run` (129 files current, nothing to write, exit 0), with
`review.md` at 9921 bytes in both skill trees and all four of its relative links resolving after install.
`check`, `build` and the 510 tests pass from the root, and `budget:relock` reports every limit at its floor.

The three findings this section answers were **verified against the live forge on 2026-10-19**, not read
off the review that reported them: the label events on both pull requests that have carried the answer
(applied by the author, removed by the app), the reviewing app's `author_association` on its own comments,
and the 50 seconds between the label going on and the review arriving.

## 30. `/roadmap` comes off the flag — the one command an agent may run

The observation that opened this was the user's: an agent cannot add to the roadmap. It could not, and
nobody had decided that it should not. Two rules, written for different reasons, met at this command and
nothing ever read them together.

### 30.1 Two rules that never met

**§3.1 put `disable-model-invocation: true` on every skill.** Its case was a loose description firing on
ordinary talk — `/feature-plan` on *plan out X* — and the transform in `layout.ts` applied it uniformly. No
section weighed a command on its own. §17.5 later settled that the flag removes the description from
context altogether, so under Claude Code an agent did not know `/roadmap` existed.

**§15.3 made `/roadmap` the only way into the backlog**, and told a gate with a feature-sized finding to
name the command and stop. Its reason was the worth-adopting test and the `Size:` and `Priority:` lines
the ranking reads — both of which live in the command. **That a person must be the one to type it was never
the reason.**

Together, the workflow routed every feature-sized finding to a command the agent was forbidden to run. Its
only legal move was to ask the user to type it, and a finding the user did not act on died with the report.
Under the `.agents/` tree, where the host has no flag, the description was always the only line (PLAN.md
item 1), so the limit was Claude Code's alone.

### 30.2 Why this command and no other

Every other command writes code, crosses a tier, closes an issue, pushes, or bumps. **`/roadmap` appends one
`pending` entry** — it never promotes, never removes, and checks for a duplicate and a dropped idea first.
Under the working-tree answer a wrong entry is one line in a diff somebody reads. Running it also makes
§15.3 stronger rather than weaker: the finding meets the worth-adopting test while the context that
produced it is still in hand, instead of depending on a line in a report.

**The description carries the line now, and names two cases and no third**: the user asks in their own
words for something to go on the backlog, or a gate's finding is work `workflow.md` routes there. It
refuses planning talk, as before, and adds *an idea of your own*. The body repeats the two cases under
*When nobody typed it* and asks the agent to say that it ran the command and why.

`AGENT_INVOCABLE` in `layout.ts` is the set, and a test pins it to this one name. A second member is a
decision that needs its own section.

### 30.3 The ask, under the tracker answer

**An issue notifies whoever watches the repository and outlives the session that opened it.** A line in a
working-tree file does neither. So where the user did not type `/roadmap`, `tracker.md` shows the title,
the body with its `Size:` and `Priority:`, and any type or relationship, and asks whether to open it. It is
one question, and it is also where the priority is asked — the existing rule said to ask *if the user's
wording does not imply one*, and a gate's call has no user wording. **No writes nothing.** Adoption asks
the same way, because its label and comment reach the reporter. A run that cannot ask opens nothing and
reports the `/roadmap "…"` line to type.

**This is the first trial, chosen by the user over opening without asking.** The alternative — open the
issue as the working-tree answer appends the line — is one paragraph in `tracker.md` away, and is the one
to try if the asks turn out to be noise. Note that a gate already files *bugs* without asking
(`workflow.md`), so for now the backlog route is the more careful of the two, deliberately.

### 30.4 Where the gates run it, and where they still name it

**`/feature-implement` step 9 and `/orchestrate` step 4 run it**, before landing, so the entry rides the
phase's commit or the change's. `roadmap.md` already changes on a feature branch — the `active` marker —
so a `pending` entry there is not a new kind of change. Under `--all` with the tracker answer, the ask
stops the run until it is answered; that is the ask's cost, paid where it is most visible.

**`review.md` keeps naming it.** A review comment asking for later work is a request, not an instruction
(§28.6), and the person asking is a commenter, not the user. The sentence that said step 4 routes it
*unchanged* now says *with one change*, and why.

**`/orchestrate`'s refusals keep naming it too.** Step 1 refusing a category of work and the rule for work
that turns out to be a feature are about the user's own request, which they asked to have done now.
Turning that into a backlog entry is their call, not a finding's. The rule that said *no roadmap entry is
created* would have contradicted step 4, so it now says one is created only by step 4's `/roadmap`.

### 30.5 It pins no tier

§17.5 recorded that a skill's `model:` holds for the rest of the turn it was invoked in. **Re-read against
the host's skill frontmatter reference on 2026-11-08**, through its published documentation rather than a
run: *the override applies for the rest of the current turn*, and a skill's `effort` *applies to that
turn*. `/roadmap` pinned `sonnet` at low effort. Called at step 9, the rest of the phase — Gate 2's
loopback, the ledger row, the commit, the report, and under `--all` every phase after it in that turn —
would have run at low effort.

So `CLAUDE_SKILL_SETTINGS.roadmap` is `null`, and its Claude copy comes out byte-for-byte the shared body.
A typed `/roadmap` now runs on whatever the session runs on, which costs more on an `opus` session; the
command is short. **Rejected: `medium`, to match the two gates that call it.** That holds only for those
callers, and the user's own ask arrives in whatever turn they happen to be in.

**The other cost**: the description is back in context on every turn under Claude Code. §17.5's *the nine
skills cost nothing per turn* is now nine of ten.

### 30.6 What is unobserved

Whether the description fires on the two cases and stays quiet on *what should we build next* — PLAN.md
item 1 asks it of the `.agents/` tree, and now asks it of Claude Code for this one skill. And whether the
ask earns its interruption, which is the question §30.3 leaves open on purpose.

### 30.7 What it cost

Four hand-typed raises, each with a `§30` `why` in `templates.budget.json`:
`skills/feature-implement/SKILL.md` 24064 → 24576 for the clause that puts the entry on the phase commit,
`skills/roadmap/SKILL.md` 6144 → 6656 for *When nobody typed it*, `skills/roadmap/tracker.md` 11264 →
11776 for the ask, and `our-templates` 427008 → 428544 for the sum. `skills/orchestrate/SKILL.md`,
`skills/orchestrate/review.md` and `context/workflow.md` absorbed theirs inside their limits, and the
always-loaded ceiling did not move.

**Verified on 2026-11-08** by packing the tree and installing the tarball into an empty git repository:
`check` clean (exit 0), `update --dry-run` with 129 files current (exit 0), `/roadmap`'s Claude copy
byte-for-byte its `.agents/` copy, and every other Claude skill still carrying the flag. **The upgrade path
too**: the published 0.28.0, installed and then taken to this tree by `update`, replaced eleven files —
`workflow.md`, and in each tree `/roadmap`'s two, both gates' and `review.md` — left 118 current, took all
three keys off `/roadmap`'s Claude copy, and `check` stayed clean. `check`, `build` and the 514 tests pass
from the root, and `budget:relock` lowered nothing.
