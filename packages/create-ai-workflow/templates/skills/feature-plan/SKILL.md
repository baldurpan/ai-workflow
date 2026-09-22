---
name: feature-plan
description: "Promote one item from the Tier-1 backlog into a Tier-2 plan with a phase ledger — a document under context/plans/, or the issue body where context/tracking.md says so — then stop without implementing. Explicit invocation only — run this when the user types /feature-plan. Do NOT match on 'plan out X', 'how should we build X', or any general planning or design request."
---

# /feature-plan

Turns one roadmap entry into a plan document, then **stops**. It never implements anything and never marks
a phase `done` — every phase in a new plan is `not started`.

**Planning is not activation.** Several features may hold plans at once; there is no "a feature is already
active" refusal here. That is what makes planning ahead possible. Activation is `--activate` or
`/feature-implement`, and both are subject to the one-active-feature rule in
[`context/workflow.md`](../../../context/workflow.md).

Read [`context/tracking.md`](../../../context/tracking.md) for where plans live. **Everything below is
written for the working-tree answer**; *Under the tracker answer* at the end says what changes.

## Usage

```
/feature-plan                        # rank the pending entries and ask which to plan
/feature-plan "<name>"               # plan a named entry
/feature-plan "<name>" --activate    # plan it, and mark it active
```

**Nothing needs to be looked up first.** This command resolves its own starting point.

## Steps

### 1. Pick the entry

Read `context/roadmap.md`.

**With a name:** take that entry. If none matches, say which names exist and stop.

**With no argument:** rank the `pending` entries and **ask which to plan**, using your runtime's question
mechanism if it has one, or a plain numbered question if it does not. Writing a plan is a commitment and
takes real work to produce; silently taking the top entry makes that decision on the user's behalf, badly,
whenever the backlog order is stale.

**Ranking**, in priority order:

1. **Has a draft** — the entry's **Doc** names a document in `context/drafts/`. Half-researched is better
   and cheaper. This dominates: an entry with real notes beats a one-line entry almost regardless.
2. **Unblocked by what just shipped** — it builds on something with a `context/history.md` row, so the
   ground under it is settled rather than hypothetical.
3. **Smaller first** — `small`, then `medium`, then `large`. A plan that can be executed beats one that
   gets admired.
4. **Backlog order** — ties break by position in the file.

Offer the top four, **best first**, each with a one-line reason drawn from the ranking — say *why* it is
ranked there, not just what it is. Leave room for the user to name something else.

Special cases, where asking is noise rather than help:

- **Exactly one `pending` entry** — state it and proceed. A one-option question is not a choice.
- **No `pending` entries** — say the backlog is empty and name `/roadmap "some idea"`. Do not invent one.

**State which entry you picked and why, in one line, before doing anything else.**

### 2. Already planned? Start a conversation, not a refusal

If the entry's **Doc** already points into `context/plans/`, say so, show the plan, and ask whether to
iterate on it.

- **Every phase `not started`** → iterate freely.
- **Any phase `in progress`, `blocked` or `done`** → **warn first, and get an answer before writing.**
  Rewriting a plan under work that already happened is the "ledger disagrees with the repo" hazard arriving
  by a new route. Name which phases have moved.

### 3. Decide the document

The plan ends up at `context/plans/<NAME>-PLAN.md`, where `<NAME>` is the entry's kebab-case name
upper-cased.

- **If the entry's **Doc** names a draft in `context/drafts/`**, `git mv` it to that path and build the
  plan on top of its content. Use `git mv`, not `mv`. Do not create a second file and do not leave the
  draft behind — a draft and a plan for the same feature is two documents disagreeing about one thing.
- **Otherwise** copy `context/plan-template.md` to that path. Copy it verbatim; it is a bare skeleton with
  nothing to strip. [`context/plan-template.notes.md`](../../../context/plan-template.notes.md) says what
  goes in each section.

**The draft is the most valuable input you have** — material the user gathered deliberately, often from
somewhere you cannot reach. Carry its specifics forward; do not summarise them away, and do not silently
drop a fact because you could not verify it. Mark it as an open question instead.

### 4. Research and draft

Delegate the research and the draft to a planner subagent **if your runtime provides one**; otherwise do it
inline. Either way the brief is the same, and the output contract is the template's section list, not a
planner's own default shape:

- The roadmap entry verbatim, and the full content of its draft if there was one.
- **If `prototypes/<NAME>/` exists at the repository root**, its `NOTES.md` and the mockups beside it. A
  sketch someone has already looked at settles a design question that a paragraph would only argue. Carry
  what it settled into §4 Design and cite the folder; treat anything it marked invented as a proposal, not
  a fact. **No folder, no step** — this is a conditional read, not a prerequisite.
