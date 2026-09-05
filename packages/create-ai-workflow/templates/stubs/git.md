# Git

Who commits the work an agent produces, and at what granularity. **Every command that lands code reads this
file before it closes out** — the exact parallel to [`verify.md`](verify.md) for commands and
[`executors.md`](executors.md) for dispatch, and for the same reason: git etiquette differs per repository,
and a skill that assumes one project's ships one project's habits everywhere.

Two answers, and the file is short on purpose. Run `/onboard` to set them, or edit them here.

## Who commits

<!-- Exactly one of the two answers below is this project's. Keep it, delete the other.

     Shipped as: the user commits. A tool installed into a repository it knows nothing about does not get
     to write that repository's history unasked. -->

**The user commits.** A phase ends with the work verified and its ledger row updated, left in the working
tree. The agent reports what changed and stops there — no `git commit`, no `git push`, nothing that
rewrites history.

<!-- **The agent commits.** A phase ends committed: the code and its ledger row in one commit, so the two
     cannot disagree. Nothing is pushed either way. -->

## Granularity

**One commit per phase.** A phase is a commit-sized unit with one checkable outcome — that is what a plan's
ledger is a list of. Where the user commits, this describes the shape the agent leaves the tree in, not
something it carries out.

## What this file does not decide

**Branches, pushes and pull requests.** Nothing in this workflow creates a branch, pushes, or opens a pull
request, and neither answer above makes it start. If work here belongs on a branch, make the branch before
the phase starts.

## The rules that hold either way

- **The ledger row lands with the work.** Whoever makes the commit, the row and the code it describes are
  one change. A row updated separately is a row that disagrees with the repository in between.
- **`done` is a verdict about the gates, not about git.** A phase is `done` when its scope landed and both
  gates passed. Where the user commits, a `done` row whose change is still in the working tree is the
  normal end state — not a discrepancy, and nothing stops on it.
- **If this file is missing, the answer is the first one.** An install from before this file existed has
  no policy written down; treat it as *the user commits*, say so once, and name `/onboard`.
