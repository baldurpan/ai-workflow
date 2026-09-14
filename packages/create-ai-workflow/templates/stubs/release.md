# Release

What a change here announces, and to whom. **Every command that lands code reads this file before it closes
out** — the exact parallel to [`verify.md`](verify.md) for commands, [`executors.md`](executors.md) for
dispatch, [`git.md`](git.md) for git etiquette and [`tracking.md`](tracking.md) for workflow state, and for
the same reason: what deserves a note differs per repository, and a skill that assumes one project's answer
ships one project's habits everywhere.

**This file holds an answer, not a procedure.** Which paths announce, what records a note, and how often —
those are this project's choices. *When* a note is written relative to the gates, and which command writes
it, are not choices; they live in the skills, so a defect in one can be fixed by an update.

**An answer here has to be true.** [`verify.md`](verify.md) can say *no lint step* and be accurate — a
project without a linter chose that. This file cannot: *a change is announced by writing a note* is **false**
in a repository where nothing records one, and a false answer here is the same defect as a `done` row whose
**Files:** do not exist. Run `/onboard` to set it — that command either writes the true answer or makes it
true, and it refuses to write a mechanism that is not on disk.

**A note is not a release, and a merge is not a deploy.** Nothing in this workflow bumps a version, tags,
publishes, releases or deploys. What does — and the **one event** that fires it, for a published package and
a deployed app alike — is the last answer in this file: *What a release ships, and on what event*. That
answer also records what the event **leaves behind**, which is a tag and a release for every path it ships.

## What announces a change, and to whom

<!-- Shipped as: nothing here announces a change. It is the only answer that is true of every repository
     before anyone has looked — including one that publishes, where it says the answer has not been set
     rather than that there is nothing to announce. -->

**Nothing here announces a change.** No path is recorded below, so no change owes a note and every command
reads this section and moves on. **That is a statement about what is written down here, not a claim that
this project publishes nothing** — which is what makes it the one answer that is true of every repository
before anyone has looked at it.

<!-- Replace the line above with one row per path that announces something. The table is **per path**, not
     per repository: a repo can publish one thing, deploy another, and say nothing about a third.

     | Path              | Announces to             | Deserves a note when            | A bump means                       |
     |-------------------|--------------------------|---------------------------------|------------------------------------|
     | `packages/widgets`| people installing it     | the public surface changes      | semver — major breaks their build  |
     | `apps/web`        | people using the app     | behaviour changes in the app    | no contract — it is what the deploy keys on |

     Column two governs **how the text is written** — an installer and an end user do not want the same
     sentence. Column three governs **whether a file is written at all**, and it is the column that does the
     work: it is where "an internal refactor to `apps/web` gets no note" is written down once instead of
     being re-argued on every pull request.

     Column four is prose for a published package and **a wire for a deployed one**: where the last answer in
     this file says a path deploys on its own version moving, the level chosen for a note is what decides
     whether the next release goes to production. Say which it is here, and say the rest there.

     A single-package repository gets one row, and that is a real answer rather than a degenerate one. -->

**A path with no row is not the same as a path whose row says nothing.** A change touching a path this table
does not cover is **named in the report, given no note, and left alone** — this file is missing an answer,
which is `/onboard`'s work and not something to guess at mid-change. Never invent a row, and never refuse
ordinary work over a gap in a configuration file.

**One change can touch two paths with different answers.** The unit is the path, not the change: a change
touching two of the paths above owes whatever each of their rows says, which may be two notes, one, or
none.

## What records a note

<!-- Shipped as: nothing. Keep this until something in the repository actually records notes — an answer
     naming a mechanism that is not on disk is a false answer, and every command below would dutifully
     write into it forever while nothing consumed it. -->

**Nothing records a note here.** There is no notes directory and no changelog section this workflow writes
to.