- **The full section list from `context/plan-template.md`, stated as required output**, in order, with the
  ledger's exact column set. A general-purpose planner will otherwise emit implementation-steps-and-
  acceptance-criteria — a per-phase artifact, not a plan — and you will throw it away.
- Pointers to `context/stack.md`, `context/standards/README.md` (load per its conditional table) and
  `context/verify.md`. Cite the paths; do not paste the files in. Anything reading this repo can open them.
- **The surface question, asked out loud** — per the standing rule in
  [`context/workflow.md`](../../../context/workflow.md): does this feature put something in front of a
  person, sit in a hot path, or cross a trust boundary? Each *yes* names the standards rows the phases will
  be reviewed against, and each is a row nothing downstream will reach on its own. *None of these* is an
  answer and belongs in the report.
- **Where this project documents itself, and what this feature makes untrue there.** Start from the
  Documentation section of `context/stack.md`. **If that section is empty, missing, or names less than the
  tree plainly holds, sweep for it** — the root `README`, a `README` in each package, `docs/`, a docs site
  or landing page in the repository, an API reference or OpenAPI document, a changelog, help text and
  format comments that live in the code. Ask the user about anything hosted elsewhere: a wiki, a docs site
  built from another repo, a published reference. **An index nobody filled in is not evidence that there
  are no docs**, and a plan that assumes it is ships the drift.
- **Cite file paths and command output for every claim about the current codebase.** Anything unverified is
  an open question, not an assertion.
- Phases are **commit-sized units with checkable outcomes**, each with a real `Depends on` value and a
  **Files:** line naming every path it touches. That line is what makes reconciliation a check rather than
  a judgement call.

### 5. Write the document

Fill in the template's shape. Then:

- Date it and point its header at the roadmap entry.
- **No `**Status:**` header.** Feature status lives in `roadmap.md`, phase status in the ledger. A document
  that claims its own status is a copy that goes stale.
- Fill in **§7 Documentation** from what the sweep found: one row per surface the feature changes, each
  assigned to the phase that carries it, **and that phase's `Files:` line names the same path.** A
  documentation row with no phase is a follow-up nobody does. If nothing changes, say which surfaces you
  checked and why none of them describe this — that is an answer, and leaving the section blank is not.
- **Fill in §8 Verification with what proves each surface the question found** — the keyboard and contrast
  pass for something a person operates, the number to compare against §1's measurement for a hot path. A
  feature with a user interface names an **end-to-end pass in a real browser** there. Which driver runs it
  is `context/verify.md`'s answer; **if that file names nothing that drives a browser, say so in §9 rather
  than inventing one** — a standard named in a phase's review expectations and nowhere checkable is a rule
  nobody runs, and `/onboard` is what fills the gap.
- Fill in **§9 Open questions** honestly. An honest gap is worth more than an invented decision.
- Every phase is `not started`.

### 6. Update the roadmap entry

Repoint the entry's **Doc** field at the new `plans/` path. If you `git mv`d a draft, that same edit is
what fixes the now-dead `drafts/` link, so do it together.

**Leave the marker alone unless `--activate` was given.** `pending` with a `plans/` document is the correct
state for a planned-but-not-started feature.

**With `--activate`:** check the one-active-feature rule in
[`context/workflow.md`](../../../context/workflow.md) first. If another entry holds the slot, **write the
plan, skip the activation, and name the feature that holds it.** The plan is valuable and harmless on its
own; discarding it over a marker would undo the point of the split.

### 7. The plan and its entry travel together

They are one change: the entry's **Doc** field points at the document, and `check` reports a dead link if
the entry exists where the plan does not. Never leave one behind.

**Under [`git.md`](../../../context/git.md)'s worktree answer that ordering is load-bearing.** A worktree
branches from a ref, and it carries only what that ref already holds — so the plan has to be committed, and
pushed if the configured source ref is a remote one, **before the worktree exists.** Plan first, land it on
the default branch, then create the tree. A worktree made too early gets an entry whose **Doc** points at
nothing, and `check` inside that tree is red from its first run.

This is the one place the ordering is not obvious: everywhere else in this workflow a document and the work
it describes land together, and here the document has to land *first*, in a different tree from the one that
will use it.

### 8. Report and stop

State the document path, the phase count, the documentation surfaces §7 commits to updating, and the open
questions. Then say plainly that **what you produced
is a reviewable skeleton plus open questions, not a finished plan of record** — the value is the structure
and the research. Name the next step: the user reviews and edits the plan, and `/feature-implement` runs it
once they are satisfied.

## Under the tracker answer

Read [`context/tracking.md`](../../../context/tracking.md) first. The steps above hold — pick, check,
research, write, report — and only where the plan lands changes.

