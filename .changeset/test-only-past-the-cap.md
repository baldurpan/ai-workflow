---
"@baldurpan/create-ai-workflow": minor
---

`/feature-implement` and `/orchestrate` no longer stop at the two-loop cap over a missing or weak test: a blocking item whose fix touches only tests is made in-host once, re-run through Gate 1, and confirmed by the same reviewer. A fix that needs production code still stops at the cap as before.
