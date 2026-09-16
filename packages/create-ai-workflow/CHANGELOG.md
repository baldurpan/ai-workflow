# @baldurpan/create-ai-workflow

## 0.20.1

### Patch Changes

- Point the standards tree at `@northguild/worktree` and `@northguild/gmt`; both were still written under the
  old `@burglekitt` scope in `tooling/ci.md`, `tooling/dates.md` and `docs/SPEC.md`. The standards are
  tool-owned, so `update` carries the corrected names into an existing install unless you have edited those
  files yourself.

## 0.20.0

### Minor Changes

- `/onboard` now asks about a dependency audit along with the other checks the four gate headings miss, and
  `context/verify.md` says where one belongs: a check that can turn red with nothing in the diff is not a
  phase gate however cheap it is, unless the project holds it clean as a standing invariant.

## 0.19.0

### Minor Changes

- A bug is now its own category: Gate 2 files a defect wherever the project already files bugs, and nothing
  enters the backlog except through `/roadmap`, which applies the worth-adopting test first.
  `/orchestrate #<issue>` takes an issue as its brief and closes it from the commit, so a task-sized bug has
  a route through the gates.

## 0.18.1

### Patch Changes

- A non-blocking review finding no longer always becomes a backlog issue. Gate 2 files one only when it is
  user-visible or a regression would land green; everything else goes in `context/notes.md`, a branch-local
  file that nothing reads and `/feature-close` deletes whole.

## 0.18.0

### Minor Changes

- Git now happens on instruction and never on initiative — staging counts, permission is never inferred from
  an approved plan or a chosen option, and force-pushing, pushing to the default branch and rewriting
  published history are asked for by name each time. `executors.md` gains a **Branch and worktree** section
  holding the command that makes one, so a bare `git worktree add` is no longer the fallback; run `/onboard`
  after updating to fill in the two new stub sections.

## 0.17.0

### Minor Changes

- Under the issue-tracker answer, the workflow now records what a feature is waiting on as the tracker's own
  `blocked by` relationship: `/roadmap` sets the order the user's wording names, `/feature-plan` corrects it
  with research and links the chunks of a split, and `/feature-implement` and `/feature-status` read it — a
  blocked entry is no longer offered as the next thing to pick up.

### Patch Changes

- `/feature-status`'s report block and `/feature-implement`'s report list no longer ask for findings and
  severities, which 0.12.0 deleted along with `context/findings.md`.

## 0.16.0

### Minor Changes

- Planning now asks whether a change has an accessibility, performance or security surface instead of waiting
  to notice one, and records what proves it — an end-to-end pass in a real browser for anything with a user
  interface. Gate 1 also runs every section of `verify.md` above *Not run by Gate 1*, so a project whose real
  checks do not fit Lint / Typecheck / Build / Test has somewhere to put them, and `/onboard` now asks for
  them.

## 0.15.0

### Minor Changes

- `/onboard`'s release sweep now asks, of every workflow or job it names as a wire, whether it has ever run
  and what it left behind — because a file that reads correctly is a claim about a mechanism, not the
  mechanism, and a workflow that fails to load is inert in its entirety while looking perfectly sensible.
  `context/release.md` gains the matching rule: a wire names something that has run, or says that it has not.

## 0.14.0

### Minor Changes

- A note check must be exempt on the release commit, where the notes are gone because they became the
  changelog — `context/release.md` now asks for that exemption, `/onboard`'s release sweep reads the check and
  reports one that lacks it, and writing an empty note to satisfy a check is forbidden outright.
  `/feature-close --release` is the new and only shape of the *asked for in that turn* exception: it runs
  whatever the Bump wire names, after listing every pending note it will consume.
