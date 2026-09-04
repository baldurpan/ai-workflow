# Executors

How this project dispatches a **coder** and a **reviewer**. Hand-written prose, read fresh at dispatch
time — the exact parallel to [`verify.md`](verify.md), and for the same reason: a skill that hardcodes an
invocation bakes one machine's setup into a tool that ships everywhere.

Run `/onboard` to fill this in.

## Coder

<!-- Empty means: implement in-host. That is a valid configuration, not a gap.

     If an external coder CLI is configured, write its exact invocation here, including any directory or
     permission scoping it needs on this machine. The system prompt is context/roles/coder.md. -->

**Not configured — implement in-host.**

## Reviewer

<!-- Empty means: the host reviews the diff itself against the plan's review checklist. Weaker than an
     independent reviewer, but still a gate, and it must say which one it ran. -->

**Not configured — the host reviews the diff against the plan's review checklist, and says so.**

## The contract, whatever is configured

A review happens, it returns a verdict with a `P0`–`P3` severity on every blocking finding, and a `FAIL`
writes a finding to [`findings.md`](findings.md) **before** the loopback.

## Standing rules for any external executor

- **Exit code alone proves nothing.** A CLI can exit 0 after hitting a usage limit mid-run, having
  completed most but not provably all of a brief. Grep the captured output for exhaustion and error
  markers before trusting a summary, and on a hit check `git status` and each acceptance criterion
  individually.
- **Take the model from the CLI's own config**, not from a flag written here. A hardcoded model flag is one
  more place to update when models turn over, and a rejected model can still exit 0 having written nothing.
- **No blanket permission-bypass flag.** Scope permissions in the CLI's own config instead. A standing
  bypass-everything instruction in a committed file is persistent privilege escalation.
- **Assume the executor can read this repository** unless you have tested otherwise. Briefs cite paths;
  they do not paste file contents. If an executor genuinely has no filesystem access, say so here — that is
  the one case where a brief has to carry content inline.
