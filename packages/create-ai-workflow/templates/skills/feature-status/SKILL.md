---
name: feature-status
description: "Read-only report of where the active feature stands — its plan's phase ledger and git state, plus every other worktree in flight where the project works that way — ending with exactly one next action. Explicit invocation only — run this when the user types /feature-status. Do NOT match on 'what's the status', 'where are we', or general progress questions."
---

# /feature-status

The read-only "where do things stand" view. **It writes nothing, commits nothing, and invokes no other
agent.**

**It is never a prerequisite.** Every other command resolves its own starting point — nobody has to run
this first. It exists for when *you* want to know.

Read [`context/workflow.md`](../../../context/workflow.md) for the tier model, and
[`context/tracking.md`](../../../context/tracking.md) for where the state it reports lives. **Everything
below is written for the working-tree answer**; *Under the tracker answer* at the end says what changes.

## 1. Read, in this order

1. `context/roadmap.md` — which entry is `active`, and what each entry's **Doc** points at.
2. That plan document's **status ledger**, and each phase's **Files:** line.
3. Any row reading `blocked` — and what its Note says stopped it.
4. Git state — `git status --short` and the last few commits.

**Nothing is cached and nothing is parsed by a script.** Read the ledger every time. That is the property
that makes hand-editing a row change this command's answer immediately, with no regeneration step.

## 2. In worktree mode, sweep the worktrees

Read [`context/git.md`](../../../context/git.md). **If *Where work lands* is not the worktree answer, skip
this step entirely** — there is one working tree and step 1 has already read it.

Under that answer, `roadmap.md` on the default branch cannot see what is in flight: each feature's `active`
marker and its ledger advance inside that feature's own tree, and reach the default branch only when the
branch merges. So enumerate them.

1. `git worktree list` — every working tree, its path and its branch. **That is the state.** Nothing
   records which features are in flight; a worktree existing is the claim, and removing it withdraws the
   claim. Do not write a file to track this, and do not read one if you find it.
2. For each tree other than this one, read `<path>/context/roadmap.md` for its `active` entry and that
   entry's ledger at `<path>/context/plans/<NAME>-PLAN.md`. Two numbers per tree — phases `done` out of
   phases total — and its lowest not-`done` phase.
3. Whether an agent session is live in a tree is not a git fact. If
   [`context/executors.md`](../../../context/executors.md) names a way to ask, run it and say which trees
   are occupied. If it does not, say the report cannot tell rather than guessing from a dirty tree.

**Two things that are not discrepancies here:**

- **A worktree with no `active` entry.** It is a tree nobody has started in, or one whose feature is closed
  and whose branch is waiting to merge. Report it as idle.
- **A plan reading `not started` on the default branch while its own worktree's copy reads phase 3.** That
  is one document at two commits, which is what a branch is. Step 3 reconciles a ledger against the tree it
  lives in, never across two trees — report the worktree's copy, which is the one being worked.

## 3. Reconcile before trusting the ledger

Report and **stop** on any of these:

- A phase marked `done` whose **Files:** or commits do not exist.
- A phase marked `not started` whose work is plainly already in the tree.
- An entry marked `active` pointing at a document that does not exist.
- An entry marked `active` for a feature that already has a `context/history.md` row.
- **A document in `context/plans/` that no roadmap entry points at.**

Do not resolve a discrepancy yourself, and do not pick a next action off a ledger you have just shown to be
stale. That is the exact failure this workflow exists to prevent.

**Two things that are not discrepancies:**

- Every phase `done` while the entry still reads `active` — that is the normal state before
  `/feature-close`. Next action 5 handles it.
- A `done` row with its changes still in the working tree. Under the default policy in
  [`context/git.md`](../../../context/git.md) that is the normal end state of a phase, not a discrepancy —
  the user commits. Name it in the report; do not stop on it, and do not commit it: this command writes
  nothing.

## 4. Report

Keep it short. The user is asking a question, not reading a document.

```
Feature:  <name> — <marker>        (or: none active)
Plan:     <path>
Phases:   <n> done · <n> in progress · <n> blocked · <n> not started

Next: <exactly one action>
```

Under the worktree answer, and only there, one block above **Next** — one line per tree the sweep found,
and nothing for a repository that has none:

```
In flight: <n> worktrees
  <branch>  <feature>  <n>/<n> phases  <idle | agent live | unknown>
```

Under the header, list only the phases that are **not** `done`, one line each with their Note. Do not
re-print the whole ledger.

## 5. Name exactly one next action

In priority order — take the **first** that applies and name only it:

1. A phase reading `blocked` → clear it. Quote the row's Note, which is what stopped it.
2. A phase **`in progress`** → resume it, quoting its Note. Do not restart it.
3. A phase **`blocked`** with every other phase `done` → report the blocker; the next action is the user's.
4. A phase `done` with a next **unblocked** phase → `/feature-implement`, naming the phase it will pick.
5. **Every** phase in the active plan `done` → `/feature-close`.
6. **No active feature, but at least one entry has a plan** → `/feature-implement`, which ranks the planned
   entries and asks.
7. **No plans, at least one `pending` entry** → `/feature-plan`. **Do not pick a candidate yourself** —
   that command ranks the backlog and asks, and naming one here would either duplicate its ranking or
   contradict it.
