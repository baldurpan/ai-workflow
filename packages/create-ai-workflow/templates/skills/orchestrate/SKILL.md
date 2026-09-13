---
name: orchestrate
description: "Run one ad-hoc, commit-sized change through the same verification and review gates the feature loop uses, without a roadmap entry or a phase ledger. Explicit invocation only — run this when the user types /orchestrate. Do NOT match on 'build X', 'implement X', 'orchestrate the work', or any request that belongs to a planned feature."
---

# /orchestrate

A gated one-shot pass over a scope you name. No roadmap entry, no ledger, **no tier boundary crossed.**

It exists because the valuable part of the loop is the **gate machinery** — Gate 1 reading `verify.md`,
Gate 2's reviewer, a capped gate handing back rather than landing — and that is worth having for
unplanned work too, arguably most of all, since that is where fixes get cowboyed. Without it, the only
route to a verified, reviewed change is to file a roadmap entry, and people will route around the workflow
for small things.

Read [`context/workflow.md`](../../../context/workflow.md) for the gate contract and the feature/task rule.

## Usage

```
/orchestrate "<what to do>"
```

## 1. Refuse, before anything else

Two guards, or this becomes the way to skip planning:

1. **Refuse anything that is not commit-sized.** A commit-sized unit has one checkable outcome. A category
   of activity ("add tests", "improve error handling", "refactor the API layer") is not one. Say what the
   scope would need to be split into, and name `/roadmap`.
2. **Refuse anything an existing roadmap entry already covers.** Read `context/roadmap.md` and check. If
   one covers it, say which, and name `/feature-plan` and `/feature-implement`.

Apply the standing test from [`context/workflow.md`](../../../context/workflow.md): *if you would want a
`history.md` row for it, it is a feature.* Ask that question out loud and answer it before proceeding.

A refusal here is the workflow working.

## 2. Do the work

Read `context/stack.md` and load `context/standards/README.md` per its conditional table.

**Check that file's Documentation section, and the tree if it is empty.** If this change makes something
there wrong — a README, a docs page, a changelog, help text in the code — the fix is part of this change,
per the standing rule in [`context/workflow.md`](../../../context/workflow.md). A one-shot change is where
that gets skipped most, because there is no plan holding the row.

**Read [`context/release.md`](../../../context/release.md) and apply it to the paths this change touches.**
That file's granularity answer — *once per feature*, or *per phase* — is plan vocabulary, and this command
has neither an entry, a plan nor a ledger. **Here the change is the unit.** Do not treat the change as a
feature to make *once per feature* readable, and do not decide the answer never fires: either reading ends
with a user-visible fix shipping unannounced, and nothing goes red when it does.

The table still governs. For each path this change touches, write a note where that path's *deserves a note
when* column says one is deserved — so a docs typo gets nothing, because the column says so — and **propose
the level and confirm it** before writing. **Say which paths you checked and what each one owed**, including
when the answer is *none*. A path the table does not cover is named rather than guessed at: write no note
for it and name `/onboard`. Name no release tool; that file says what records a note here.

Delegate to a coder per [`context/executors.md`](../../../context/executors.md) if one is configured;
otherwise implement in-host. The coder's system prompt is
[`context/roles/coder.md`](../../../context/roles/coder.md). The brief **cites paths, it does not paste
files.** Describe what needs to happen, never how to code it.

## 3. Gate 1 — verification

Read [`context/verify.md`](../../../context/verify.md) and run its sections in order: Lint → Typecheck →
Build → Test. **Never carry a copy of these commands here and never invent one.** A missing section is
skipped and said so, never faked. Exit 0 is the verdict regardless of summary text. If `verify.md` does not
exist or has no filled-in section, stop and say so. Docs-only changes run Lint plus a read of the diff.

## 4. Gate 2 — review

Dispatch per [`context/executors.md`](../../../context/executors.md) — an external reviewer, a **reviewer
subagent if your runtime provides one**, or the host reading its own diff. The last is the default and the
weakest, so **say which one you ran.** Where the runtime has no subagent mechanism, review the diff
yourself against the standards and say that is what happened.

Require concrete evidence — file paths, command output — for every verdict, and for every item in it, **one
bit: does it block this change or not.** There is no severity scale — see *What happens to a defect the gate
found* in [`context/workflow.md`](../../../context/workflow.md).

- `PASS` or `PASS WITH NOTES` → done.
- `FAIL` → loop back.

**A non-blocking observation goes in this run's report and dies with the session** — unless it needs code
changes, in which case it is work and belongs in the backlog per
[`context/tracking.md`](../../../context/tracking.md).

## 5. Loopback

Cap: **two loops per gate.** Re-brief with the prior implementation and the validator's feedback
**verbatim**, plus the instruction to address only the failing items, refactor nothing that passes, and
expand no scope.

At the cap: **stop and hand back.** This command has no ledger to write a `blocked` row into, so the record
is the working tree plus the report: leave the change exactly where it is, uncommitted, and say what failed,
what was tried, and what the last feedback was. **If the work is still worth doing, it is an issue** — file
it per [`context/tracking.md`](../../../context/tracking.md) and name it.

**A commit-sized change that cannot pass its gates is handed back, not filed away.** Nothing here writes a
record that outlives the session, because nothing here is half-finished in a way the next session could
resume — the tree either carries the change or it does not.

## 6. Land it — read [`context/git.md`](../../../context/git.md)

**Do not commit unless that file says the agent does.** If it does not exist, the answer is *the user
commits*: say so once, and name `/onboard`.

**Nothing here branches or pushes**, whatever *Where work lands* and *Push and pull request* say. Both of
those answers are about a feature — one branch or tree per entry, one push at `/feature-close` — and an
ad-hoc change has no entry and no feature to close. It lands on whatever branch is already checked out.

- **The user commits** → leave the change in the working tree and hand it over.
- **The agent commits** → one commit, at the granularity that file names.

## 7. Report

What changed, whether it is committed or waiting in the tree, the Gate 1 output, the Gate 2 verdict, any
loopbacks, any non-blocking observations the review raised, any issue filed for work that outlived the
change, and any release note written, with the paths that were checked and owed nothing.

## Rules

- **No ledger row is touched.** This command has no phase and does not belong to a feature.
- **No roadmap entry is created, activated or retired.** If the work turns out to be a feature, stop and
  say so; the user runs `/roadmap`.
- **The release note is not deferred to a later command.** There is no `/feature-close` behind this one to
  write it, which is exactly why the change is the unit.
- **Never skip Gate 1 to save time.** The gates are the entire reason this command exists.
