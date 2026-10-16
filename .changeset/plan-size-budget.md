---
"@baldurpan/create-ai-workflow": minor
---

Plans now have a size budget, in `context/tracking.md`, and it applies whether the backlog lives in the
working tree or in an issue tracker — `/feature-plan` measures before it writes and proposes a split along
phase boundaries instead of trimming, and `check` reports an oversized plan as a note that fails nothing.
A ledger Note is now one line, with measurements and gate output going to the commit message or the run
report, and every phase carries a `Decisions:` line so the coder and the reviewer are briefed with the
phase's own section rather than the whole plan.
