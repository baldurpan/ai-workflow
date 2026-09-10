# Tracking

Where this project's workflow state lives — the backlog, the plans, and the phase ledgers. **Every command
that reads or writes workflow state reads this file first** — the exact parallel to [`verify.md`](verify.md)
for commands, [`executors.md`](executors.md) for dispatch and [`git.md`](git.md) for git etiquette, and for
the same reason: a skill that assumes one project's answer ships one project's habits everywhere.

**This file holds an answer, not a procedure.** Which substrate, which labels, which remote — those are
this project's choices. *How* a phase is claimed, when a heartbeat is written, and in what order a plan and
its phases are created are not choices; they live in the skills, so a defect in one can be fixed by an
update. Run `/onboard` to set the answer below, or edit it here.

**Setting the answer is not moving the work.** `/onboard` writes the answer; `/tracking-migrate` carries
whatever already exists in the tree onto it. Where the two disagree — this file naming a tracker while
`roadmap.md` still holds entries — every command reads an **empty backlog**, so the migration is a task
rather than an option. If that split exists here, it is named in this file.

## Where tracking lives

<!-- Exactly one of the two answers below is this project's. Keep it, delete the other.

     Shipped as: in the working tree. It is what this workflow did before this section existed, and it is
     the only answer that needs nothing outside the repository. -->

**In the working tree.** The backlog is `roadmap.md`, a plan is a document under `plans/` with its own
phase status ledger, retired features are indexed in `history.md` with their documents in `archive/`, and
notes before a plan exists live in `drafts/`. One tree, one reader at a time, and every answer is a file
read.

<!-- **In an issue tracker.** A feature is an issue, its plan is that issue's body, and the phase ledger is
     a table inside that body. The tracker is the shared home every working tree can reach — choose it when
     several agents work several features at once, since it is the only thing outside every worktree that
     all of them can write to.

     **Requires a git repository with a GitHub remote.** It requires no particular answer in `git.md`, and
     is worth pairing with *the agent pushes and opens a pull request* for a reason that is not mechanical:
     this answer exists for several agents in several trees, and work that is never pushed is visible to
     exactly one of them. -->

### Under the tracker answer

Delete this subsection along with the answer you did not keep.

**Nothing in the workflow names GitHub. This table is where it is named**, so that a different tracker is a
rewrite of this section rather than of the skills. A command asks for the *fact*; this says how to read it.

| To know | Read |
|---|---|
| the backlog | open issues labelled `workflow:feature` |
| whether a feature has a plan | whether the issue body holds a phase ledger |
| whether a feature is being worked | whether the issue has an assignee |
| which phases exist, in what order, depending on what | the issue body's phase ledger |
| where a phase stands | that ledger row's Status column |
| what a retired feature's outcome was | the closed issue — *completed* is shipped, *not planned* is dropped |
| what kind of work it is | the issue's type — set by the workflow, read by nothing in it |
| what gets planned next | the issue body's `Priority:` line |
| how much a plan may hold | the issue body's size limit — **65,536 characters** |

**The ledger is one table, and it is the same one a plan document carries** — `#`, `Phase`, `Depends on`,
`Status`, `Note`, with a `Files:` line in each phase's own section. Nothing about its shape changes between
the two answers, which is why the commands below say *unchanged* far more often than they say *becomes*.

**A closing row names the commit that carried the phase.** Under the working-tree answer the row travels
inside the commit, so it cannot disagree with the code. A body edit cannot ride a commit, so evidence
replaces that atomicity: a `done` row whose sha is in the branch is checkable, and a `done` row with no sha
is a disagreement to stop on.

**Repository:** `OWNER/REPO`
**Label:** `workflow:feature`

**`feature` is this workflow's word, not a claim about kind.** [`workflow.md`](workflow.md) defines a
feature as work you would want a history row for — so a bug large enough to plan is a feature, and the
label says nothing about whether it is one. It is namespaced for exactly this reason, and so that it cannot
collide with an `enhancement` or `feature` label this repository already uses.

**This project's own labels are untouched.** An issue keeps everything it already carries; the workflow
adds one bit and reads nothing else.

### The issue's type

**The workflow sets it and never reads it.** `/roadmap` guesses from the one or two lines it has when it
opens the issue; `/feature-plan` corrects it once the research exists. Nothing else touches it, and **no
refusal, no ranking and no report may branch on it.** The moment one does, this stops being metadata for
your tracker and becomes a second vocabulary laid across the one in [`workflow.md`](workflow.md).

**Types:** `Bug`, `Feature`, `Task` — this project's set. Delete this line if it has none.

**`Task` here is not [`workflow.md`](workflow.md)'s task.** That file uses *task* for work too small for
the loop, handled by `/orchestrate`. An issue typed `Task` is still a workflow **feature**: it is in the
loop and it will get a history row. The two words are unrelated, and inside the tracker the tracker's wins.

