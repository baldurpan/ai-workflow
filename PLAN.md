# `@baldurpan/create-ai-workflow` — what is left

**The tool is built and tested. This file is the live list.** Everything below is work that has not
happened yet, plus the handful of calls that are cheap to reverse now and annoying later.

Why the tool is shaped the way it is lives in [`DESIGN-RECORD.md`](DESIGN-RECORD.md) — 2296 lines of
tests, rejected alternatives and reasoning, **superseded by the code and read on demand, not on arrival.**
Every `§`-number below points into that document.

## Start here

1. Read this file. It is the whole of what is outstanding.
2. `npm test` — 164 tests. The eighty-four in `templates.test.ts` guard *content* invariants rather than
   code, and they are fastest way to see what the design refuses to let rot: runtime neutrality, one home
   for commands, one home for dispatch, one home for git etiquette, one home for the tracker, no
   self-declared status, inert stubs, a ledger row that opens before the work, a substrate answer that
   never strands the data it names, a `--all` loop that stops where a single run stops, a plan too large
   for its home being split rather than trimmed, documentation reaching the plan, an answer file that may
   not hold a false answer, one status vocabulary with no second place to record a defect, a titled
   §-citation resolving against the template, and every relative link resolving after install — in both
   skill trees. `ci.yml`
   runs them on every push and pull request against `main`, plus an `engines-floor` job that builds on
   Node 20.10.0 and runs the packed CLI there — the suite itself cannot, since it executes `.ts` directly
   and that needs type stripping.
3. `README.md` is the user-facing description of what the tool does.
4. Open `DESIGN-RECORD.md` only when a *why* is actually in question.

**State:** v0.10.1 is npm's `latest`. `main` carries **0.11.0** — the body's ceiling (§10.13), a plan too
large for an issue body being a feature to split rather than a plan to trim, and **item 6 phase A, the
release answer** (§11), a sixth project-owned stub plus an `/onboard` step that asks what a change
announces. `package.json` now says **`0.12.0`, unreleased**, and it carries one thing: **`findings.md` is
deleted** (§12).

**0.12.0 removes a file rather than fixing it, and the route there is the part worth keeping.**
`northguild/worktree` reached 35 open findings against five shipped features — 1097 lines, 76 KB, large
enough that the file came back **truncated** to the very gate that was supposed to read it. The first fix
widened `/feature-close` from *sweep what is closed* to *dispose of everything tied to this feature*, with
three dispositions and a `check` rule for orphans. It worked and it was the wrong fix: **it bounded the
tail and left the accumulation**, since an eight-phase feature could still carry thirty `P2`s through its
whole life, read by every phase, going stale as the code moved.

The question that settled it was *what does this file do that something else does not already do* — and
the answer was **nothing that matters**. A session that dies is already survivable because the ledger row
opens to `in progress` before any code; `done` already means both gates passed, so an open blocker was a
second copy of *the gate failed*. `P0`–`P3` was a **second status vocabulary laid across the ledger's
four**, kept in sync by discipline, and `P3` — *a note worth not losing* — was the category that grew
without bound.

So: a review item is **blocking or it is not**. A blocking one is fixed, or the phase closes `blocked` with
the reason in its Note, or it is an issue. A non-blocking one is an issue if it needs code changes and a
line in the report otherwise. `/feature-close` refuses once instead of twice, `/orchestrate` hands a capped
change back instead of filing it, `check` loses two rules and the `Finding` parser, and `update` tells an
upgrading install the file is no longer read — then leaves it alone, because it is project-owned and
outside the manifest by design. **§12.7 holds the transferable half:** a file whose invariant is maintained
by discipline has no invariant, and the instinct to repair the sweep cost two passes before anyone asked
whether anything should be in the store at all.

**0.10.0 is a fix, not a refinement, and both published versions need it.** The sub-issue design could not
run: a phase closed its sub-issue through `Closes #N`, that trailer fires only when the commit reaches the
default branch, a phase never pushes, and `/feature-close` refuses until every sub-issue is closed. So
inside a feature's branch no phase could ever read `done`, phase 2 was never runnable, and the merge that
would have released it sat behind a command those same sub-issues blocked. It shipped in 0.8.0 and again in
0.9.0 because **nothing here had ever been run by a live agent** — which is exactly what item 5 below said
the remaining risk was.