8. **Nothing at all** → `/roadmap "some idea"`.

**Run from the default branch in worktree mode**, apply that same order across every tree the sweep found
and name the tree the action belongs to — where to be, then what to do there. It is still exactly one. A
fleet of three features with three next actions is precisely the list this command exists to replace: name
the most urgent one, and the other two keep.

**Run from inside a worktree**, the answer is about that tree. Other trees are somebody else's turn, and
the report says so in one line rather than ranking them.

"Exactly one" is the point. A list of three things to consider is what this command exists to replace.

## Under the tracker answer

Read [`context/tracking.md`](../../../context/tracking.md) first. This command still writes nothing and
still ends with exactly one next action.

| Above | Becomes |
|---|---|
| step 1's `roadmap.md` | the open issues carrying the backlog label |
| step 1's status ledger | **unchanged** — it is the same table, in the issue body |
| step 1's git state | unchanged — it is still this tree's |
| step 2's worktree sweep | **one query: the assigned issues** |
| nothing — the tree cannot say what a feature is waiting on | **the backlog's blocked by relationships**, which the same listing already carries |

**Step 2 gets shorter and stronger, and it is the clearest payoff of this answer.** The sweep exists
because `roadmap.md` on the default branch cannot see what is in flight, so it walks every tree and reads
each one's files. That only ever worked for trees **on this machine**. The tracker is outside every tree:
one query for the assigned issues answers what is in flight across every machine, and it answers it for
agents this checkout has never heard of.

Keep `git worktree list` anyway, and report the two side by side. They answer different questions — which
trees exist *here*, and which features are claimed *anywhere* — and the interesting line is where they
disagree:

- **Assigned with no local tree** — normal. Someone else's agent has it.
- **A local tree whose feature is unassigned** — a claim that was dropped, or a tree left behind after a
  close. Report it; do not assign anything.

### What the backlog is waiting on

[`context/tracking.md`](../../../context/tracking.md) says how this tracker records that one feature waits
on another, and the listing that answers *what is the backlog* carries it already. So add one line above
**Next**, and nothing for a repository whose backlog has no relationships in it:

```
Waiting: <n> of <n> pending
  <issue>  <name>  on <issue> <name>
```

**This is the line the question is usually about.** *What should I pick up next* has two halves — what is
ranked highest, and what is not available at all — and under the working-tree answer the second half is
unanswerable, so it is simply missing. Nothing else in this report changes: the next action is still
exactly one, and it is still named by the same order.

**Waiting is not a discrepancy.** An entry with an open blocker is the ordinary state of a backlog that has
been read honestly, and a blocker that is closed has been satisfied — nothing clears a relationship on the
way out.

**Two states here are worth stopping on**, and both are invisible under the other answer:

- **An assigned issue with an open blocker.** Work is under way on ground that has not landed. Say which
  blocker, and leave it; deciding is the user's.
- **A cycle** — two issues waiting on each other, directly or around a loop. Nothing in the backlog is
  runnable and no ranking will say why. Name the loop.

### The reconciliations that only exist here

Add these to step 3, and stop on them the same way:

- **A planned label that disagrees with the body.**
  [`context/tracking.md`](../../../context/tracking.md) names the label that says a feature has a plan, and
  it is a rendering of the ledger rather than a second answer — so **the body wins, always**, and this
  command reports the disagreement rather than resolving it. Two shapes: a body holding a ledger with no
  label, which is an interrupted `/feature-plan` or a plan written by hand; and a label on a body with no
  ledger, which is a label applied by hand. Say which issue and which way round. **This command writes
  nothing, so it does not fix either one** — naming it is the whole of the job, and the fix is a person's.
  **This is the only place the label is looked at at all**, and looking is not reading: no next action, no
  ranking and no report line anywhere else may be derived from it.
- **A stale claim.** An issue assigned whose last comment is old — the phase opened and nothing since. The
  heartbeat is what makes this visible; say how long, and that reclaiming is a person's decision. **Never
  un-assign someone else's agent.**
- **A `done` row carrying no evidence in its Note** — neither a commit sha, nor, under
  [`context/git.md`](../../../context/git.md)'s *the user commits*, a statement that the change is
  uncommitted and where. A body edit cannot ride the commit under this answer, so the Note is the only
  thing tying the row to the repository. A sha that is not in the branch is the same disagreement one
  substrate over; **no evidence at all is one the working-tree answer cannot produce**, because there the
  row travels inside the commit.

**A `done` row whose commit is unpushed is not a discrepancy** — the same way a `done` row with
uncommitted changes is not. It is the normal state between the gates passing and the branch landing.

## Rules

- **Read-only. No exceptions.** Not the ledger, not the roadmap, not a finding, not a "quick fix while I'm
  here". If you spot something that needs changing, name it as the next action and let the user decide.
- **Never create, remove or switch a working tree.** The sweep reads `git worktree list` and the files it
  points at. Naming a tree to go to is this command's job; going there is not.
- **Never invoke another agent**, and under the tracker answer never assign, un-assign, label, close
  anything, or edit an issue body. Reading is the whole of this command.
- **Never mark anything.** Reporting that a phase looks finished is not marking it `done`; only
  `/feature-implement` does that, on gate evidence.
