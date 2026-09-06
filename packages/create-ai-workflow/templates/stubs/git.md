# Git

Where an agent's work lands, who commits it, and whether it leaves the machine. **Every command that lands
code reads this file before it closes out** — the exact parallel to [`verify.md`](verify.md) for commands
and [`executors.md`](executors.md) for dispatch, and for the same reason: git etiquette differs per
repository, and a skill that assumes one project's ships one project's habits everywhere.

Four answers, and each one is independent of the rest. A worktree per feature does not imply a pull
request, and a pull request does not imply a worktree — pick each on its own terms. Run `/onboard` to set
them, or edit them here.

## Who commits

<!-- Exactly one of the two answers below is this project's. Keep it, delete the other.

     Shipped as: the user commits. A tool installed into a repository it knows nothing about does not get
     to write that repository's history unasked. -->

**The user commits.** A phase ends with the work verified and its ledger row updated, left in the working
tree. The agent reports what changed and stops there — no `git commit`, no `git push`, nothing that
rewrites history.

<!-- **The agent commits.** A phase ends committed: the code and its ledger row in one commit, so the two
     cannot disagree. -->

## Where work lands

<!-- Exactly one of the three answers below is this project's. Keep it, delete the other two.

     Shipped as: the main working tree. It is what this workflow did before this section existed, and a
     tool installed into someone else's repository does not start creating branches unasked. -->

**The main working tree.** The agent works on whatever branch is already checked out and creates none.
Enough for a repository you push to `main`, and for one where you make the branch yourself before starting.

<!-- **A branch per feature.** One branch, created from the default branch before the feature's first phase
     and reused by every phase after it. It lives in the main working tree, so one feature is in flight at
     a time.

     **A worktree per feature.** Each feature gets its own branch in its own working tree, so several are
     in flight at once. The tree is created before the first phase and removed after its branch merges.
     *How* one is created is not this file's business — that is `executors.md`, for the same reason the
     reviewer's invocation is. -->

### Under the worktree answer

Delete this subsection along with the answers you did not keep.

**The worktree is the claim.** `active` in [`roadmap.md`](roadmap.md) is set inside the worktree and never
reaches the default branch: `/feature-close` removes the entry before the branch merges, so the marker
lives and dies in the tree that set it. The one-active-feature rule in [`workflow.md`](workflow.md) then
holds per working tree, and git enforces it — the same branch cannot be checked out twice.

**Nothing records which features are in flight.** `git worktree list` is the answer, read fresh, exactly
the way the ledger is. A file tracking it would be a cache of something git already knows, and it would be
wrong in the one case you reach for it: a crashed run, or a tree removed by hand.

**`history.md` conflicts on every merge**, because every `/feature-close` appends to its end. One line in
the repository's `.gitattributes` settles it permanently:

```
context/history.md merge=union
```

**Do not do the same for `findings.md`.** Closed findings *leave* that file, and a union merge resurrects
the lines one side deleted.

## Push and pull request

<!-- Exactly one of the two answers below is this project's. Keep it, delete the other.

     Shipped as: neither. Pushing is the first thing an agent does that other people can see. -->

**Neither.** Nothing here pushes a branch or opens a pull request. Work reaches the remote when you send
it.

<!-- **The agent pushes and opens a pull request.** Once, at `/feature-close` — never per phase. By then
     the branch carries the whole feature: every phase's code, the documentation each one made true again,
     the finished ledger, the `archive/` move and the `history.md` row. The pull request's body is the
     plan's summary and the phases it landed. -->

## Granularity

**One commit per phase.** A phase is a commit-sized unit with one checkable outcome — that is what a plan's
ledger is a list of. Where the user commits, this describes the shape the agent leaves the tree in, not
something it carries out.

## What this file does not decide

**How a branch or a worktree is created.** That is a per-machine fact that changes underneath you, so it
belongs in [`executors.md`](executors.md) beside the coder and reviewer invocations. This file says *where
work lands*; that one says what to run to put it there.

**Merging.** Nothing in this workflow merges a pull request, deletes a remote branch, or removes a
worktree — under any answer above. Review and merge are yours.

## The rules that hold either way

- **The ledger row lands with the work.** Whoever makes the commit, the row and the code it describes are
  one change. A row updated separately is a row that disagrees with the repository in between.
- **`done` is a verdict about the gates, not about git.** A phase is `done` when its scope landed and both
  gates passed. Where the user commits, a `done` row whose change is still in the working tree is the
  normal end state — not a discrepancy, and nothing stops on it.
- **A push is not a gate.** Both gates pass before anything leaves the machine, under every answer above.
  Opening a pull request is not a way to find out whether the work is good.
- **If this file is missing, the answer is the first one in every section.** An install from before this
  file existed has no policy written down: treat it as *the user commits*, in *the main working tree*, with
  *neither* a push nor a pull request — say so once, and name `/onboard`.