| Above | Becomes |
|---|---|
| pick from `context/roadmap.md` | pick from the open issues carrying the backlog label |
| the ranking's first key | **the issue's `Priority:` line**, above everything below it |
| ranking's *has a draft* | the issue body already holds researched material rather than one or two lines |
| ranking's *unblocked by what just shipped* | **the issue's blocked by relationships** — and an issue with an open blocker is not offered at all |
| ranking's *backlog order* | nothing — an issues list has no manual order, which is what `Priority:` replaces |
| `git mv` a draft into `plans/` | nothing moves — **the plan replaces the body of the same issue** |
| copy `plan-template.md` to a new path | write the template's sections into that issue's body |
| the phase ledger, Status column and all | **unchanged** — the same table, written into the body |
| step 6, repoint **Doc** | nothing — a plan is the observation that the body holds a ledger, plus the planned label, which is a rendering of it and is read by nothing |
| step 2's *already planned* check | the body already holds a phase ledger |
| nothing — a plan document has no size limit | **the body does**, and a plan that overflows it is split rather than trimmed |

**The ledger does not change shape.** `#`, `Phase`, `Depends on`, `Status`, `Note` — the table a plan
document carries, written into the body with every row `not started`. There is no second object to create,
nothing to reconcile it against, and **no window in which a plan is half-written: the body is one write.**

### A plan that will not fit is a plan for too much

That one write has a ceiling. [`context/tracking.md`](../../../context/tracking.md) says how large a body
may be; **measure the plan against it before writing, not after a write fails.**

The plan must fit with **room to spare**, because the same body is edited for the feature's whole life:
each phase row moves to `in progress` and then to `done`, gaining a commit sha and a note as it closes. A
plan that only just fits has already failed — the last phase would not land.

**Overflow is a scope signal, and the only honest response is to split the feature.** A filled plan is a
few thousand characters. One that reaches the ceiling is the design, the phases and the risks of more than
one piece of work written into a single document, and the substrate is the first thing that has said so.

**Three ways out are refused, and naming them matters because each looks reasonable at the moment it is
reached:**

- **Trimming the plan until it fits.** That discards exactly the research the plan was written to hold, to
  satisfy a limit that was telling you something true.
- **Continuing the plan into comments.** The plan would then have no single home, and a reader could not
  tell which half is current — the thing putting the ledger back in the body settled.
- **Linking out to a document or a paste.** Same failure, plus a second place to keep in step.

#### How to split

**Propose, then ask.** The phase list is already the seam — phases are commit-sized units with real
`Depends on` values, so a cut across a dependency boundary is a cut the research has already justified.
Offer the split as a numbered list, each chunk with the phases it carries and what it depends on, and
**write nothing until the user answers.** Splitting a feature in two is a scope decision, and this command
asks before it commits far less than that.

Once they agree:

- **The issue being planned keeps the first chunk**, and its plan is written into the body as normal. Keep
  the id: the thread, the reporter and everyone subscribed are the same reason adoption does not open a
  second issue about one thing.
- **Every other chunk becomes a new backlog issue** — carrying the backlog label, `pending`, with the one
  or two lines of why, a `Size:` and a `Priority:`. No plan and no ledger: they are Tier-1 entries, and each
  gets its own `/feature-plan` run when its turn comes.
- **The order between the chunks is a relationship, not a sentence.** A cut along a dependency boundary has
  just established which chunk waits on which, so record it the way
  [`context/tracking.md`](../../../context/tracking.md) says — one write per edge, visible from both ends.
  This is the strongest dependency the workflow ever knows about, and writing it into a body instead would
  leave the backlog's next reader to notice it by eye.
- **Cross-link anything the relationship does not carry**, so the split is visible from any one of them.
  Two chunks that share a subject without either waiting on the other get a mention in each body and **no
  relationship** — recording one there would hide runnable work behind nothing.
- **No parent issue, and no issue whose phases are separate objects.** The ledger lives in a body; a
  hierarchy laid over that is a second home for the same ordering.

Then plan the first chunk only, and **report the split first** — what was cut where, which issues were
opened, and which one this plan covers. That is the most consequential thing the run did.

**If the user declines the split**, say plainly that the plan cannot be written into this substrate as one
feature, and stop. Do not write a shortened version as a compromise: a plan trimmed to fit reads exactly
like a plan that was small enough, and nothing downstream can tell the two apart.

### What it waits on — read before the ranking, set after the research

[`context/tracking.md`](../../../context/tracking.md) says how this tracker records that one feature waits
on another. This command is both the main reader of that and the best-placed writer of it, at two different
moments.