**Best-effort in both directions.** A project with no types configured gets nothing. Setting a type needs
push access and GitHub drops it silently without one, so it is never assumed to have landed. Neither case
is worth a refusal — it is metadata, not a gate — and both are worth saying once.

**An existing type is never overwritten.** An adopted issue keeps whatever its reporter set.

### Priority

**`Priority:` is a line in the issue body**, one of `Urgent`, `High`, `Medium`, `Low`. An issue without one
ranks as `Medium`.

It replaces something the working-tree answer gets structurally: **an issues list has no manual order.** In
`roadmap.md` importance is expressed by moving a line, and `/feature-plan`'s ranking ends with *backlog
order*. Here the issue number is creation order and nothing else is available, so the fact needs somewhere
to live.

**`/feature-plan` reads it, above every other ranking key.** Overriding the default order is the whole
point of marking something urgent; a field that only broke ties between equally-prepared entries would not
do the job it was added for.

**It is not [`findings.md`](findings.md)'s `P0`–`P3`.** A `P`-severity asks whether something blocks the
phase, inside one branch's life. A priority asks what gets planned next, across the backlog. A finding
promoted to an issue loses its severity and arrives carrying a priority instead.

**Size and priority are different questions.** Size is effort and feeds a later ranking key; priority is
importance and leads. Both are body lines and neither substitutes for the other.

**Projects and milestones are yours.** Nothing here creates, reads or writes either one. Assign a milestone
by asking for it, group issues on a board if you want one — the workflow will not notice and will not
interfere.

### The body has a ceiling, and it measures scope

**An issue body holds 65,536 characters.** That is the one hard limit in this substrate, and this is the
only place the number belongs — a command asks whether the plan fits, and this section says what fitting
means.

**A plan that does not fit is not a formatting problem. It is a feature that is several features.** A
filled plan is a few thousand characters; reaching sixty-five thousand means the design, the phases and the
risks of more than one piece of work were written into one document. The working-tree answer has no such
ceiling and that is not an advantage — a plan document that would overflow a body is over the same line,
and nothing there says so. The limit is a check this substrate gives for free.

**The plan needs room left over, because the body is written into for the feature's whole life.** Every
phase row moves through `in progress` to `done` and gains a commit sha and a note as it closes, and those
edits land in the same body. A plan that only just fits has already failed — by the last phase it would
not.

**Three workarounds are refused:** trimming the plan until it fits, moving sections into comments, and
linking out to a gist or a file. The first throws away the research the plan exists to hold; the other
two give one plan two homes, which is what putting the ledger in the body settled. **The answer is to split
the feature into separate issues**, each with its own plan and its own ledger — `/feature-plan` proposes
the split along phase boundaries and asks, and `/tracking-migrate` refuses rather than guessing at one.

## What this file does not decide

**How a phase is claimed, and how staleness is noticed.** Optimistic claiming and the phase-boundary
heartbeat are mechanisms, not preferences, and they live in the skills so an update can repair them.

**Whether work is pushed.** That is [`git.md`](git.md). This file only records that the tracker answer
depends on the pushing one.

**Which features are in flight across the repository.** Under the tracker answer that is the set of
assigned issues; under the working-tree answer with worktrees it is `git worktree list`. Neither is
written down anywhere, and a file that tracked it would be a cache of something already true elsewhere.

## The rules that hold either way

- **A feature never states its own status.** There is no `**Status:**` line in a plan document and none in
  an issue body. *Whether a feature is being worked* is read off the structure — a marker under one answer,
  an assignee under the other — so there is never a second copy to go stale. An issue body holds the
  problem before planning and the plan after, and never a claim about where the work stands.
- **A phase does state its status, in its ledger row, under both answers.** That is not the rule above
  bending: the ledger is the single home for phase status, and the four values are written rather than
  observed because no structure expresses `blocked`.
- **The ledger row lands with the work, or names it.** Under the working-tree answer the row and the code
  it describes are one commit. A body edit cannot be, so under the tracker answer the closing row carries
  the commit's sha and is checkable against the branch instead.
- **`done` is a verdict about the gates**, not about git and not about the tracker.
- **A finding is not an issue.** [`findings.md`](findings.md) stays a file under both answers: a finding is
  raised and swept within one branch's life, so it is never the thing two agents contend over. A finding
  that outlives its branch is promoted to an ordinary issue and stops being a finding.
- **Neither `history.md` nor `archive/` is ever converted, in either direction.** Fabricating closed
  issues for features shipped months ago produces wrong dates, empty threads and an audit trail that looks
  real and is not. Under the tracker answer they stay as the frozen record of the era before the switch —
  new closures become closed issues, the old ones stay where they happened. Two eras, not two homes.
- **If this file is missing, the answer is the first one in every section.** An install from before it
  existed has no policy written down: treat it as *in the working tree*, say so once, and name `/onboard`.
