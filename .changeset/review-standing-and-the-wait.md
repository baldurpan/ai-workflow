---
"@baldurpan/create-ai-workflow": minor
---

`/orchestrate --pr` now waits for the review it asks for instead of reading the threads the moment the pull
request opens, re-applies the label after each round's fixes so a reviewer that clears the label still sees
them, and only makes a fix for a comment whose author has standing — the pull request's author, an account
with write access, or an app the repository installed; anyone else gets a reply and a line in the report.
`/feature-close` and `/release` now apply the label *What a pull request carries* names, which `git.md`
already said every pull request this workflow opens would carry.