**Read it before ranking.** One listing carries every open backlog issue's blockers, so this costs nothing
and changes what gets offered. **It is a filter and not a key** — it runs first, and `Priority:` then orders
what is left. An `Urgent` issue waiting on an open blocker is still waiting, and saying so is more useful
than ranking it first:

- **An issue with an open blocker is not a candidate.** Leave it out of the four, and list what was left
  out under them — one line each, naming the issue it waits on. A backlog where three of eight entries are
  waiting is a fact the user wants to see, not one to silently filter.
- **A blocker that is closed has been satisfied**, and the issue is an ordinary candidate. Nothing is
  removed on the way out; a closed issue does not block.
- **Every pending issue blocked** is a real state and the answer is not to pick one anyway. Say so, name
  what each is waiting on, and stop — where the blockers are themselves in the backlog something has been
  recorded in a circle, and where they are not, the next move is outside this workflow.
- **A named entry is planned even when it is blocked.** Planning is not activation, and planning ahead is
  what the split between them is for — say it is blocked and by what, and write the plan.

**Set it after the research.** Step 4 goes looking for what this feature is built on, so its brief gains one
question: **which open issues have to land before this one?** That is the moment the dependency is known
with evidence behind it rather than guessed from a sentence, which is why this command corrects what
`/roadmap` recorded rather than the other way round.

- **Record what the research found**, on the issue being planned.
- **Remove one the research disproves** — an entry `/roadmap` marked as waiting on something it turns out
  not to need. Say that you removed it and why; it is the same correction the type gets, on a field that
  actually changes what gets picked up.
- **Name both in the report.** What this feature waits on is as much a part of the plan as its phases, and
  it is the part nothing downstream re-derives.

### Priority leads the ranking

`Priority:` is read **above *has a draft***, and that is the only place this command's ranking changes.
Overriding the default order is the entire purpose of marking something urgent, so a key that only broke
ties between equally-prepared entries would not do the job it was added for. An issue carrying no
`Priority:` line ranks as `Medium`.

**Name the priority in the entry's one-line reason**, alongside whatever else put it where it is. The cost
of this placement is that the top candidate can now be unresearched — acceptable only because this command
still **asks**, and it would not be if it silently took the top entry.

### The planned label, applied here

[`context/tracking.md`](../../../context/tracking.md) names the label that says a feature has a plan.
**Apply it in this same run, immediately after the body write**, and say that you did.

**It is a rendering and never an answer.** *Whether this feature has a plan* is the ledger in the body,
which is what this command checks in step 2 and what every other command reads. The label exists so that a
person scanning the issues list can see the tier boundary without opening anything, and **nothing in this
workflow may start reading it** — not this command's ranking, not a refusal, not a report.

- **After the body, not before it.** The plan is the fact; a label on an issue whose body is still one or
  two lines is a sticker with nothing behind it. Where the body write fails, no label.
- **Best-effort, like the type.** Applying a label needs triage on the repository, and where the write is
  refused say so once and carry on. The plan landed; the plan is what matters.
- **Never apply it to anything else.** Not to the chunks a split opens — those are Tier-1 entries with no
  plan — and not to an issue this run did not plan.
- **Never remove one.** Nothing in this workflow takes it off, including a close.

### The type, corrected here

`/roadmap` guessed the issue's type from one or two lines. **You have the research it lacked: correct the
type if the guess was wrong, and leave it alone if it was right.** That is the whole of this command's
involvement with it. Nothing here reads it, and no refusal, ranking or report may start to.

Where the project has no types configured, or the write is silently dropped for want of push access, skip
it and say so once — it is metadata, not a gate.

### The rest

**`--activate` assigns the issue** rather than editing a marker, subject to the same one-active-feature
rule and the same outcome when the slot is held: write the plan, skip the activation, name the holder.

**Step 7's ordering problem disappears, and that is worth knowing.** Under the working-tree answer the plan
has to be committed and pushed *before* a worktree exists, because a tree carries only what its source ref
holds. An issue is in no ref: it is visible from every tree the moment it exists. Plan, then create the
tree, in whatever order suits — nothing here has to land first.

**Step 5's `**Status:**` rule applies to the issue body verbatim, and only to the feature.** The body holds
the plan and never a line claiming where the *feature* stands; that fact is the assignee. The ledger's
Status column answers a different question at a different scope, and it belongs in the body exactly as it
belongs in a plan document.

## Rules

- **Never implement anything.** Not "just the first phase", not "a quick scaffold".
- **Never mark a phase `done`**, and never mark a phase anything other than `not started`.
- **Never write outside `context/`.** No source files, no config.
- **Never shrink a plan to fit where it is kept.** A plan too large for its home says the feature is too
  large; splitting it is the answer, and trimming the research to fit hides the finding.
- Do not fold the draft's content into `context/roadmap.md`. Tier 1 stays high-level.
