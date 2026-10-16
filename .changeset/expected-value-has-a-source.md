---
"@baldurpan/create-ai-workflow": minor
---

The workflow now says where an expected value comes from: a change with behaviour at a seam is worked
test-first in thin slices, each expected value is decided from the requirement or a source independent of
the implementation before the code runs, a plan's §8 names what decides every value the feature computes,
and the reviewer treats an untraceable expected value — or a rule the code implements that no test asserts
— as a finding even on a green suite. `/onboard` also offers a Gate 1 section that fails on a skipped,
focused or expected-to-fail test.
