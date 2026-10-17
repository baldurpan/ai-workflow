# /feature-implement — a round of phases, side by side

Read this where step 3 formed a round of **more than one phase**. Every step in [`SKILL.md`](SKILL.md)
holds; this says what a round adds. A round of one phase is an ordinary run and reads none of this.

**There is no flag.** How wide a round is is this command's own decision, made fresh each round from the
ledger, the phases' **Files:** lines and the cap in
[`context/executors.md`](../../../context/executors.md). `--all` is unchanged: it decides whether there is
a *next* round, never how wide one is.

## What forms a round

Start from the phase step 3 picked — the lowest-numbered phase that is not `done` and whose `Depends on`
are all `done`. Then walk the remaining runnable phases in number order and add each one that **shares no
path with any phase already in the round**, up to the cap.

- **Runnable** is step 3's test and nothing weaker: not `done`, every `Depends on` `done`.
- **Shares no path** is read off the phases' **Files:** lines, compared whole. **Prose counts** — a `.md`
  file, a README, anything under `context/`. Two phases that each add a section to one file both append, in
  two trees, from one base: that is a conflict every time, and in the files that answer what this project's
  commands are.
- **The cap** is the one in *Coder* in [`context/executors.md`](../../../context/executors.md) — **3 where
  that file says nothing, and 1 turns this off.** It counts coders, which is all there is to count: the
  gates below are serial.

**Say the round before any coder starts.** Which phases are in it, and for every runnable phase left out,
which test left it out — an overlap, **naming the path**, or the cap.

**A `Files:` line is a prediction.** Phases in the field grow one while they run, which is why the same
test runs again, against the real diffs, before anything lands.

## What makes it fall back to one phase at a time

**Nothing here refuses.** Each line below means this run does what it has always done — one phase, in the
feature's own working tree, through steps 6 to 13 — and **says so once, before the first phase**, naming
the file and the answer that decided it.

| The line | Why a round cannot run under it |
|---|---|
| [`git.md`](../../../context/git.md) *Who commits* — **the user commits** | every mechanism below is a commit, and a tree carrying three phases cannot be cut back into three. Step 14's argument, one level down |
| [`executors.md`](../../../context/executors.md) *Coder* — not configured, or in-host | one coder, by construction. That is what ships, so a fresh install runs one at a time |
| the host cannot run two coders at once, whatever that answer says | **say which of the two it was**, the recorded answer or the runtime; they are fixed in different places |
| [`verify.md`](../../../context/verify.md) has no **Prepare a fresh tree** answer | a fresh checkout has no installed dependencies, so a coder in one cannot write a failing assertion and run it. Name the file and `/onboard` |
| the cap is **1** | the project said one at a time. Not a gap — an answer |
| `git worktree add` fails, for any reason | report the error and run the phase. A tree that cannot be made is not a phase that cannot be run |

## The scratch tree

One per phase in the round, made by this command with plain git, at the feature branch's HEAD, **detached**,
under the repository's own admin directory:

```bash
git worktree add --detach "$(git rev-parse --git-dir)/phase-trees/<PLAN>-phase-<n>" HEAD
```

- **No branch is created**, and **the invocation [`executors.md`](../../../context/executors.md) names is
  not used.** That one makes a *workspace* — env files, a naming convention, a directory somebody opens,
  something it is handed to. This is a checkout nobody looks at, and the two are not interchangeable.
- **`--git-dir`, not the common directory.** From inside a linked worktree it resolves to that worktree's
  own admin directory, so under [`git.md`](../../../context/git.md)'s worktree answer each feature's
  scratch trees sit under the feature's own — and the sweep below cannot reach another feature's.
- **The path is fixed**, because it is the only thing that identifies these trees as this command's.
- **Record the sha `HEAD` resolved to.** It is this tree's base, `<base>..HEAD` is the phase's whole work,
  and the feature branch moves as the round lands — so the base cannot be read back afterwards.
- **Make it runnable.** Run what *Prepare a fresh tree* in
  [`context/verify.md`](../../../context/verify.md) says, in the tree, before the coder starts. That is
  paid per phase per round — the one cost that grows with the width being bought, so it is named in the
  report rather than hidden. **If it fails in a tree, the round does not run** — a command there may bind a
  port the tree beside it holds. No coder has started yet: remove the trees, name the command and its
  output, and run one at a time.
- **Then the tree has to be clean: `git -C <tree> status --porcelain` prints nothing.** A prepare step that
  rewrites a lockfile or writes a generated file nobody ignores has dirtied the tree **before the phase
  started**, and from then on the phase's own state is unreadable: landing reads a clean phase as a coder
  that stopped short, and the overlap check sees a path every phase in the round touched. Same outcome as a
  failure — remove the trees, **name the files it changed**, and run one at a time. An installed dependency
  directory is not this: `--porcelain` does not list ignored files.

**Where the runtime can give a coder its own temporary tree of this repository — one whose commits are
objects in this repository — take that and make nothing.** A copy or a fresh clone is not that: its commits
cannot be cherry-picked from here, so it falls back like any line above.

**The brief is step 7's, plus four sentences and no more:** work in this directory; the plan here is a
stale copy and is not to be edited; commit your work in this tree when you are done, because that commit is
what the caller takes; **other coders are running beside you, so a test that needs a server or a fixed
port is Gate 1's — leave it, and say in your output which assertions you did not run.**
[`roles/coder.md`](../../../context/roles/coder.md) is unchanged — one prompt for
every way a coder is dispatched, and committing is a property of this dispatch rather than of the role.