<!-- Replace the line above with what this project actually uses. Three common shapes:

     **A note file per change.** Each change adds its own file to a notes directory; a release tool collects
     them, writes the changelog and moves the versions. Give the directory and the file format.

     **A hand-maintained section.** Each change adds a bullet under an `## Unreleased` heading in the
     changelog, and cutting a release renames that heading. Give the file and the heading.

     **A per-change fragment directory.** Each change adds a fragment named for the issue and the kind of
     change, and a builder assembles them. Give the directory and the naming convention.

     Whatever it is, write down:

     - the exact path a note is written to, and the format of one file — enough that a note can be written
       by hand, because that is what an agent will do;
     - the **script name** for any check it offers, never the raw command, so that its flags have one home —
       the same indirection [`verify.md`](verify.md) already uses;
     - whether **filenames must not collide**. Tools that collect note files use random names on purpose:
       two differently-named files never conflict when two branches merge.

     And three settings of the mechanism whose consequences belong to the last answer in this file. Record
     what they are set to here; the reason they matter is written down once, there:

     - **Whether private packages get versioned.** Commonly off by default, and a deployed app is usually a
       private package. Left off, it accumulates notes and never bumps — so anything keyed on its version
       does nothing forever.
     - **Whether private packages get tagged.** A separate switch from the one above and commonly off by
       default too, so a deployed app can be versioned correctly and still leave no tag. These two are one
       decision rather than two — the reason to version a private package here is that it is deployed, and a
       deploy with no tag leaves no record of what went live — so if they disagree, say which was chosen
       and why.
     - **Whether a dependent can be dragged into a release.** Where one package's major puts a sibling's
       range out of range, the sibling is pulled in with a patch, and its version moved too. -->

## At what granularity

<!-- Exactly one of the two answers below is this project's. Keep it, delete the other.

     Shipped as: once per feature. The note's audience reads releases, not phases, and a feature's phase
     sequence is an implementation detail that means nothing to them — so one feature is one entry. -->

**Once per feature.** The note is written by `/feature-close`, before the commit that retires the feature,
so it rides whatever that command hands over. No phase writes one.

<!-- **Per phase.** The note is part of the phase's scope, written by `/feature-implement` alongside the
     code, and its path goes on that phase's **Files:** line like anything else it touches. Choose this
     where a phase is what goes out on its own — a repository that cuts a release about as often as it
     merges, so one phase is one entry somebody reads. Note that it is a claim about the *entries*, not
     about reaching users: under the last answer in this file a landed phase has shipped nothing either. -->

**This is one answer for the project, not a column in the table above.** The table asks *does this path
deserve a note*; this section asks *what leaves this repository as a unit*, and that is a property of the
repository rather than of the path a change happened to touch.

**Granularity governs the plan flow, and `/orchestrate` has neither value.** That command has no entry, no
plan and no ledger, so *per phase* and *once per feature* are both unreadable there: **the change is the
unit.** It still consults the table above, so a docs typo gets no note because column three says so.

**The bump level is confirmed where the note leaves this machine, not where it is written.** A note is a
tracked file that publishes nothing until a version moves, so the level is cheap to correct right up to the
release. `/feature-close` shows the notes a feature carries and confirms their levels — writing them under
*once per feature*, reading what the phases wrote under *per phase* — and [`git.md`](git.md)'s
*Push and pull request* answer decides whether that is the last moment before a push or before a handover.

## What a release ships, and on what event

<!-- Shipped as: nothing here ships on a merge. Like the first answer in this file it is true of every
     repository before anyone has looked — including one that deploys, where it records that the event has
     not been written down rather than that nothing reaches users. -->

**Nothing in this workflow bumps a version, creates a tag, publishes an artifact, or deploys anything, and
nothing here ships on a merge.** Recording a note and cutting a release are two acts; only the first is in
scope, and what performs the second is not written down here yet.