**`/onboard` Step 5 was silent in its most common case**, found on the first real install of 0.8.0. A
brand-new repository usually has no remote yet, and Step 4 ships saying *neither* a push nor a pull
request — so both of Step 5's checks closed at once, the step had nothing to ask, and **asking nothing was
read as saying nothing.** The user never learned the tracker answer existed. Two fixes: a step that can ask
nothing must still **report**, and the dependency on Step 4 **resolves forward, never backward** — Step 5
offers the tracker answer and offers to change Step 4's along with it, rather than pre-refusing on a
default taken three questions earlier. The general lesson is worth more than the fix: **a conditional step
needs an unconditional output**, or its quiet path is indistinguishable from a bug — and the quiet path is
usually the default one.

**Then the second real install found the larger half of the same defect.** Step 5 wrote the tracker answer
over a repository whose backlog, drafts, plans and `active` feature were all still files, created the two
labels, and stopped. Nothing was lost and nothing was broken — and every command in the workflow then read
the tracker, found nothing, and reported an **empty backlog**. The entries were unreachable, which is worse
than lost because it looks like a clean install. The repository's own `tracking.md` ended up documenting a
*"the rule is by date"* split that no skill knows how to read.

**§10.8 always said what to do about it and 0.8.0 shipped neither half.** The design record's answer was
that `/onboard` refuses to switch while anything is in flight, and that a real migration is its own
command. 0.9.0 ships both:

- **`/onboard` Step 5 looks at the tree before it writes the answer**, and says what it found — always.
  Nothing there, the switch is free. Entries, drafts or plans, it writes the answer and names
  `/tracking-migrate` as the required next step, recording the split in `tracking.md` so it is a task
  rather than a trap. A phase `in progress`, it **refuses**: an agent may be inside that phase in another
  tree, and the substrate must not move underneath one.
- **`/tracking-migrate` is the ninth command.** It moves data and never chooses the substrate. Per
  feature, additively, with the tree files removed **last** — so a run that fails at feature twelve leaves
  twelve migrated and eight not, each in exactly one substrate, and a re-run finishes it by observing what
  is already there rather than by reading a progress file. One direction only, and `history.md` and
  `archive/` are never converted in either.

Ten tests guard it, including the one that would have caught it in the field: **`check` now faults a
backlog left in `roadmap.md` under the tracker answer.** Nothing else could notice — the entries stay
well-formed and the file stays where it was, it is simply no longer read. **The lesson generalises past this command: a configuration write that strands data
is not a configuration write.** Setting an answer and moving the work are two acts, and a command that
does the first while silently declining the second has shipped a broken repository that reports as a
working one.

**0.9.0 also gives `/feature-implement` an `--all` flag.** One invocation was one phase, which is right
while a user reads each report and wrong once they have decided to let the plan run. The flag loops steps
3–13 and nothing else: step 2's approval checkpoint, branch and marker stay once per feature, and the loop
stops at the last `done` phase and **names** `/feature-close` rather than crossing into it — phase to phase
is not a tier boundary, so the rule the tier model exists to protect is untouched. What it does remove is
the pause where a bad phase is caught before the next one builds on it, so that pause is replaced by
something written down: a stop list — `blocked`, part-landed, a capped gate, a ledger that
disagrees with the repo, nothing runnable — and two answers said out loud before the first phase. Which
reviewer `executors.md` gives, because the shipped one is the host reading its own diff; and, under
`git.md`'s shipped *the user commits*, that the flag **runs one phase and declines the continuation**,
because a tree carrying four phases cannot be cut back into the four commits that file says they are.
Eight tests guard it.

**To release: commit and push to `main`** — that tags `v0.12.0` — **then publish the tag as a GitHub
release.** An npm workspaces monorepo — the installer lives in
`packages/create-ai-workflow/`, and `apps/*` is reserved for a landing site or hosted documentation.
Installs a `context/` tree, the nine skills into **both** `.claude/skills/` and `.agents/skills/`, two
Claude subagents, a merged `AGENTS.md` block and a manifest that draws the ownership boundary — 103
tool-owned files, 8 project-owned stubs.

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

