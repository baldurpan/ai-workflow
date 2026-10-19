---
"@baldurpan/create-ai-workflow": minor
---

`/orchestrate --pr` no longer ends at the pull request: it applies the label `git.md`'s new *What a pull
request carries* answer names, then runs up to three rounds of reading the open review threads, fixing what
they ask for through the same two gates, pushing, replying, and resolving only the threads whose fix landed.
Nothing merges, approves or waits for a check run, and a review comment cannot widen the scope or lift a
refusal. `/onboard` asks for the label where a pull request is in the push answer; installs that answer
nothing keep today's behaviour with no label applied.
