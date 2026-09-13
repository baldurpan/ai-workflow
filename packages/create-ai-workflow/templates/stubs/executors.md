# Executors

How this project dispatches a **coder** and a **reviewer**. Hand-written prose, read fresh at dispatch
time — the exact parallel to [`verify.md`](verify.md), and for the same reason: a skill that hardcodes an
invocation bakes one machine's setup into a tool that ships everywhere.

Each has three answers: **in-host** directly, **in-host but isolated** in a subagent, or **offloaded** to
an external CLI. The middle one is described in terms of what it does, never by naming a runtime's
primitive — a host that has no subagent mechanism reads it and falls back to the first.

Run `/onboard` to fill this in.

## Coder

<!-- Exactly one of the three answers below is this project's. Keep it, delete the others.

     Shipped as: in-host. That is a valid configuration, not a gap.

     The subagent answer needs no invocation written down — the brief is context/roles/coder.md, which is
     already in this repository. Keep it only if this host actually has such a mechanism.

     For an external coder CLI, write its exact invocation, including any directory or permission scoping
     it needs on this machine. Its system prompt is context/roles/coder.md too — one prompt, whichever way
     it is dispatched.

     Record alongside an external one whether it was actually observed reading this repository unaided, and
     when. /onboard tests it; the standing rule below says why the answer changes how briefs are written. -->

**Not configured — implement in-host.**

<!-- **A subagent, briefed with [`roles/coder.md`](roles/coder.md).** The phase's implementation runs in its
     own context and returns that file's output contract; the ledger and the gates stay with
     the caller. Same code, smaller caller — worth most on long plans, where the alternative is a context
     window carrying every file read of every phase.

     **Offloaded to `<the exact invocation>`.** Repository reads verified: `<yes / needs content inline>`,
     `<when>`. -->

## Reviewer

<!-- Exactly one of the three answers below is this project's. Keep it, delete the others.

     Shipped as: the host reviews its own diff. It is the weakest of the three and the only one that
     always works, which is why it is the default rather than the recommendation.

     A host that offers review often offers more than one shape of it — a review subcommand, a review skill
     it can be asked to run, a subagent it installs — and they do not review alike. Whichever was chosen,
     write it down. Nothing shipped with this tool names an invocation, because the winner differs per
     host. -->

**Not configured — the host reviews the diff against the plan's review checklist, and says so.**

<!-- **A reviewer subagent.** An independent reader that never saw the implementation being written — the
     cheapest real independence available, and it needs no invocation written down. `/onboard` finds what
     this host installs or offers; if this tool wrote one into a host-specific directory, that is what this
     answer means.

     **Offloaded to `<the exact invocation>`.** -->

## The contract, whatever is configured

A review happens, it returns a verdict, and every item in it is marked blocking or not. A `FAIL` is looped
back on, and a gate at its cap leaves the phase `blocked` with the reason in its ledger row.

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