Install into a scratch repo and try to trip each of the nine skills, both ways: invoke it explicitly,
then describe the same work in prose and confirm it stays quiet.

**`/prototype` (§3.10) is the sharpest case of this and has never been run at all.** Its subject matter
is the one an agent is most likely to volunteer for unasked — "mock this up", "what should this look
like" — so it is the best test of whether a narrow description plus the flag actually holds, and the
worst skill to have firing on its own. Try to trip it in prose first.

**Neither subagent answer has been run**, and `/onboard` Step 3's instruction to go looking for a reviewer
this installation already put on disk has never been followed by a live agent. It is the cheap half of this
item: one scratch repo, `/onboard`, and a check that Step 3 surfaces `reviewer.agent.md` rather than
defaulting past it.

**The worktree answer has never been run at all**, and it is the largest untested surface in the package.
`/feature-status`'s sweep resolves `<path>/context/plans/<NAME>-PLAN.md` across trees it did not create;
`/feature-implement` step 2 is supposed to **stop** rather than carry on when the working tree's branch is
not the feature's; `/feature-close` pushes and opens a pull request. None of that has met a second worktree.
The prose is right — it is whether an agent follows it that is open, and it is the same class of gap as the
rest of this item. Set a scratch repo to the worktree and pull-request answers, plan two features on `main`,
and run them in parallel trees.

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

`npm pack` produces a working 177.6 kB / 121-file tarball — verified again after §4.5 and §4.6 by installing it
into a clean repo and running `install`, `check` and `update --dry-run` against it, with the standards tree
landing 78 files and `standards/templates/.gitignore` restored from `_dot_gitignore`. Do that again after
any change to `templates/`.

### 4. Try an offloaded executor for real

`/onboard` Step 1 now tests the §1.1 assumption per machine — cite a path, ask for a fact only readable
from that file, record whether it came back — and Step 2 refuses to name a reviewer, asking instead. Both
are **written but unexercised**: no external coder or reviewer has been configured through them end to
end. The path from a `FAIL` verdict through a written finding to the loopback has only ever run in-host.

`agy` in particular remains untested against §1.1. That is no longer a claim the package makes on its
behalf — Step 1 tests it rather than assuming it — but it does mean the branch where an executor needs
content inline has never been taken.

### 5. The tracker answer (§10) — rebuilt in 0.10.0, and still never run by an agent

`context/tracking.md` ships as the fifth project-owned stub, with **in the working tree** as the first
answer, so every existing install behaves exactly as before. The second answer puts the three tiers in
GitHub issues: a feature is an issue, its plan is that issue's body, a closed issue is the archive.

**0.10.0 removed the sub-issues** (§10.10). The deadlock above is the reason it had to; the rest of the
argument is that the only repair — letting an agent close the sub-issue by hand — deletes the property
that made a sub-issue better than a table row in the first place, since *the closing write rides the same
change as the work* was the whole of it. What went with them: N+1 remote writes per plan, the reconciliation
apparatus that guarded the window between the body and its sub-issues, a ledger with two shapes, and
`workflow:blocked`, whose only job was expressing a state open-and-closed cannot. One label remains.

What landed, across 0.8.0 to 0.10.0:

- **The stub** — the answer and its parameters only. The primitive map is the single place any tracker's
  vocabulary appears; the claim protocol and the heartbeat live in the skills, because a project-owned file
  is unreachable by `update` and a mechanism has to stay repairable (§10.8).
- **`/onboard` Step 5**, which states the git-and-GitHub-remote precondition inside the question, collects
  the label and the project's issue types, and offers to remove the five stubs the answer makes dead —
  **only where they are empty**, since a non-empty one is the frozen record of the era before the switch.
- **`/tracking-migrate`** (§10.9), which carries an existing backlog onto the answer Step 5 wrote. 0.8.0
  shipped the answer with no way to move the data and no refusal to stop it, so the second real install
  ended with a full tree and a tracker every command read as empty.
- **Five skills**, each with an *Under the tracker answer* section in `git.md`'s "under the worktree
  answer" shape, so the default answer's prose is untouched. Since 0.10.0 most of those sections say
  *unchanged*: the ledger is the same table under both answers, which was the point.
