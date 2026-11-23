---
"@baldurpan/create-ai-workflow": minor
---

`context/tracking.md` now says how an issue is referenced and how a change closes one, and `/orchestrate`, `/feature-close`, `/feature-plan` and `/roadmap` read those answers instead of writing GitHub's `#<n>` and `Closes #<n>`. A tracker that closes by command gets the command run after the commit, with no keyword. Existing installs keep GitHub's behaviour until `/onboard` writes the two rows.
