# @baldurpan/create-ai-workflow

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