- **The issue's type** (§10.11), set by `/roadmap` and corrected by `/feature-plan`, read by nothing. And
  **`Priority:`** (§10.12), read by `/feature-plan`'s ranking above every other key, because an issues list
  has no manual order and *backlog order* was the tiebreak the tracker answer had silently lost.
- **The body's ceiling** (§10.13). An issue body holds 65,536 characters and a plan document holds
  anything, and the tempting reading is that this is the tracker answer's weakness. It is the opposite: a
  plan that overflows a body is a feature that is several features, which is already true under the
  working-tree answer and which nothing there ever says. `/feature-plan` measures before its one write,
  leaving room for the rows written into the body later, and **splits the feature along its phase
  boundaries rather than trimming, spilling into comments, or linking out.** `/tracking-migrate` refuses
  instead of guessing at a split; `/feature-implement` shortens its own Note and lands the row regardless,
  because the Status column is the phase's only home.
- **`check` skips what is absent**, which cost one condition: every other rule already degrades to nothing
  when what it parses is missing. `trackingAnswer()` reads which answer survived in the stub — a shape
  read, not a workflow question.
- **Tests**, including the one that matters most: **no skill may name a forge command**, which is what
  keeps a second tracker a rewrite of one file rather than of eight. 0.10.0 adds its sibling — **no skill
  may name an issue type** — as the closest mechanical proxy for §10.11's real rule, that nothing in the
  loop may branch on one. `/onboard` is exempt from both for the same reason: it collects answers, it does
  not read them.

**Nothing here has been run by a live agent, and that is still the whole of the risk.** 0.10.0 is what one
careful read of the prose found; it is not what running it found. Four things have never executed:
**optimistic claiming** (assign, re-read, confirm sole assignee, back off), the **phase-boundary
heartbeat**, **`/tracking-migrate`**, and now the **body read-modify-write** — the one genuinely new hazard
this change introduces, where a person editing a plan and an agent flipping a row can clobber each other.

Fold this into item 1's run rather than testing it separately — the worktree scenario and this one exercise
the same surface, so it is one scratch repo instead of two. Set it to the tracker and pull-request answers,
plan two features, and run them in parallel trees. **The run worth doing most is the boring one**: plan a
feature with four phases and execute all four, which is precisely what no published version could do.

**The `AGENTS.md` block hit its ceiling and the ceiling turned out to be the wrong shape.** It was a flat
`< 40` lines; a ninth command made it 40. Neither of the two options this file named was right — the
ceiling is now a budget on the *prose*, `lines - SKILL_NAMES.length < 32`, which is byte-identical to what
the prose was allowed at eight commands. A flat count made the block's one legitimate growth — a row per
command, which is the entire reason it inlines the table — indistinguishable from the failure it guards.

### 6. The release answer — phase A is built; phase B is the install

`context/release.md` is the **sixth project-owned stub** and the one whose answer can be *false*:
*no lint step* is accurate in a project with no linter, but *"a change is announced by writing a note"* is
a lie in a repository where nothing records one — the same defect as a `done` row whose **Files:** do not
exist. The whole design, and the enumeration that produced it, is **§11**. Read that rather than this.

**Phase A landed, and it is entirely inert.** The shipped answer is *nothing here announces a change*, true
of every repository, so no existing install behaves differently until someone runs `/onboard`:

- **`templates/stubs/release.md`**, registered in `STUBS` with `onboard: true` — four answers: the per-path
  table, what records a note, the granularity, and a *what this project does not do here* section naming
  bump, tag, publish and deploy. `install`'s **Next** line is now derived from `STUBS` rather than retyped,
  which is how it had already gone one stub stale.
- **`/onboard` Step 9**, after Stack. It looks first and reports all four sweeps including the empty ones,
  asks per path, and **refuses**: where nothing on disk records a note it writes the true answer, names
  what is missing, and stops. It installs nothing and it will not generate a release job.
- **`/feature-implement` step 7** under *per phase* — the note's path goes on the **Files:** line, so step
  11 already refuses `done` on a phase whose note has not landed, for free.
