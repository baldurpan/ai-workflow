# Tracking

Where this project's workflow state lives — the backlog, the plans, and the phase ledgers. **Every command
that reads or writes workflow state reads this file first** — the exact parallel to [`verify.md`](verify.md)
for commands, [`executors.md`](executors.md) for dispatch and [`git.md`](git.md) for git etiquette, and for
the same reason: a skill that assumes one project's answer ships one project's habits everywhere.

**This file holds an answer, not a procedure.** Which substrate, which labels, which remote — those are
this project's choices. *How* a phase is claimed, when a heartbeat is written, and in what order a plan and
its phases are created are not choices; they live in the skills, so a defect in one can be fixed by an
update. Run `/onboard` to set the answer below, or edit it here.

## Where tracking lives

<!-- Exactly one of the two answers below is this project's. Keep it, delete the other.

     Shipped as: in the working tree. It is what this workflow did before this section existed, and it is
     the only answer that needs nothing outside the repository. -->

**In the working tree.** The backlog is `roadmap.md`, a plan is a document under `plans/` with its own
phase status ledger, retired features are indexed in `history.md` with their documents in `archive/`, and
notes before a plan exists live in `drafts/`. One tree, one reader at a time, and every answer is a file
read.

<!-- **In an issue tracker.** A feature is an issue, a phase is a sub-issue of it, and the tracker is the
     shared home that every working tree can reach. Choose this when several agents work several features
     at once — the tracker is the only thing outside every worktree that all of them can write to.

     **Requires a git repository with a GitHub remote**, and requires `git.md`'s *Push and pull request*
     answer to be *the agent pushes and opens a pull request*. A phase closes its sub-issue through
     `Closes #N` on the commit, which only fires when the branch reaches the default branch. Without the
     push, a phase would never close its own row. -->

### Under the tracker answer

Delete this subsection along with the answer you did not keep.

**Nothing in the workflow names GitHub. This table is where it is named**, so that a different tracker is a
rewrite of this section rather than of the skills. A command asks for the *fact*; this says how to read it.

| To know | Read |
|---|---|
| the backlog | open issues labelled `workflow:feature` |
| whether a feature has a plan | whether the issue has sub-issues |
| whether a feature is being worked | whether the issue has an assignee |
| which phases exist, in what order, depending on what | the issue body's phase list — the ledger minus its Status column |
| where a phase stands | its sub-issue: open and unassigned is `not started`, open and assigned is `in progress`, `workflow:blocked` is `blocked`, closed is `done` |
| what a retired feature's outcome was | the closed issue — *completed* is shipped, *not planned* is dropped |

**The body lists the phases and the sub-issues carry their status.** Two different facts, two homes, and
that split is what makes them checkable against each other: a sub-issue naming no listed phase, or a listed
phase with no sub-issue, is a disagreement something has to stop on rather than guess past.

**Repository:** `OWNER/REPO`
**Labels:** `workflow:feature`, `workflow:blocked`

**`feature` is this workflow's word, not a claim about kind.** [`workflow.md`](workflow.md) defines a
feature as work you would want a history row for — so a bug large enough to plan is a feature, and the
label says nothing about whether it is one. It is namespaced for exactly this reason, and so that it cannot
collide with an `enhancement` or `feature` label this repository already uses.

**This project's own labels are untouched.** An issue keeps everything it already carries; the workflow
adds one bit and reads nothing else.

**Projects and milestones are yours.** Nothing here creates, reads or writes either one. Assign a milestone
by asking for it, group issues on a board if you want one — the workflow will not notice and will not
interfere.

## What this file does not decide

**How a phase is claimed, and how staleness is noticed.** Optimistic claiming and the phase-boundary
heartbeat are mechanisms, not preferences, and they live in the skills so an update can repair them.

**Whether work is pushed.** That is [`git.md`](git.md). This file only records that the tracker answer
depends on the pushing one.

**Which features are in flight across the repository.** Under the tracker answer that is the set of
assigned issues; under the working-tree answer with worktrees it is `git worktree list`. Neither is
written down anywhere, and a file that tracked it would be a cache of something already true elsewhere.

## The rules that hold either way

- **Nothing states its own status.** There is no `Status:` line in a plan document, and none in an issue
  body. Status is read off the structure — a marker, a directory, an assignee, an open or closed state —
  so there is never a second copy to go stale. An issue body holds the problem before planning and the plan
  after, and never a claim about where the work stands.
- **The ledger row lands with the work.** Whoever makes the commit, the row and the code it describes are
  one change. Under the tracker answer that is what `Closes #N` on the commit is for.
- **`done` is a verdict about the gates**, not about git and not about the tracker.
- **A finding is not an issue.** [`findings.md`](findings.md) stays a file under both answers: a finding is
  raised and swept within one branch's life, so it is never the thing two agents contend over. A finding
  that outlives its branch is promoted to an ordinary issue and stops being a finding.
- **If this file is missing, the answer is the first one in every section.** An install from before it
  existed has no policy written down: treat it as *in the working tree*, say so once, and name `/onboard`.
