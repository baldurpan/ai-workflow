# @baldurpan/create-ai-workflow

## 0.14.0

### Minor Changes

- A note check must be exempt on the release commit, where the notes are gone because they became the
  changelog — `context/release.md` now asks for that exemption, `/onboard`'s release sweep reads the check and
  reports one that lacks it, and writing an empty note to satisfy a check is forbidden outright.
  `/feature-close --release` is the new and only shape of the *asked for in that turn* exception: it runs
  whatever the Bump wire names, after listing every pending note it will consume.