- **`/feature-close`** — writes the note under *once per feature*, **reads** the phases' notes under *per
  phase*, and confirms the bump levels either way. `--dropped` writes none and removes none.
- **`/orchestrate`** — the cell granularity leaves empty: the change is the unit.
- `stack.md`, `reviewer.agent.md`, `workflow.md`, `context/README.md`, the `AGENTS.md` block's `/onboard`
  row, and both READMEs.
- **Seventeen tests**, including the sibling of the forge rule: **no template may name a release tool**,
  with no `/onboard` exemption needed — its detection describes the shapes ("a notes directory", "an
  `## Unreleased` heading") rather than the tools that produce them.

**Two findings from the enumeration are worth knowing without opening §11.** The bump level is a judgment,
so it is asked — and putting the ask in `/feature-implement` would have fired it between phases, which is
exactly what `--all` exists to prevent. Moving it to *where the note leaves the machine* keeps `--all`'s
stop list untouched. And three of the grid's six axes turned out **inert**: `tracking.md`'s answer and
`git.md`'s who-commits change nothing here, because a note is an artifact of the change rather than
workflow state. `release.md` is the first stub in this shape with no *Under the tracker answer* section,
and it says so, since every sibling has one.

**What is left — phase B, the install.** The devDependency, the vendor's init, the private-package
versioning line written **from the answer** rather than from the vendor's default (left alone, a deployable
app never bumps and the deploy half silently does nothing forever), and the shorthand scripts. It is the
only thing in this tool that would mutate `package.json`. §11.8 holds the mechanics, all verified against
the changesets docs. **Phase A being inert is what makes it safe to ship before B is exercised** — and it
is a mitigation, not an answer to the dogfood question below.

**The dogfood question is unchanged, and it is item 1's wearing different clothes.** This repository
manages the workflow and does not use it: no `context/`, no skill trees, and `PLAN.md` is hand-maintained
rather than a document under `plans/`. `northguild/gmt` has its own bespoke `context/` and six unrelated
skills, so it is not an install either. **There is nowhere the workflow actually lives**, which is the real
reason item 1 has gone unrun across three releases — the run has to begin by standing up a repository for
the purpose. Two ways out, neither taken here: accept that this ships unrun and lean on the enumeration,
which is what was in place when 0.8.0 and 0.9.0 shipped broken; or give the workflow a home — self-hosting
here, which `PLAN.md` and `DESIGN-RECORD.md` doing a different job than a backlog argues against, or
installing into gmt, where `/onboard`'s adopt path would have to reconcile an existing tree and six skills,
which is the least-tested surface in the package.

---

## Decisions that are cheap to reverse now

Five places the design left the call open and the build had to make one.

| Decision | Why | To reverse |
|---|---|---|
| `update` reconciles adapters to **what the running version ships**, not to what the manifest recorded — so a v0.1 install silently gains `.agents/skills/` | It is the only way an existing install ever reaches a new tree, and the alternative is a flag nobody knows to pass. The eight files are reported as `add`, visible under `--dry-run`, and a directory the tool did not write is still a conflict rather than an adoption | `const adapters = DEFAULT_ADAPTERS` → `manifest.adapters` in `src/commands/update.ts`, plus a way to opt in |
| An edited `context/standards/` file hands over **the whole tree**, not that file | §6.2 says a hash mismatch is a conflict; §4.1 says standards are ours only "while unmodified". The tree is an interface — the README's conditional table and the files it names have to agree, so a half-managed tree is one where an update replaces a file the user's own table no longer points at | the tree-level branch in `src/commands/update.ts` |
| An upgraded install **never gets `context/git.md`**, and never gains a section a newer stub added — `update` reports both and writes neither | Stubs are project-owned; a pass that writes missing ones is a pass that can overwrite a file someone deleted on purpose. Instead the absence is a defined state, and `update` ends by naming each gap under **Next** and pointing at `/onboard` (§6.2) — the boundary holds, and it is no longer silent | a stub-restore pass in `src/commands/update.ts` that writes only stubs whose destination does not exist, reported as `add` |
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
  `---`, outside the sections anything scans, and tests assert the stubs parse to zero entries and zero
  history rows.
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
