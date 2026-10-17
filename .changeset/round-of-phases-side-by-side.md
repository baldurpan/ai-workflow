---
"@baldurpan/create-ai-workflow": minor
---

`/feature-implement` now runs independent phases of one plan side by side — up to three, each with its own
coder in a scratch checkout it makes and removes itself, landing in phase order as one commit per phase. It
decides this per round with no flag to type, and falls back to one phase at a time wherever an answer
forbids a round, naming the file that decided it. `context/executors.md` gains the cap (`1` turns it off)
and `context/verify.md` gains a **Prepare a fresh tree** section — until `/onboard` fills that in, phases
keep running one at a time.
