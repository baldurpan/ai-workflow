# @baldurpan/create-ai-workflow

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
