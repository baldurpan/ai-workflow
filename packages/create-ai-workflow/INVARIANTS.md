# What makes it different

The properties this workflow has that a folder of markdown prompts does not. Each one is a claim about
every repository the installer touches, which is why they are tests rather than promises:
`test/templates.test.ts` in this package asserts them against the shipped templates, so a template that
stops saying one fails the build instead of drifting quietly. Which test covers which claim is paired by
hand and not itself checked — see `DESIGN-RECORD.md` §24.10.

Read [`README.md`](README.md) first for what the thing is and how to run it.

---

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

**What a change announces is a written answer, not an inference.** `context/release.md` holds it, and it ships saying *nothing
here announces a change* — true of every repository, so an existing install behaves exactly as it did.
`/onboard` asks it **per path**, because a repository can publish one artifact, deploy another and say
nothing about a third: each path gets who it announces to, when a change to it deserves a note, and what a
bump of it means. The *deserves a note when* column is where "an internal refactor to the app gets no note"
is written down once instead of being re-argued on every pull request.

**It is the one answer that cannot be false.** `verify.md` can say *no lint step* and be accurate — a
project with no linter chose that. *"A change is announced by writing a note"* is a lie in a repository
where nothing records one, which is the same defect as a `done` row whose files do not exist. So `/onboard`
writes the true answer or the true answer plus a named gap, never a mechanism that is not on disk — and it
**refuses to generate a release job**, because accumulating notes is uniform right up to the step that
needs credentials and branch protections. **Nothing in this workflow bumps a version, tags, publishes,
releases or deploys**, and the stub has a section that says so rather than leaving it implied.

**And the last answer in that file is the event, which is one event and not one per artifact kind.** Notes
accumulate on feature merges; the merge of the pull request that consumed them — versions moved, changelogs
written — is what **publishes a package and deploys an app**, per path, on the condition that *that path's
own version moved in it*. A feature's merge lands a note and ships nothing, so no command reports work as
released, deployed or live because it landed. Two failures the file makes someone write down rather than
discover: a deployed app that is never versioned has nothing for a deploy to key on, and a deploy wired to
every merge of the base branch is not gated at all — it ships whatever notes happen to be pending, other
people's unreleased work included. **And what that merge leaves behind is the same for every path it ships:
a tag and a release.** The record belongs to the event rather than to the kind of artifact — a deployed app
earns both exactly as a published package does, which is the half a repository that only deploys will
otherwise never get, since the command that publishes is also the one that tags.
`/onboard` reports that second one as the defect it is and rewires
nothing.

**No skill names a release tool either.** A repository with no `package.json` answers with a
hand-maintained `## Unreleased` section, or a fragment directory, or nothing — and not one line of the
commands changes. They ask *record a note per `release.md`*; that file says what records one here.

**A defect the gate found has one home, and it is the ledger.** Every item a review returns is blocking or
it is not — there is no severity scale. A blocking one is **fixed** by the loopback, or the phase closes
`blocked` with the reason in its Note, or it is **an issue**, because it turned out to be work that
outlives the phase. A non-blocking one goes in the run's report and dies with the session, unless it needs
code changes — in which case it is work, and work already has a home.

**Nothing accumulates, so nothing has to be swept.** Earlier versions kept a `context/findings.md`, which
was a second status vocabulary (`P0`–`P3`) laid across the one the ledger already had, kept in sync by
discipline. One repository reached 1097 lines of defects nothing could close — their gates belonged to
phases that no longer existed — and the file grew past what a tool reads in one go, so the gate that asks
*is anything blocking this phase* was answering from a file that came back truncated. **A phase has four
states and they are the four in the Status column.** An `update` tells an install carrying the old file
that nothing reads it any more, and leaves it alone: it is yours.

**Where the backlog and the ledgers live is an answer too.** `context/tracking.md` holds it, and it ships
saying *in the working tree* — `roadmap.md` for the backlog, a document under `plans/` per feature, a
`history.md` row when one retires. The second answer puts the same three tiers in **GitHub issues**: a
feature is an issue, its plan is that issue's body with the phase ledger as a table inside it, and a closed
issue *is* the archive, with its plan, its whole discussion and its pull request at an id nothing had to
rewrite.

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
