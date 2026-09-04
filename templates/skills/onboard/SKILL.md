---
name: onboard
description: "Fill in this project's own workflow stubs — context/verify.md, context/executors.md and context/stack.md — by asking, and by running each candidate verification command and keeping only the ones that pass. Explicit invocation only — run this when the user types /onboard. Do NOT match on 'set up the project', 'get started', or general setup requests."
---

# /onboard

Fills the project-owned stubs the installer deliberately left empty. **Re-runnable** — run it again after
the stack changes, and it re-proposes against what is there now.

**Asking is not guessing.** The installer could have detected a test command and written it in; that is
exactly how a file ends up naming a command that has never run. This command asks, and where it can, it
*checks*.

Read [`context/workflow.md`](../../../context/workflow.md) for the tier model.

## What it writes

| File | Gets |
|---|---|
| [`context/verify.md`](../../../context/verify.md) | the real Lint / Typecheck / Build / Test commands — **only ones that exited 0** |
| [`context/executors.md`](../../../context/executors.md) | how Gate 2 dispatches a reviewer |
| [`context/stack.md`](../../../context/stack.md) | runtime, layout, conventions |

Show every proposed edit before writing it, and **do not commit.** The user reviews and commits.

## Step 1 — Reviewer dispatch

Ask how Gate 2 should get a review:

- **The host reviews the diff itself** against the plan's review checklist and the standards. That is the
  default. It is weaker than an independent reviewer, and any command that runs the gate must say which one
  it ran.
- **An external reviewer** — the user names the invocation. Write it into `context/executors.md` verbatim,
  including any scoping it needs on this machine.

Whatever is chosen, the contract in that file stands: a review happens, every blocking finding carries a
`P0`–`P3` severity, and a `FAIL` writes a finding before the loopback.

## Step 2 — Standards source

`context/standards/` ships with a bundled default. Ask whether that is right for this project.

- **Keep it** — nothing to do. It stays tool-owned and updates with the tool.
- **Swap it** — the user gives a git URL, and the swap is
  `npx @baldurpan/create-ai-workflow standards add <git-url>`. Tell them that command rather than cloning
  it yourself: it validates that the tree has a usable conditional-loading table, and whatever lands
  becomes project-owned from that point.

Say plainly what the default is and that a wrong set is not inert — agents load from that README's
conditional table unprompted, on every task.

## Step 3 — Verification commands

**This is the most valuable step in this command.** Do it properly.

1. **Propose candidates.** Read `package.json` scripts, or the stack's equivalent — `Makefile`,
   `composer.json`, `pyproject.toml`, `Cargo.toml`, the CI workflow. The CI config is the best source
   available: it lists commands that demonstrably run in a clean checkout.
2. **Show the candidates and ask** which belong in Lint, Typecheck, Build and Test, and whether anything is
   missing. Ask about prerequisites too — a package manager version, an install step, a service that must
   be up.
3. **Run each one.** Actually run it, from the repo root.
4. **Write only the commands that exited 0.** For each one that failed, show the output and ask: fix it,
   replace it, or leave that section empty. **Never write a command that has not passed.** An empty section
   is skipped by Gate 1 and says so; a wrong command fails a gate on every task until someone notices.
5. Put anything that needs Docker, a cloud account or a deploy target under **Not run by Gate 1**, so
   nobody promotes it into a gate section by mistake.

Explain what you are doing: this turns `verify.md` from someone's guess into something verified at install
time, which is the one moment it is cheap to catch.

## Step 4 — Stack

A few questions, then write `context/stack.md`:

- What does this project do, in a paragraph — and anything about its history that explains its shape.
- Runtime, package manager, database, storage, hosting.
- The directories that matter, one line each.
- **The conventions that would not be guessed** — what breaks in this runtime, what is deliberately kept
  separate, where local secrets live, what must never be run against production. This section is the one
  that earns its keep; the rest is discoverable.

Point out that anything else added under `context/` should be indexed in `stack.md`, not in
`context/README.md`, which is tool-owned and replaced on update.

## Rules

- **Never write a credential.** Write `$SENTRY_DSN`-style placeholders and name where the real value lives
  — this command collects shell commands, which is the most likely place a token appears inline. See the
  standing rule in [`context/workflow.md`](../../../context/workflow.md).
- **Never write a command you have not run.**
- **Never touch a tool-owned file.** `README.md`, `workflow.md`, `plan-template*.md` and `roles/` are
  replaced on the next update; an edit there is an edit lost.
- **Do not commit.**