<!-- Replace the paragraph above once something does. There is **one event, not one per artifact kind**: the
     merge of the release pull request — the one where the script that consumes the notes was run, so the
     notes are gone, the versions have moved and the changelogs are written. Publishing a package and
     deploying an app are two consequences of that single merge. **A feature's merge ships nothing**; it
     lands a note and waits for that one.

     Write down what the event is wired to, one line each:

     - **Bump** — the script that consumes the notes, and who runs it. It cannot be run twice, and where a
       deploy watches versions it is the button that ships.
     - **Tag** — what creates the tag, and from what. **Do not assume the publish step owns this.** In the
       common shape one command both publishes and tags, so a repository that publishes gets tags without
       ever deciding to — and a repository that only deploys runs no such command and silently gets none.
       If nothing here publishes, this line is the one most likely to be empty and least likely to be
       noticed.
     - **Release** — what turns a tag into the page someone reads, and where its text comes from. That text
       is the changelog entry the note was written for, so a release is where a note finally reaches its
       audience; without one the notes are consumed into a file nobody opens.
     - **Publish** — what pushes the artifact to a registry, and with what credentials.
     - **Deploy** — what puts the app in front of users, and what it keys on.

     Then one row per path, saying what that merge does to it and what it leaves behind:

     | Path               | On the release merge                     | Leaves behind          |
     |--------------------|------------------------------------------|------------------------|
     | `packages/widgets` | published to the registry by `<job>`     | tag + release          |
     | `apps/web`         | deployed to production by `<job>`        | tag + release          |
     | `docs/`            | nothing                                  | nothing                |

     **Every path that merge ships leaves a tag and a release behind, whichever of the two it got.** The
     record belongs to the event, not to the kind of artifact: the tag says which commit went live and the
     release is where the note is read. A deployed app earns both exactly as a published package does — and
     the column exists because that is the half a repository which only deploys will otherwise skip, having
     nothing that would have produced them by accident.

     **The gate is per path, and what it reads is that path's own version.** A release that bumped only the
     package must not deploy the app, so the honest condition is *this path's version moved in this merge* —
     never *a release happened*. Three things to write down while you are here:

     - **A path that deploys has to be versioned.** Note tools commonly leave private packages unversioned
       by default, and a deployed app is usually a private package. One whose version never moves has
       nothing for a deploy to key on: it either never fires, or it gets wired to every merge instead, which
       is the next bullet.
     - **A deploy wired to every merge of the base branch is not gated at all.** It ships whatever pending
       notes happen to be in the tree — other people's unreleased work included — and announces itself with
       a changelog that is a release behind. If that is what this repository does today, **write that down**:
       an answer describing the gate someone meant to have is the one kind of answer this file must never
       carry.
     - **A major bump can drag a sibling into the release.** Where one package's major puts a dependent's
       range out of range, that dependent is pulled in with a patch — and if the dependent is the deployed
       app, its version moved, so the merge deploys production. Say whether that can happen here.
     - **A deploy that leaves no tag and no release is the failure that looks like success.** Everything
       works — the notes are consumed, the version moves, the gate fires, production updates — and the
       repository keeps no evidence of it: nothing says which commit is live, and the changelog entry sits
       in a file with no reader. It surfaces the first time someone opens the tags or releases page and
       finds it empty, long after the deploy they wanted to identify. **Where the mechanism has a setting
       for this, it is usually off by default for exactly the paths that deploy** — see the second answer
       in this file — so a repository that only deploys reaches this state by changing nothing.

     If any of these is "nothing yet", say so. A repository that accumulates notes with nothing to consume
     them reads as configured and is not — the notes pile up and no version ever moves. -->

## The rules that hold either way

- **A note is part of the change, and shares its fate.** It lands with the code it describes, under
  whichever answer [`git.md`](git.md) gives about who commits. A change that is abandoned takes its note
  with it.
- **Re-entering the work does not write a second note.** A resumed phase and a review loopback both come
  back through the same step. Update the note that is already there — two files describing one change do
  not conflict and are both counted, which is the one case where doing the right thing twice is the
  failure.
- **Landing a change is not shipping it.** A merged feature carries a note and nothing else; the change
  reaches users on the event above, which is somebody's deliberate act. Never report work as released,
  deployed or live because it landed — say what it is waiting for.
- **A dropped feature announces nothing, and its landed phases keep their notes.** A note belongs to the
  change that landed, not to the outcome the feature was later given.
- **Saying nothing is not the same as answering *no*.** Where a change owes no note, name the paths that
  were checked and why none of them deserved one — the rule a plan's §7 Documentation already follows.
  An empty report reads as "nobody looked".
- **A missing entry is skipped, never faked** — the same rule [`verify.md`](verify.md) states about an empty
  section, applied to a path with no row.
- **This file is unaffected by [`tracking.md`](tracking.md).** A note is an artifact of the change, so it is
  a file in this repository under both of that file's answers. There is no *Under the tracker answer*
  section here, and its absence is deliberate.
- **If this file is missing, the answer is the first one in every section.** An install from before it
  existed has no policy written down: treat it as *nothing here announces a change*, say so once, and name
  `/onboard`.