## The gates, and the ledger

**Both gates run in the feature's own tree, one phase at a time, in phase order** — never in a scratch
tree. Phase *k* is gated on a tree holding this round's phases up to *k*, and the tree holding up to *k*−1
has just passed, so a failure at *k* is *k*'s, exactly as in a sequential run. The loopback cap is
unchanged: two loops per gate, per phase. Nothing runs the verification stack in two trees at once.

**Only this command writes the ledger, and only in the feature's own tree.** Coders never touch the plan,
even where a phase's **Files:** line names it.

- **The round's rows open in one write**, before any tree is made: one `in progress` and one Note each,
  naming the round. Step 6's rule, for every phase in it.
- **A scratch tree's copy of the plan is stale, and that is harmless.** It is branched before the opening
  write is committed, and nothing in the tree reads it.

## Landing — the whole tree, as a range, in phase order

Per phase, in phase order:

1. **Check the coder finished.** `git -C <tree> status --porcelain` is empty, or **nothing from that phase
   lands** — it is a coder that stopped short, so its row stays `in progress` naming what remains, per step
   11, and its tree is kept. Uncommitted work in a scratch tree is not a candidate to land.
2. **Check the real diff.** `git diff --name-only <base>..<tip>` — the base recorded when the tree was
   made, the tip its HEAD — read from the feature's own tree with no checkout, against the paths this round
   has already landed. A shared path is the next section.
3. `git cherry-pick -n <base>..<tip>` — **the whole tree, however many commits are in it**, staged and not
   committed, so the row can ride the work.
4. **Gate 1**, then **Gate 2** on the staged diff, per steps 8 and 9.
5. **Close the row**, per step 11.
6. **One commit**, carrying the phase's change and its row — [`git.md`](../../../context/git.md)'s *one
   commit per phase*, unchanged.

**The range, not the tip.** How many commits a coder makes in its own tree is its own business, and
`<base>..<tip>` is the phase either way. Landing the tip alone would drop work silently.

**Cherry-pick reads the scratch tree without touching it**, which is what lets a tree be kept exactly as
its coder left it. A merge would add a commit per phase that no granularity answer names; a rebase would
rewrite the only durable record of what Gate 2 reviewed.

**A gate failure loops back in the feature's own tree** — never in the scratch tree, and **nothing is
reset.** The cherry-pick is already staged here, which is the state step 10 re-briefs a coder in on any
ordinary phase, so re-brief it here against this tree. The scratch tree is missing the phases that landed
earlier in the round, so a failure the combination caused — a shared budget two phases each fit under
alone — cannot be seen from there, let alone fixed there.

## When two phases touched the same path

The round was formed on a prediction; the diffs are the fact. Where a later phase's diff shares a path with
one this round has already landed:

- **The earlier phase stands.** It is already a commit.
- **The later phase's work is thrown away.** Nothing is cherry-picked from it, and the two versions are
  never merged — nothing here has the standing to decide which of two coders' versions of a file wins.
  Name the discarded tip in the report; its range is readable until git collects it.
- **Run that phase again, one at a time, on the combined tree**, from step 7, with its row still
  `in progress` and its Note saying so. It can happen at most once per phase per round: the re-run is
  alone, so there is nothing left for it to overlap with.
- **Say it in the report** — the path, the phase that kept it, and the phase that ran again.

**The check is before the cherry-pick, not after.** A range that conflicts stops part-applied with the
sequencer open, and getting out of it means choosing between two coders' versions of a file — the one
decision nothing here has the standing to make. Checking the diffs one command earlier means that state
never exists.

## Mixed results

- **A phase that ends `blocked` does not hold the others back.** Their work passed both gates in the
  feature's own tree, and withholding it buys nothing.
- **A blocked phase's Note names the tree its work is in.** `git worktree list` shows the tree and nothing
  else says which phase it belongs to. One line, by the same rule as every other Note.
- **The next round does not start**, and **each phase is reported as it lands** — step 14's stop list and
  its per-phase report, neither of them widened by a round.

## The trees this command removes, and the ones it never touches

[`context/workflow.md`](../../../context/workflow.md) says nothing removes a worktree. **This is the one
exception, and it is this narrow:**

- **Only a tree this command made, at the path above, detached and with no branch** — and **never with
  `--force`.** `git worktree list --porcelain` prints `branch` for every worktree the recorded invocation
  has ever made and `detached` for these. A tree with a branch on it is never touched.
- **A tree goes as soon as its phase lands** — `git worktree remove <path>`, never `--force` — and is
  **otherwise kept, with its path in the report.** One rule, covering a blocked phase and a discarded one
  alike. A record whose directory has already gone is removed the same way; nothing here prunes.
- **Without `--force`, removal cannot destroy work a coder failed to commit.** Git refuses a tree holding
  modified or untracked files and succeeds where the only leftovers are ignored — which is what an
  installed dependency directory is. A refusal is reported, not forced.
- **A later run sweeps that same path first**, removing what it finds there by the same test and touching
  nothing else. These are the only trees in this workflow that nobody else is keeping.

## The report

Step 13's report, plus three things:

- **Which phases ran side by side**, and which ran alone.
- **Every fallback, with the file and the answer that caused it** — once, not per phase.
- **Every tree still on disk, by path**, and the sha of anything thrown away.
