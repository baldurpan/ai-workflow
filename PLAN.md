# `@baldurpan/create-ai-workflow` — what is left

**The tool is built and tested. This file is the live list.** Everything below is work that has not
happened yet, plus the handful of calls that are cheap to reverse now and annoying later.

Why the tool is shaped the way it is lives in [`DESIGN-RECORD.md`](DESIGN-RECORD.md) — 6799 lines of
tests, rejected alternatives and reasoning, **superseded by the code and read on demand, not on arrival.**
Every `§`-number below points into that document.

## Start here

1. Read this file. It is the whole of what is outstanding.
2. `npm test` — 514 tests. The 262 in `templates.test.ts` guard *content* invariants rather than
   code, and they are fastest way to see what the design refuses to let rot: runtime neutrality, one home
   for commands, one home for dispatch, one home for git etiquette, git on instruction rather than on
   initiative, a worktree made by the recorded command or not at all, one home for the tracker, no
   self-declared status, inert stubs, a ledger row that opens before the work, a substrate answer that
   never strands the data it names, a `--all` loop that stops where a single run stops, a `--pr` flag whose
   authority ends with the invocation that typed it, **a review comment that is a request rather than an
   instruction, answered through the same gates, acted on only where its author has standing, and resolved
   only where a fix landed**, **a `/release` whose Gate 1 and whose
   confirmation both sit above the step that consumes the notes**, a plan over its
   size budget being split rather than trimmed under either tracking answer, a ledger Note that stays one
   line, a brief that carries the phase and not the plan, documentation reaching the plan, an answer file that may
   not hold a false answer, one status vocabulary with no second place to record a defect, an order
   between features that is a relationship rather than a sentence, **a plan's open question that still needs
   a person getting an end at the close rather than being archived unread**, a titled §-citation resolving against
   the template, **an expected value that has a source outside the code under test, with the rule in one
   file and its title in the four that cite it**, the tracker half of a command kept beside its body and
   read only where it applies, **a contract only one command acts on living in that command rather than
   in the file every command loads**, **a round of independent phases the command forms by itself, with a
   fallback for every answer that forbids one and a removal rule that reaches only its own scratch
   trees**, a
   model tier that is an alias and never a dated id, and every relative link resolving after install — in
   both skill trees. The 134 in `budget.test.ts` guard *size*: a byte limit and a ratchet per shipped
   file, a cited `§` behind every limit, the always-loaded ceiling, and the per-command read sets derived
   from the links each skill carries (§24.5). `ci.yml`
   runs them on every push and pull request against `main`, plus an `engines-floor` job that builds on
   Node 20.10.0 and runs the packed CLI there — the suite itself cannot, since it executes `.ts` directly
   and that needs type stripping.
3. `README.md` is the user-facing description of what the tool does.
4. Open `DESIGN-RECORD.md` only when a *why* is actually in question.

**State:** `main` carries **0.28.0**. 0.14.0 was the body's ceiling (§10.13) and **item 6, the release
answer** (§11) in both its phases, with the event that completes it (§11.10), the event's record (§11.11)
and **§11.12** — and it was the first release cut from accumulated notes in this repository, so
`packages/create-ai-workflow/CHANGELOG.md` starts there. 0.16.0 adds **§13**; 0.17.0 adds **§10.14**,
`blocked by` between features, the first thing a live agent running the tracker answer asked for; 0.18.0
adds **§4.7**; 0.23.0 adds **§18**; 0.24.0 adds **§19**; 0.26.0 adds **§20** through **§27** in eight
commits; 0.27.0 adds **§28**; and 0.28.0 adds **§29**. **§30 is written and unreleased.**

**The version each section shipped in is below, on the section.** A paragraph here is the summary of a
`DESIGN-RECORD.md` section and stays after the release that carried it — but it says which release that
was, because three of them read *pending* for up to six versions after shipping, which is the one kind of
claim this file must not make.

**Written and unreleased: §30**, `/roadmap` off the flag. **An agent could not add to the roadmap**,
because §3.1 put `disable-model-invocation: true` on every skill and §15.3 made `/roadmap` the only way in —
so a gate with a feature-sized finding could only ask the user to type it. `/roadmap` is now the one command
an agent may run, in two cases its description names: the user asks in their own words, or a gate's finding
is work `workflow.md` routes there. `/feature-implement` step 9 and `/orchestrate` step 4 run it; the
`--pr` review loop and `/orchestrate`'s refusals still name it. **Under the tracker answer it asks before
opening an issue nobody typed for** — the first trial, chosen over opening without asking. It pins no
model or effort, because a skill's tier holds for the rest of the turn it was called in.

**Shipped in 0.28.0: §29**, the three holes a real review found in §28 — and the review that found
them was the app the §28.7 answer exists to summon, reading the pull request that first carried it. **The
label was promised on three commands' pull requests and applied on one**: `git.md` said `/feature-close`'s,
`/release`'s and `/orchestrate --pr`'s alike, and only the loop read the section, so the two commands now
read it where they open one — narrowing the sentence instead was rejected, since a feature's pull request is
the one most worth a reviewer. **A round had no wait**, so the three lines after the push would finish the
run on a pull request seconds old; each round now reads, waits and reads again for **up to fifteen
minutes**, and an expired wait reports *opened, labelled and unread*, which is a result. **The label goes
back on after every round's fixes**, because the app that answers it removes it when it is done — verified
on both pull requests that have used the answer — so applied once it buys one review of the first commit
and nothing that reads the fixes. **Standing is the axis §28.6 did not have**: it bounded what a comment may
ask for and said nothing about who asked, so step 2 now asks **two bits**, and only the pull request's
author, an account the forge says can write, or **an app the repository has installed** gets a fix made —
the installed app is the clause that matters, because the reviewing app's own comments come back with no
association at all, so a rule written on association would have silenced the one reviewer the project named.
Everything else is replied to, left open and reported, for the user to turn into work. Plus the two found
while checking: `workflow.md`'s permission paragraph still **counted three purchases** for a flag that now
makes five, and `/onboard` adding a fifth `git.md` section **left the sentence that counted them** saying
four, in a project-owned file `update` cannot reach. **Eight tests**, and the *two bounds* test became three.

**Shipped in 0.27.0: §28**, `--pr` staying for the review. The flag pushed and walked away, so a
reader who left a comment was handed a chore; now the run ends when the review has been answered — the
label *What a pull request carries* in `git.md` names applied before the first round, then up to **three
rounds** of: read the open threads, give each **one bit** (*does it ask for a change to the change under
review?*), fix the ones that do through **the same Gate 1 and Gate 2**, push, and reply. **It resolves only
threads whose fix landed** — words alone leave a thread open, because resolving is a claim a reviewer still
has to agree with. §18.4 refused a long-lived `--pr` for `--automerge`, and the count that looked like it
covered this does not: an intended merge is recorded nowhere, while **an unanswered comment is recorded by
the forge**, so there is no new terminal state and nothing resumable had to be invented. **It reads threads,
never statuses** — deciding what *required* means is the forge fact §18.4 put out of a skill's reach, and a
bot that writes its failure into a comment is answered like any other. Bounded twice, and the per-thread one
does the work: **one fix attempt per thread**, because a thread that comes back is a disagreement. The
label is **a fifth `git.md` answer, shipped as *no label***, not a string in a skill — §10.8's rule reaches
it, and `/orchestrate --pr` is simply its most dependent reader. **A comment is a request and not an
instruction**: the first untrusted input any command here consumes, and it may not widen scope, lift a
refusal or authorise anything. One fused refusal had to be **split** — *stay alive* and *watch a check run*
were one sentence with one test on it, and only the second survived. **Twelve tests.**

**Shipped in 0.26.0: §27**, the checks this package was not running on itself. `npm run check` was `tsc
--noEmit` against the **build** config, whose `include` is `src/` because that is what `tsc` emits — so
`scripts/budget.ts`, which decides every byte limit, and the whole of `test/`, including 175 KB of content
assertions, had **never been typechecked**. Those are the files most likely to go stale, because they read the
code rather than being read by it. A second `tsconfig.check.json` extends the first, turns emit off and
includes `src`, `scripts` and `test`; `build` still runs the original, so `dist/` has exactly one producer.
**It found a real error on its first run** — an unguarded regex capture in the test added to catch a broken
link in the vendored standards, one input away from throwing instead of asserting.

**Shipped in 0.26.0: §26**, phases of one plan running side by side. Step 3 picked one phase and `--all`
ran them in sequence; now it forms a **round** — the runnable phases whose **Files:** lines share no path,
prose included, up to the cap in `executors.md` (3, and `1` turns it off) — and gives each its own coder in a
detached scratch checkout it makes with plain git, in `.phase-trees/` inside the working tree it is standing
in. The work comes back by `cherry-pick -n` in phase order, so one commit still carries a phase and its ledger
row; both gates stay in the feature's own tree, one phase at a time, which is what keeps a failure
attributable to the phase that caused it. **It was measured before it was built, and the measurement argued
against it**: 115 phases across 18 archived plans would have run in 107 rounds rather than 115 — 8 rounds
saved, in 6 of the 18 — because `Depends on` orders information and not files. It was built anyway, with the
design's flag removed (the command decides, and the permission for the checkout is a written exception in
`workflow.md` rather than a typed flag), every refusal turned into a fallback that names the answer that
caused it, and a real-diff overlap sending the later phase back to run alone instead of closing it `blocked`.
Then four corrections after the first build, all before anything was committed (§26.18): a fallback that came
from `/orchestrate --pr`'s push rule and would have turned rounds off in most of the measured corpus, a gate
loopback moved into the feature's own tree — which removed the reset exception entirely — landing the tree's
whole `<base>..<tip>` rather than one commit, and a brief that tells a coder the others are running so a test
needing a fixed port is left to Gate 1. Then a fifth (§26.19): *Prepare a fresh tree* can dirty a tree before
any coder starts — a rewritten lockfile, an unignored generated file — which landing reads as a coder that
stopped short and the overlap check reads as a path every phase touched, so the tree is checked clean after
that section runs, `verify.notes.md` says how to keep it clean, and `/onboard` proves the answer in a
throwaway clone. **Then a sixth round of corrections, from a review before the release** (§26.20–§26.24),
three of them bugs in rules that had just been written: the sweep removed a tree **by its shape** and the
shape test passes on exactly the tree the keep rule was protecting — a coder that committed leaves a clean
tree, so removal succeeds and the commit goes — so it now removes only a tree whose row reads `done`, the Note
carries the tip beside the path, and a resumed phase lands its kept tree instead of re-running a coder; a
phase that blocks now **ends the round's landing**, because §26.18 moved the loopback into the feature's tree
and every later phase is cherry-picked and gated on top of the blocked phase's half-work; and **the trees
moved out of the git directory**, which is the one place the host running the coder is least likely to let it
write — Claude Code treats `.git` as a protected path (prompted, denied under `dontAsk`, and
`permissions.allow` cannot pre-approve it) and seals a worktree-isolated subagent out of the main checkout
entirely, while its own isolation worktrees are cut from the **default branch** and are never swept once a
coder has committed in one. A directory in the working tree is writable, and what keeps Gate 1 out of it is an
ignore entry rather than the leading dot — **the seventh round's correction** (§26.25), after the user
measured the tools these projects actually run: Biome lints inside a dotted directory unless the folder is
git-ignored *and* it is configured to read that file, and Vitest's default include runs tests there, so phase
*k*'s gate would have linted and tested the other phases' unfinished trees — and `dynjandi-core`'s `biome
check --write .` would have written into them. So `/onboard` writes `.phase-trees/` into the project's
`.gitignore` and then **proves it**, by planting a lint failure and a failing test under it and running every
Gate 1 command; where a tool still sees them the fix is that tool's own setting, and where it cannot be fixed
the cap goes to 1, which was already the recorded way to say one phase at a time. A round checks the cheap
half every time with `git check-ignore -q .phase-trees/`. Plus four smaller holes: a round forms from `not
started` phases only, a path that contains another is an overlap, the coder reports what §9 item its phase
settled and the orchestrator writes it, and the tracker answer closes one row per phase as it lands. Costs one
new conditional file beside the skill — `parallel.md`, 18,302 bytes, read only where a round forms or a kept
tree is resumed — a hand-typed raise on every per-file limit it moved, and **27,648 bytes on the our-templates
ceiling**, the largest raise it has taken.

**Shipped in 0.26.0: §23**, the correctness rule the coder never had. `roles/coder.md` held nine
coding principles and **no step saying when a test is written or where its expected value comes from**, so
a test could assert whatever the code returned and both gates would pass — Gate 1 because a copied
expectation is the one assertion that cannot fail, Gate 2 because the checklist asks whether the behaviour
is covered and the standards say *test behaviour, not internals*, which a copied expectation satisfies
perfectly. **This is the third instance of the shape §2.9 and §13.1 found: no gate fails**, and the fix has
the same two halves both times — a question asked out loud, and a place to write the answer down. Taken
from a second repository's agent tree, where the answer was entangled with a date-time domain; **three
sentences survive the removal of it** — decide the value before any code runs, check it against something
independent of the implementation, and a green suite only proves the tests and the code agree with each
other. The named authorities, the named tools, the word *oracle* and the *zero known bugs* policy did not
travel. **One sentence was added that the reference does not have:** say where the rule does not apply, for
documentation, configuration and wiring that only passes a value through — a tool that installs everywhere
needs it or the rule is ignored on the two thirds of changes it was never about. The rule has **one home**
in `workflow.md` and **four readers with four different obligations**: the coder's five-step slice loop,
`plan-template.md` §8's row per computed value, the planner finding those sources as research with an
unfound one going to §9, and the reviewer's two standing checks. The two reviewer checks are split because
they **fail differently** — a sourceless expectation is a check that cannot fail, a rule nothing asserts is
a check that was never switched on — and the enforcement point is the reviewer rather than the coder,
because the coder is the party who can make a test green by moving the expectation. Gate 1's half is a
**marker check offered and never installed**: a runner reports a skip as a pass, so the Test section can
exit 0 while the suite asserts almost nothing, and `/onboard` Step 7 offers a section for it while
`verify.md` stays the only file that names its command. **Three refusals** — no shipped script, no stub
heading (`stubGaps` would report a gap to every existing install), and optional on purpose, since a project
that marks work in progress with a skip has chosen something this check forbids. **The category is named
and the syntax never is**, as a new test over every template: a marker's spelling picks a stack. Nothing
under `standards/` changed (§6.3) and no skill body did — the host-review fallback already reads
`workflow.md`. **Nine tests**, +1,643 bytes on the per-phase read.

**Shipped in 0.26.0: §22**, found in the paragraph next door while §21 was being written.
`/orchestrate` step 4 still said a non-blocking observation *"needs code changes, in which case it is work
and belongs in the backlog per `tracking.md`"* — the condition §14.3 showed was not a bar, routing to the
destination §15.3 forbade, **four versions after both landed**, and contradicting step 5 of the same file
eleven lines down. §15.3's fix reached `/feature-implement`, which it quotes, and never looked for the
sibling. **The guard missed it because it was keyed on the words of the one violation it was written for:**
a sentence containing `backlog label` plus an applying verb, and the stale sentence has neither — it says
*the backlog* and *belongs in*. That is **§12.5 a second time** (a deletion test keyed on a path misses
every reference that never needed the path), one step more general: key a guard on the **fact** — something
is being routed into the backlog — not on the sentence that was wrong. Worse, two test comments describe
the old rule in the past tense beside a suite that was not checking where it was still in force; **a
comment written at the moment of a repair is the most confident thing in the repository.** The guard is now
keyed on `backlog` with a routing-verb set and two exemptions — the sentence refuses, or it names
`/roadmap` — verified by reverting the one sentence and watching it fail with the sentence quoted. The dead
condition is **named where it bit** rather than dropped. One leftover const went with it. **No new rule:
the rule was already right in `workflow.md` and in two of the three places that cite it.**

**Shipped in 0.26.0: §21**, the owner check — the fifth field report, and the first about a section
of a document rather than a store. `baldurpan.com` retired **nine of thirteen** features `shipped` with a
human check still open, every one of them said out loud in the `history.md` Why column: *"the Icelandic and
VoiceOver check await the owner"*, *"the owner's wording (Q11, Q18), the halo and look (Q16, Q20) and an
iPhone check (Q14) await"*. **Nothing was negligent** — every phase was `done`, both gates passed, the
ledger check at the top of Mode 1 was satisfied, and `/feature-close` has no step that reads §9. The plan's
open questions are surfaced once, at activation, and then archived into a file no command opens. **None of
the three endings fitted one:** it is not a defect (nothing is known to be wrong), not a backlog entry
(nobody wants a history row for *read the Icelandic*), and not a note (`notes.md` is deleted at the close,
which is the moment the check becomes real). **The fourth kind is defined by its closer — a person looking
at it** — so the close now gives every surviving item one of **answered, filed or waived**, with the user
picking and silence not a waiver. **The destination is reused and the kind is named:** it goes wherever this
project already files bugs, outside `tracking.md`'s one bit under both answers, and **not written up as a
defect**, because a pending screen-reader pass filed as a bug is a bug report nobody can reproduce. **No
file, no stub, no `check` rule, no new status word** — the bound is the lifecycle, since §9 is written once
and archived with a plan nothing reopens, and §14.6's refusal of a watcher stands. **The Outcome column
gains no value:** `history.md` is append-only, so an outcome reading *pending* is one nothing can withdraw,
and under the tracker answer that column is a close reason with two values and no room for a third — so the
**Why names the issue**, which is one clause different from what the field was already writing and is the
whole fix: the sentence becomes a pointer instead of being the record. `/feature-implement` answers in place
whatever a phase settles, which is §2.9's documentation rule applied to the plan's own questions and is what
keeps the close's pass to one bit rather than twenty dispositions. **Thirteen tests.**

**Shipped in 0.26.0: §20**, the plan's size budget. Measured 23 plans in four real installs on
2026-10-16: the median is **48,893 characters** and six are over the 65,536 an issue body holds, which
falsifies §10.13's "a filled plan is a few thousand characters" — the one load-bearing premise in that
section. §10.13 had already written down the consequence and left it unbuilt: under the working-tree
answer *nothing in the tree ever says so*. **Now something does.** The ceiling and a **500-character
per-phase reserve** are fields in `tracking.md`, one home for a question that file's primitive map already
held, in a `##` section below the subsection `/onboard` deletes — a `###` would have been silent in exactly
the installs that need to hear about it, which is §20.2's correction of treating §17.2's `stubGaps` silence
as a rule rather than a side effect.
**The number is the same under both answers on purpose** — a plan that passed in the tree fits a body, so
`/tracking-migrate`'s refusal stops being a trap sprung by adopting a tracker. `/feature-plan` measures in
step 5 and sends an over-budget plan to **`split.md`**, a supporting file beside the body: §17.2's rule a
third time, since every run measures and almost none split, and it deduplicated a split that would
otherwise have been written out under both answers. **The ledger Note is one line** — the measured median
was 440 characters and the longest 6,714, a phase log in the one column with no visible bound — with the
detail relocated to the commit message or the report, because a rule that only forbids loses the thing
worth keeping. **The briefs carry the phase, not the plan**: `coder.md` had said it receives "a plan", and
every phase now carries a `Decisions:` line, which is §17.3's standards move applied to §3 and the second
application is what makes it a rule. The plan was outside §17.1's reading budget entirely while three
readers opened one per phase — 49 KB each against a 78 KB budget. `check` reports an oversized plan as a
**note**, which was a level with display code and **no producer** — §2.8's shape found the same way. Cost
**+3,479 bytes** on the orchestrator's per-phase read, against roughly 37 KB saved per brief, twice over.
**Twenty-five tests.**

**Shipped in 0.24.0: §19**, `/release` — the pull request `release.md` has described since §11.10 and the
tool could not produce. §11.12's flag runs the Bump wire on a **feature's** branch, so the pull request whose
merge ships is the feature's own wearing the release's hat; the separated shape lets the notes accumulate on
the default branch and cuts a branch carrying nothing but the version move and the changelog. **Both ship** —
they differ in which branch the version moves on and therefore in what the merge ships, so `workflow.md`
carries a two-row table and `/feature-close` names `/release` for the case where a release was asked for and
no flag was typed. **Nothing new was needed**: C18's *typed in the turn it takes effect* admits a command as
readily as a flag and the test now asserts that the list is **closed** rather than quoting its one member;
§18.2's permission source is unchanged; `executors.md` still owns the branch. **The one new piece of
reasoning is the order.** The script the *Bump* wire names cannot be run twice, so Gate 1 runs before
anything is consumed and the branch exists before the script runs — a gate run afterwards on a red default
branch leaves a tree whose notes are gone and whose release cannot be cut again, which is **the one
unrecoverable state in §11** and is reachable by doing the obvious things in the obvious order. There is no
Gate 2, written down with its reason. The branch is named for the act (`release/<date>`) because the version
is not knowable before the script has run. **Six sentences in answer files were false** — three from this
change and **three that `--release` had already broken** in §11.12 and nobody swept, all three blanket
reassurances, which is the generalisation: when a command gains an exception, sweep the sentences written to
reassure. Plus six hardcoded "nine"s, two now derived from `SKILL_NAMES.length`. **Eleven tests.**

**Shipped in 0.23.0: §18**, `/orchestrate --pr` — the first flag in this workflow whose
authority is the typing of it. `git.md` names two sources of permission and only two, and the second is *the
user asking in this session, in plain words*; a typed flag is that, so the flag needs no answer file, no new
`git.md` section and no fifth `/onboard` question, and **nothing it does becomes policy for the next
invocation**. Committing was never the hole — *Who commits* already governs it — the push and the pull request
were, and the obvious implementation could not work: a fresh install ships *the user commits*, *neither* and
an empty *Branch and worktree*, so a flag reading those answers would have been inert three times over. **It
cannot invent a branch**: on the default branch it stops before the commit unless `executors.md` names a
command, and it never makes a worktree. **Two flags were refused with it** — `--automerge`, because `git.md`
reserves merging in one line and an agent polling CI is a half-finished run in the one command that keeps no
resumable record; and `/bugfix` as an alias for `/orchestrate --pr`, with the rename to `/implement`, because
both make the command's name the phrase people type into the command that has no ledger. One correction fell
out of it: `workflow.md` said a push happens once per feature, at `/feature-close`, which this flag made
false. **Eight tests.**

**Shipped in 0.18.0: §4.7**, the fourth field report in a row and the second about git. §4.4 asked *who
commits* and §4.5 asked *where work lands*; both answer what the **workflow's commands** do, and the
observed failure was outside all of them — worktrees and branches created unasked, and commits, while doing
anything at all. The scope of those answers was implicit and an implicit scope reads as a grant, which is
§4.4's own lesson turned on §4.4. Staging had also been absent from every list for four versions, so *leave
it in the working tree* was satisfiable by an agent that ran `git add -A` first. The rule — **never on your
own initiative, permission never inferred, and force-push / default-branch / rewriting published history
asked for by name** — is invariant rather than per-project, so it lives in `workflow.md` and the `AGENTS.md`
block where `update` reaches it; only **What no answer here authorises** is a new `git.md` section.
**`executors.md` gains *Branch and worktree*** — two files had been pointing at a destination that did not
exist, which is why nothing on disk ever named a worktree command and why an agent reached for
`git worktree add`. The CLI those repositories use is named in `/onboard`'s question and nowhere else in
`templates/`, per §4.3, and a test holds that line.

**§13 came from a question rather than a field report** — *are we missing things for quality assurance,
like a11y and performance?* Two gaps with one symptom, and **neither was a missing standard**: the vendored
tree already says accessibility is part of the definition of done. **The table that loads it is keyed on
*if the task involves…*, and three of its rows cannot answer that themselves.** Accessibility, performance
and security are properties of the change that the reader has to have thought of before opening the table,
so the row is reached only by somebody who had already agreed. That is §2.9's argument with a worse ending,
so it ships §2.9's answer: a standing rule in `workflow.md`, cited by `/feature-plan` and `/orchestrate`
rather than restated, answered out loud with *none of these* legitimate and silence not, and what proves a
surface recorded in the plan's §8 — an **end-to-end pass in a real browser** for anything with a user
interface, its driver named by `verify.md` and by no template, which a test now enforces.

**The second gap was that `verify.md`'s four headings read as a schema and were never anything but prose** —
no code has ever parsed that file. A project with an end-to-end suite, an accessibility pass or a size
budget could stretch it into a heading it did not belong in or exile it to *Not run by Gate 1*, and both end
with the gate green for a change that broke a check the project owns. Gate 1 now runs **every section above
*Not run by Gate 1***; `/onboard` Step 7 asks what else this project runs and sorts each one by whether a
phase can afford it; and that section has to **name what does run each entry** — without the name it records
a check nobody runs, which is a different and much worse fact than one this gate skips.

**§11.13 is the third field report in a row, and the first where the wrong thing was something this tool
wrote.** `piff`'s new `record` job set a variable from `${{ runner.temp }}` in a **job-level** `env:`,
where that context does not exist — an unresolvable reference is rejected at **parse** time, so the whole
workflow went inert: no Gate 1, no deploy, no record, on any branch. None of that is this tool's to ship
and it cannot be: `templates/` has no YAML and §11.2 refuses to generate a release job. **What was this
tool's is that `/onboard` then read that file and recorded the Tag wire as *cut by `ci.yml`'s `record`
job*** — accurate prose, dead mechanism. §11.2 guards *not on disk*; this was on disk, correct, and inert.
And it is structural: because the release job is always written by somebody else, Step 9 always reads it
back as the source of truth, so **any install following the instructions can end with a `release.md`
describing a pipeline that has never run once**. The sweep now asks of everything it named — has it ever
run, and what did it leave behind — and the stub says a wire names something that has run or says that it
has not. **C21** holds the general form: three reports, three times the file was true and the repository
was not in the state it implied, three times the fix was to read the artifact rather than the description.

**§11.12 is `piff` again, and this time the complaint was about a step somebody had already written down.**
Closing a feature there meant: write the note, run the script that consumes it, **then write an empty note
so the note check goes green**. That third step is a repository instructing its contributors to satisfy the
note check with a note that describes nothing. The check asks *are there pending notes?* as a proxy for *is
this change described?*, and the two come apart on exactly one commit — the release, where the notes are
gone **because they became the changelog**. The condition that tells them apart already existed one section
up: §11.10's ship gate, *this path's own version moved*. **This repository had the identical defect
unfired** — `release-note.yml` would have gone red on its own next release, deterministically, because the
tag it compares against is cut minutes later by `publish.yml`. The other half of the ask was
`/feature-close --release`, which is now the only shape the *asked for in that turn* exception has: a flag
typed in the turn it acts, listing every pending note it will consume before it runs. **It does not remove
the empty-note step** — only the check fix does that, which is why both landed together.

**The fix did not reach the repository that reported it, and that is C20.** An existing install gets
tool-owned files from `update`, keeps its own stubs, and re-derives its answer file from `/onboard` — and
the check is a CI workflow, which is none of the three. So Step 9's sweep gains a **sixth item** that reads
whatever asks for a note, reads what it does on the release commit, and reports; and it looks for the tell
this was found by, **a workaround that has become a documented step**. The limit underneath it is accepted
rather than solved: §11.2 means this tool can record an answer about a check it can never generate or
enforce, so the last step closes only when a person edits a workflow.

**0.13.2 is what `piff` found by running §11 for real.** Two pull requests, the second carrying the version
bump, the deploy gate fired, production updated — and the tags and releases pages were both empty. The
answer file was **not false**: it said in as many words that nothing tags, and called it deliberate. It was a
true record of a decision this tool made and never asked about, and §11 had a name for an answer that is
false and none for one that is true and wrong. §11.8 had picked `tag: false` from the vendor's config
reference; the vendor also has a page named after this exact case, and it says `{ version: true, tag: true }`.

**§11.10's sentence was half-applied.** *One event, not one per artifact kind* fixed the trigger and left
the record per artifact kind — and a published package gets its tag as a **side effect of the publish
command** while a deploy has no such command in its path. So the publish half had a record nobody chose and
the deploy half had none, with every individual step reporting success. **The record belongs to the event,
not to the kind of artifact:** `tag` now follows `version`, the wires gain a fifth (`Release` — across all
of §11 *a release* had only ever meant the act, never the page someone reads), the per-path table gains
*Leaves behind*, and Step 9 sweeps the repository's actual tags, which is the only place the defect is
visible. Verified end to end on a repo `release-init` configured: 0 published, tag cut, release body ready.

**0.12.0 removes a file rather than fixing it, and the route there is the part worth keeping.**
`northguild/worktree` reached 35 open findings against five shipped features — 1097 lines, 76 KB, large
enough that the file came back **truncated** to the very gate that was supposed to read it. The first fix
widened `/feature-close` from *sweep what is closed* to *dispose of everything tied to this feature*, with
three dispositions and a `check` rule for orphans. It worked and it was the wrong fix: **it bounded the
tail and left the accumulation**, since an eight-phase feature could still carry thirty `P2`s through its
whole life, read by every phase, going stale as the code moved.

The question that settled it was *what does this file do that something else does not already do* — and
the answer was **nothing that matters**. A session that dies is already survivable because the ledger row
opens to `in progress` before any code; `done` already means both gates passed, so an open blocker was a
second copy of *the gate failed*. `P0`–`P3` was a **second status vocabulary laid across the ledger's
four**, kept in sync by discipline, and `P3` — *a note worth not losing* — was the category that grew
without bound.

So: a review item is **blocking or it is not**. A blocking one is fixed, or the phase closes `blocked` with
the reason in its Note, or it is an issue. A non-blocking one is an issue if it needs code changes and a
line in the report otherwise. `/feature-close` refuses once instead of twice, `/orchestrate` hands a capped
change back instead of filing it, `check` loses two rules and the `Finding` parser, and `update` tells an
upgrading install the file is no longer read — then leaves it alone, because it is project-owned and
outside the manifest by design. **§12.7 holds the transferable half:** a file whose invariant is maintained
by discipline has no invariant, and the instinct to repair the sweep cost two passes before anyone asked
whether anything should be in the store at all.

**0.10.0 is a fix, not a refinement, and both published versions need it.** The sub-issue design could not
run: a phase closed its sub-issue through `Closes #N`, that trailer fires only when the commit reaches the
default branch, a phase never pushes, and `/feature-close` refuses until every sub-issue is closed. So
inside a feature's branch no phase could ever read `done`, phase 2 was never runnable, and the merge that
would have released it sat behind a command those same sub-issues blocked. It shipped in 0.8.0 and again in
0.9.0 because **nothing here had ever been run by a live agent** — which is exactly what item 5 below said
the remaining risk was.

**`/onboard` Step 5 was silent in its most common case**, found on the first real install of 0.8.0. A
brand-new repository usually has no remote yet, and Step 4 ships saying *neither* a push nor a pull
request — so both of Step 5's checks closed at once, the step had nothing to ask, and **asking nothing was
read as saying nothing.** The user never learned the tracker answer existed. Two fixes: a step that can ask
nothing must still **report**, and the dependency on Step 4 **resolves forward, never backward** — Step 5
offers the tracker answer and offers to change Step 4's along with it, rather than pre-refusing on a
default taken three questions earlier. The general lesson is worth more than the fix: **a conditional step
needs an unconditional output**, or its quiet path is indistinguishable from a bug — and the quiet path is
usually the default one.

**Then the second real install found the larger half of the same defect.** Step 5 wrote the tracker answer
over a repository whose backlog, drafts, plans and `active` feature were all still files, created the two
labels, and stopped. Nothing was lost and nothing was broken — and every command in the workflow then read
the tracker, found nothing, and reported an **empty backlog**. The entries were unreachable, which is worse
than lost because it looks like a clean install. The repository's own `tracking.md` ended up documenting a
*"the rule is by date"* split that no skill knows how to read.

**§10.8 always said what to do about it and 0.8.0 shipped neither half.** The design record's answer was
that `/onboard` refuses to switch while anything is in flight, and that a real migration is its own
command. 0.9.0 ships both:

- **`/onboard` Step 5 looks at the tree before it writes the answer**, and says what it found — always.
  Nothing there, the switch is free. Entries, drafts or plans, it writes the answer and names
  `/tracking-migrate` as the required next step, recording the split in `tracking.md` so it is a task
  rather than a trap. A phase `in progress`, it **refuses**: an agent may be inside that phase in another
  tree, and the substrate must not move underneath one.
- **`/tracking-migrate` is the ninth command.** It moves data and never chooses the substrate. Per
  feature, additively, with the tree files removed **last** — so a run that fails at feature twelve leaves
  twelve migrated and eight not, each in exactly one substrate, and a re-run finishes it by observing what
  is already there rather than by reading a progress file. One direction only, and `history.md` and
  `archive/` are never converted in either.

Ten tests guard it, including the one that would have caught it in the field: **`check` now faults a
backlog left in `roadmap.md` under the tracker answer.** Nothing else could notice — the entries stay
well-formed and the file stays where it was, it is simply no longer read. **The lesson generalises past this command: a configuration write that strands data
is not a configuration write.** Setting an answer and moving the work are two acts, and a command that
does the first while silently declining the second has shipped a broken repository that reports as a
working one.

**0.9.0 also gives `/feature-implement` an `--all` flag.** One invocation was one phase, which is right
while a user reads each report and wrong once they have decided to let the plan run. The flag loops steps
3–13 and nothing else: step 2's approval checkpoint, branch and marker stay once per feature, and the loop
stops at the last `done` phase and **names** `/feature-close` rather than crossing into it — phase to phase
is not a tier boundary, so the rule the tier model exists to protect is untouched. What it does remove is
the pause where a bad phase is caught before the next one builds on it, so that pause is replaced by
something written down: a stop list — `blocked`, part-landed, a capped gate, a ledger that
disagrees with the repo, nothing runnable — and two answers said out loud before the first phase. Which
reviewer `executors.md` gives, because the shipped one is the host reading its own diff; and, under
`git.md`'s shipped *the user commits*, that the flag **runs one phase and declines the continuation**,
because a tree carrying four phases cannot be cut back into the four commits that file says they are.
Eight tests guard it.

**To release: commit and push to `main`** — that tags `v0.13.1` — **then publish the tag as a GitHub
release.** An npm workspaces monorepo — the installer lives in
`packages/create-ai-workflow/`, and `apps/*` is reserved for a landing site or hosted documentation.
Installs a `context/` tree, the nine skills into **both** `.claude/skills/` and `.agents/skills/`, two
Claude subagents, a merged `AGENTS.md` block and a manifest that draws the ownership boundary — 120
tool-owned files, 8 project-owned stubs.

---

## What is left

### 1. Run the loop under a live agent — most of it has run, and this item was wrong for six weeks

**Seven repositories have been running the loop, the earliest since 2026-09-06.** Each carries
`context/.state/manifest.json`: **0.25.0** in `piff/piff` (installed 2026-09-06),
`snowsense/snowsense` (2026-09-08) and `baldurpan/quotavero` (2026-10-12); **0.24.0** in
`dynjandi/dynjandi-core` (2026-09-10) and `baldurpan/bgmusik` (2026-10-05); **0.23.0** in
`dynjandi/dynjandi` (2026-10-02) and `baldurpan/baldurpan.com` (2026-10-05). Re-verified 2026-10-16 by
reading those files, their
`context/` trees, `git log`, `git worktree list` and their issue and pull-request history. **They were read
and not touched**, and nothing below is claimed that was not seen there.

The original dogfood was executed **by hand**: install into a scratch repo with a real `package.json`,
`/onboard`'s run-each-candidate pass, then `/roadmap` → `/feature-plan` → `/feature-implement` (both
phases, both gates) → `/feature-close`, with `check` clean at every step and correctly reporting four
planted breakages afterwards. That proved the documents were **executable and mutually consistent**. What
follows is what the seven repositories prove on top of it, and what they still do not.

#### What has run

- **The whole four-phase run this item was waiting for, forty times.** Across the five repositories on the
  tracker answer, **40 features carry a ledger of four or more phases with every row at `done`** — 21 in
  `piff`, 8 in `snowsense`, 7 in `dynjandi-core`, 3 in `dynjandi`, 1 in `quotavero`. The longest are
  `snowsense` #57 `gmt-date-handling` (8), `snowsense` #27 `mcp-apps-charts` (7), `quotavero` #1
  `bokun-connect` (7) and `piff` #99 (7). *Checked:* `gh issue list --label workflow:feature` per repo,
  then the `Status ledger` section of each body, counting rows and `done` rows.
- **Both gates and the loopback, under a real reviewer.** `piff`'s ledger rows carry **126 `PASS WITH
  NOTES`, 18 `FAIL` and 55 mentions of a loopback** — #172 Phase 6 reads *"Gate 2 (Opus reviewer) FAIL → 1
  loopback → PASS WITH NOTES"*, #139 Phase 4 *"Gate 2 FAIL, FAIL, then PASS WITH NOTES on loopback 2"*, and
  #113 Phase 4 records a `PASS WITH NOTES` that went back to `FAIL` on an in-host fix. *Checked:* grep over
  the ledger rows of all 61 feature issues in that repo.
- **The reviewer subagent answer, which this item said had never been run.** All seven repositories name
  `.claude/agents/reviewer.agent.md` in `context/executors.md` as the Gate 2 reviewer, dispatched as
  `subagent_type: "reviewer"`; **28 of `piff`'s ledger rows name it** (18 *"reviewer subagent"*, 10 *"Opus
  reviewer"*). `piff` also records that the pinned `model: opus` is what keeps a Sonnet coder from being
  reviewed by its own tier, and that an older `.claude/agents/reviewer.md` declaring the same name on
  `sonnet` was found and deleted on 2026-09-30. **`/onboard` Step 3 went looking and found it** — all
  seven `executors.md` files name the installed file by path rather than defaulting past it. *Checked:*
  those seven files, plus `.claude/agents/` on disk and the manifest's ownership list.
- **`/onboard` re-run, reporting an executor someone wired in and leaving it alone** — §17's second check.
  `dynjandi-core`'s `executors.md` records three: 2026-09-30 against 0.22.0 (one answer changed, by the
  user's decision in that run), 2026-10-05 against 0.23.0 (*"The Coder and Reviewer answers are unchanged,
  and `.claude/agents/reviewer.agent.md` is still on disk"*, with two per-machine findings re-run rather
  than read off `--help`), and again the same day against 0.24.0. *Checked:* that file.
- **`/prototype` has run — seven mockup trees across three repositories**, and nothing else fired in its
  place. `prototypes/` holds: `bgmusik` (`bowie-raun`, `estate-forsida`, `front-page`, `front-page-cascade`),
  `baldurpan.com` (`site-core`, `night-sky-stars` — the latter opened as a feature's Phase 1 and retired at
  Phase 8) and `dynjandi-core` (`landing-page`, for #140). Each `NOTES.md` carries the skill's own shape:
  the throwaway warning, and the question the mockup exists to answer. *Checked:* the directories, their
  `NOTES.md` files, and `git log -- prototypes`.
- **`/release`.** `piff` PR **#193** `release/2026-10-09`, *"Release @piff/web 1.9.0"*, merged — and its
  `executors.md` records the `worktree branch release/<name> --source main --no-open --install` invocation
  the owner adopted for it on 2026-10-09, flag by flag, with why each is there. *Checked:* `gh pr list`,
  that file, and `context/release.md`.
- **The worktree answer, which this item called the largest untested surface.** Five repositories are on it
  — `piff` since **2026-09-13** (commit `0b79727`, *"Move to a worktree flow and put the backlog in GitHub
  issues"*), `dynjandi-core` since 2026-09-10, `dynjandi` since 2026-09-30, `snowsense` since 2026-10-01,
  `quotavero` since 2026-10-12. Worktrees besides the default are live right now — **7** in `snowsense`,
  **5** in `dynjandi-core`, **4** in `dynjandi`, **2** in `quotavero`, **1** in `piff` — and most are named
  for the issue they are working. *Checked:* `git worktree list` in all seven, `context/git.md`'s *Where
  work lands* section, and `git log -- context/git.md`.
- **`/feature-close` pushing and opening a pull request, in trees it made.** **200 pull requests across the
  five**, **152 carrying `Closes #<n>`** — the close mechanism `tracking.md` names. `snowsense` alone
  carries thirteen *"Retire <feature>: delete the feature's working notes"* commits between 2026-10-07 and
  2026-10-16. *Checked:* `gh pr list --state all` with the body matched against `Closes #`, and `git log`.

#### What is still unrun

- **The prose-trigger half of every skill, including `/prototype`'s.** This is the original item's sharpest
  question and **an install records nothing about it**: a skill that correctly stayed quiet leaves no file,
  no commit and no comment. Seven `prototypes/` trees prove `/prototype` fires when invoked; nothing
  anywhere shows what happened the next time somebody typed *"mock this up"*. Still a scratch repo and a
  deliberate attempt to trip each description both ways. *Checked:* looked for any such record across all
  seven repositories' `context/`, commits and issue comments, and found none — the absence is the finding.
- **`.agents/skills/` under the host that reads it.** Present in all seven, 9 to 11 skills each,
  byte-for-byte beside the Claude copies. **Nothing in any of the seven records a session under that
  host**: every recorded dispatch is the Claude Code `Agent` tool, every subagent is a `.claude/agents/`
  definition, and every skill trace is `.claude/skills/`. §1.2 proved the tree is discovered; that a skill
  in it fires on the right prompt and stays quiet on the wrong one is still unobserved, and that host has
  no `disable-model-invocation` equivalent, so the description text is the only thing holding the line.
  **Since §30 the same is true of `/roadmap` under Claude Code**, and so is the open question: whether it
  fires on its two cases and stays quiet on *what should we build next*, and whether §30.3's ask earns its
  interruption.
  *Checked:* `ls .agents/skills` in all seven, and every `context/` file, commit message and issue comment
  for a trace of one — all of it is Claude-Code-shaped, which is weaker than proof and is all there is.
- **The planner subagent answer.** `/feature-plan` offers to delegate research and the draft to one;
  **nothing in any of the seven records a planner dispatch**, while the reviewer's appears 28 times in
  `piff` alone. Where the prose mentions a planner it is the tool's own template text, not a run. *Checked:*
  grep for `planner` across all seven `context/` trees and all 116 feature issue bodies and ledger rows.
- **`/feature-status`'s file-path sweep across a tree it did not create.** The sweep resolves
  `<path>/context/plans/<NAME>-PLAN.md`, and **that path is only live under the working-tree answer** — the
  five repositories with second worktrees are all on the tracker, where step 2's sweep becomes one query on
  the assigned issues, and the two on the working-tree answer (`baldurpan.com`, `bgmusik`) have exactly one
  tree each. So the resolution has still never happened. *Checked:* `feature-status/tracker.md`'s
  translation table, `git worktree list`, and `context/plans/` in the two working-tree repos.
- **`/feature-implement` step 2's refusal to work a tree whose branch is not the feature's.** No ledger
  Note and no issue comment in 116 feature issues records it firing. *Checked:* grep over every comment on
  every feature issue in the five for a branch-mismatch stop.
- **`/orchestrate --pr`.** `piff`'s `executors.md` says it in those words: *"Read from the skill on
  2026-10-04 and not yet run."* *Checked:* that file; `dynjandi-core`'s equivalent section records a probe
  of the invocation, not a run of the command.
- **§20's and §21's checks cannot have run anywhere.** `feature-plan/split.md` landed in `a5e8a60` and the
  owner check at close in `b50ad14`, both on 2026-10-16 and both **after `v0.25.0`** — so no install has
  either file, and `.claude/skills/feature-plan/` in all seven holds `SKILL.md` and `tracker.md` only.
  Whether `/feature-plan` measures in step 5, opens `split.md`, and splits along the phase boundaries, and
  whether `/feature-close` reads §9 and files an owner check as a check, are unrun because unreleased.
  *Checked:* `git log` on those paths against `git tag`, and `ls` in all seven installs.
- **The per-skill `model:` handback after a command asks mid-run** (§17.5). Recorded from the host's
  documentation and unobservable from a repository.

#### One candidate item, found while checking: the ledger Note has become a log

§20 asks whether a Note stays one line over a dozen phases "or does the first interesting gate output go
back into the cell", and says there is **no backstop** — `check` has no rule here. It is already answered,
and the answer is the second one. **99 ledger Notes across the five tracker repositories run past 400
characters**: 47 in `piff`, 28 in `snowsense`, 22 in `dynjandi-core`, 2 in `dynjandi`, 0 in `quotavero`.
The longest is **3,440 characters** (`piff` #22 Phase 1), then 3,077 (`dynjandi-core` #99), 2,667 (`piff`
#22 again) and 2,186 (`piff` #6). They are not padding — they are gate output, deviation lists, corrected
decisions and test counts, which is exactly the content §20 predicted would land there. *Checked:* the
`Status ledger` section of every feature issue body in the five, measuring the last column of each row.
**Not fixed here.** Whether the answer is a `check` rule, a cap in the skill, or accepting that the cell is
where the evidence goes, is a design question for `DESIGN-RECORD.md`.

### 2. Licensing for the standards — closed by §25

The standards are no longer copied from `baldurpan/ai-engineering-standards`, which never had a licence
file. They are written in this package, and its MIT licence covers them. The README's caveat is gone.

### 3. Publish — done, and the pipeline is proven

v0.2.0 was published by hand, because a trusted publisher cannot be configured for a package that does
not exist yet. v0.3.0 then went out through CI end to end, and **since 0.13.2 the whole release is one
workflow and one event**: a push to `main` that moves the version in the package's manifest makes
`publish.yml` test, build, publish over OIDC with a provenance attestation, push the `vX.Y.Z` tag and write
the GitHub Release. **There is no npm token in this repository, and no release form.**

**The form went because automating it any other way could not work.** The obvious shape — one workflow cuts
the release, `publish.yml` goes on listening for `release: published` — is dead on arrival: *events
triggered by the `GITHUB_TOKEN` will not create a new workflow run*, exempting only `workflow_dispatch` and
`repository_dispatch`. The release would appear and nothing would publish, every step green. Cutting the
tag and the release inside the publishing job needs no second event, and therefore no PAT and no GitHub App
in a repository that has deliberately never held a secret. `tag-on-version-change.yml` is deleted; its diff
is the `version` job.

**Two pins to know about before editing that file.** npm's trusted publisher connection fixes the
repository, the workflow *filename* and the environment, and it cannot be edited — only deleted and
recreated. It does **not** pin the trigger, which is the only reason `on:` could move from
`release: published` to a push without touching npm. So `publish.yml` and `environment: release` are names
with a remote dependency, and the header comment says so.

**The prerelease path is still unexercised, but it is no longer a checkbox.** A version containing a hyphen
(`0.14.0-rc.1`) is what selects the `next` dist-tag and marks the release as a prerelease, so the signal
cannot disagree with the version it ships. The version diff, the notes assembly and the prerelease
detection were each run against this repository's real history before the file was committed; what has not
run is the publish half of that branch.

**And this repository now records notes the way the tool teaches.** `.changeset/` is here, generated by
calling this package's own `changesetConfig()` and `changesetReadme()` rather than retyping them — one
honest edit, `access: "public"`, which `release-init` cannot know about a repository it has just met.
`release-init` itself **refuses here**, correctly: it requires an ai-workflow install, and there is none.
Three scripts on the root manifest, `release-note.yml` asking the question on every push to `main`, and
`publish.yml` taking the release body from the CHANGELOG entry with the old commit-body convention as its
first fallback, so the releases that predate this still read correctly.

**This reverses a call made earlier the same day, and the reversal is the interesting part.** The argument
against was that every commit here is already a release, so an accumulate-then-consume mechanism has
nothing to do, and that the commit bodies are a better record than one-or-two-sentence notes. Both halves
are still true as *descriptions of how this repository used to work* — and that is what made the argument
weak: it defended the existing cadence rather than examining it. Notes are what make a different cadence
possible, which is the point of adopting them, and **the tool's own repository being the one place its
release answer was not used was a fact about inertia, not a design position.** What it costs is a note per
package change, and a commit that runs `changeset:prepare-release`; what it buys is the changelog this
repository has never had, and a release whose notes were written when the change was fresh.

**It is not the dogfood run item 1 wants, and must not be mistaken for it.** A human writes these notes;
`/feature-close` does not, because there is no skill tree here. What is now exercised on a real repository
rather than a fixture is the vendor config, the note format, the status check and the tag-and-release
record — the §11.11 half. The loop under a live agent is still unrun.

**Item 1 below was supposed to happen before this.** It did not. The live-agent run is now the
outstanding risk against a package other people can already install.

**The release body is capped at GitHub's 125,000 characters, as of 2026-09-23.** Not because this repository
is near it — its largest CHANGELOG entry to date is 610 characters and the whole file is 4,883 — but because
of *where* that failure lands. `gh release create` is the last step in `publish.yml`, so a rejected body
fails the job after npm publish and after the tag push, and `Run workflow`, which this pipeline documents as
the repair for a half-landed release, re-attempts the same oversized body and fails identically forever. The
only exits are editing a CHANGELOG that has already shipped, or cutting the release by hand.

The number is verified against a real failure rather than documentation: `northguild/gmt` run 35871279627,
`body is too long (maximum is 125000 characters)`, on a v1.16.0 entry of 137,782 characters, with the
packages already on npm. Over the cap the body is cut back to a line boundary and gains a pointer to
`CHANGELOG.md` at the tag; the step summary reports `changelog (truncated)` so a shortened page is never
silent. Tested against seven inputs including gmt's real entry, the exact boundary, and an empty body, which
still reaches `--generate-notes`.

**One bug found in writing it, worth keeping written down:** `process.stdout.write(big); process.exit(0)` in
the capping script truncated a 125,000-character body to exactly 65,536. stdout is a pipe in a command
substitution, the write is asynchronous, and `process.exit()` discards the buffer. The under-limit path was
the one affected — the path that is supposed to change nothing. The script now ends on its own instead, and
the same hazard applies to the extraction script above it, which is why neither calls `process.exit` after a
write.

`npm pack` produces a working 177.6 kB / 121-file tarball — verified again after §4.5 and §4.6 by installing it
into a clean repo and running `install`, `check` and `update --dry-run` against it, with the standards tree
landing 78 files and `standards/templates/.gitignore` restored from `_dot_gitignore`. Do that again after
any change to `templates/`. **After §17 it is 238 kB and 134 files**, verified the same way on 2026-09-30,
plus an upgrade from the 0.21.1 tarball: 40 files written, 17 of them new, every stub untouched, no gap
under **Next**, and `check` clean afterwards.

### 4. The offloaded executor — run in `piff`, and the one branch it never took

**An out-of-host coder ran real phases, and §1.1 was tested rather than assumed.** `piff` dispatched the
**Codex CLI** as its coder from 2026-09-06 until it was suspended on 2026-09-30 in favour of a Sonnet
subagent. Its `context/executors.md` keeps the whole invocation and says in those words: *"Verified
2026-09-06, for Codex. Codex was given a one-line brief citing `context/workflow.md` and asked for a
heading only obtainable by opening the file; it returned the correct heading."* That is `/onboard` Step 1
executed against a real external coder. Ledger rows name it as the coder on `piff` #99 Phases 3, 4, 5 and 6
and #118 Phase 1, and name the Codex-to-Opus handover on, among others, #84 Phase 2, #92 Phase 2, #118
Phase 2, #126 Phases 3 and 4, #134 Phase 3 and #138 Phases 2 and 3 — *"Codex hit its limit; Opus coder
finished"*.

**Step 1 has run twice, and the second one is the better-designed test.** `dynjandi-core`'s
`executors.md`, 2026-09-30: *"Brief: 'open `context/workflow.notes.md` and reply with the exact text of
line 186'. Nothing was inlined. It returned `## What happens to a defect the gate found` — exact, and from
a file that had arrived in the working tree that same day, so not answerable from anywhere but the file."*
That one is in-host, so it tests the step rather than the offload — but it is the step working, and it
closes the hole in the `piff` run, where a heading could in principle have been recalled.

**The loopback ran with it.** `piff` #99 Phase 4, commit `6970264`: *"Coder: Codex. Gate 1 green … Gate 2
PASS WITH NOTES after 1 loopback (stack.md deviation count)."* A reviewer's notes went back to an
out-of-host coder and the phase converged.

**`agy` was tested and it failed, for a reason §1.1 never predicted.** On 2026-09-14 Codex exhausted
mid-phase and `agy` could not take over: in print mode it auto-denies every write and command tool call,
and the only fixes are per-machine entries in `~/.gemini/settings.json` or a blanket bypass flag
`executors.md` forbids. *A fallback that needs the operator's global config edited before it can run is not
a fallback* — so it was replaced on 2026-09-15 by an Opus subagent, which needs nothing configured and
inherits the worktree. **The failure was about permissions, not about reading the repository**, so §1.1's
own question went unanswered for `agy` rather than answered badly.

**Step 1 also found the failure mode nobody wrote the test for.** Two exit-0-after-writing-nothing cases
are recorded in that file: a hardcoded `-m gpt-5.3-codex` that Codex rejected (*"not supported when using
Codex with a ChatGPT account"*) and still exited 0, and `codex exec` exiting 0 after hitting its ChatGPT
usage limit mid-run. Both are now *"grep the captured output for `You've hit your usage limit` and
`ERROR:`"*, because a partial run leaves files changed and `git status` alone looks healthy.

**What is still unrun:**

- **A `FAIL` verdict dispatched back to an out-of-host coder.** Every one of `piff`'s 18 `FAIL` rows that
  names a coder names an in-host subagent; the one Codex loopback was a `PASS WITH NOTES`, not a `FAIL`. So
  the specific path this item names — `FAIL` → written finding → loopback, out of host — is still only
  half-walked.
- **The branch where an executor needs content inline.** All seven `executors.md` carry the rule, five of
  them in the shipped wording: *"Briefs cite paths; they do not paste file contents. If an executor
  genuinely has no filesystem access, say so here — that is the one case where a brief has to carry content
  inline."* **No install declares that case**, so the branch has never been taken.
- **An out-of-host reviewer.** All seven name a Claude subagent, or the host reading its own diff, as the
  Gate 2 reviewer. `piff` records what that costs — *"it is in-host, and that costs the vendor separation
  Codex bought"* — and that since 0.22.0 the two are at least different tiers. A different vendor's
  reviewer has not run since Codex was suspended as the coder, and never ran as the reviewer.
- **`agy` against §1.1.** Still open, for the reason above.

*Checked:* `context/executors.md` in all seven repositories; `piff`'s 61 feature issue bodies, grepped for
`Codex`, `agy`, `FAIL` and `loopback` in the ledger rows; and `git log -- context/executors.md`.

### 5. The tracker answer (§10) — rebuilt in 0.10.0, and running in five repositories since 2026-09-10

`context/tracking.md` ships as the fifth project-owned stub, with **in the working tree** as the first
answer, so every existing install behaves exactly as before. The second answer puts the three tiers in
GitHub issues: a feature is an issue, its plan is that issue's body, a closed issue is the archive.

**0.10.0 removed the sub-issues** (§10.10). The deadlock above is the reason it had to; the rest of the
argument is that the only repair — letting an agent close the sub-issue by hand — deletes the property
that made a sub-issue better than a table row in the first place, since *the closing write rides the same
change as the work* was the whole of it. What went with them: N+1 remote writes per plan, the reconciliation
apparatus that guarded the window between the body and its sub-issues, a ledger with two shapes, and
`workflow:blocked`, whose only job was expressing a state open-and-closed cannot. One label remains.

What landed, across 0.8.0 to 0.10.0:

- **The stub** — the answer and its parameters only. The primitive map is the single place any tracker's
  vocabulary appears; the claim protocol and the heartbeat live in the skills, because a project-owned file
  is unreachable by `update` and a mechanism has to stay repairable (§10.8).
- **`/onboard` Step 5**, which states the git-and-GitHub-remote precondition inside the question, collects
  the label and the project's issue types, and offers to remove the five stubs the answer makes dead —
  **only where they are empty**, since a non-empty one is the frozen record of the era before the switch.
- **`/tracking-migrate`** (§10.9), which carries an existing backlog onto the answer Step 5 wrote. 0.8.0
  shipped the answer with no way to move the data and no refusal to stop it, so the second real install
  ended with a full tree and a tracker every command read as empty.
- **Five skills**, each with an *Under the tracker answer* section in `git.md`'s "under the worktree
  answer" shape, so the default answer's prose is untouched. Since 0.10.0 most of those sections say
  *unchanged*: the ledger is the same table under both answers, which was the point.
- **The issue's type** (§10.11), set by `/roadmap` and corrected by `/feature-plan`, read by nothing. And
  **`Priority:`** (§10.12), read by `/feature-plan`'s ranking above every other key, because an issues list
  has no manual order and *backlog order* was the tiebreak the tracker answer had silently lost.
- **The body's ceiling** (§10.13). An issue body holds 65,536 characters and a plan document holds
  anything, and the tempting reading is that this is the tracker answer's weakness. It is the opposite: a
  plan that overflows a body is a feature that is several features, which is already true under the
  working-tree answer and which nothing there ever says. `/feature-plan` measures before its one write,
  leaving room for the rows written into the body later, and **splits the feature along its phase
  boundaries rather than trimming, spilling into comments, or linking out.** `/tracking-migrate` refuses
  instead of guessing at a split; `/feature-implement` shortens its own Note and lands the row regardless,
  because the Status column is the phase's only home.
- **`check` skips what is absent**, which cost one condition: every other rule already degrades to nothing
  when what it parses is missing. `trackingAnswer()` reads which answer survived in the stub — a shape
  read, not a workflow question.
- **Tests**, including the one that matters most: **no skill may name a forge command**, which is what
  keeps a second tracker a rewrite of one file rather than of eight. 0.10.0 adds its sibling — **no skill
  may name an issue type** — as the closest mechanical proxy for §10.11's real rule, that nothing in the
  loop may branch on one. `/onboard` is exempt from both for the same reason: it collects answers, it does
  not read them.

**The first live report arrived, and it was not about a mechanism.** Somebody running `/roadmap` and
`/feature-plan` against real issues asked for the one thing §10 never gave them — **`blocked by` between
features** (§10.14) — and had been supplying it by hand every time. Nothing here was broken; order between
features simply had no home, under either answer, and the tracker had the primitive sitting unused. That
is now built: `/roadmap` records the order the user's own wording names, `/feature-plan` corrects it with
research and records its split's own edges, and `/feature-implement` and `/feature-status` read it and
never write it.

**A second report has since arrived, and it is the same shape** — see item 8 and §10.15. *Has a plan* is
observable, stored nowhere and incapable of drift, and it was invisible to a person scanning the issues
list, because §10.10 removed the one primitive GitHub rendered and priced the loss against the agent as
reader. **That one was built and shipped** — the `workflow:planned` label, in 0.21.1 — and it is in use:
**63 of the five repositories' 116 `workflow:feature` issues carry it** (18 of 19 in `snowsense`, 28 in
`piff`, 10 in `dynjandi-core`, 4 in `dynjandi`, 3 in `quotavero`), and `dynjandi-core`'s `tracking.md`
records `/onboard` creating it on 2026-09-28 *"when workflow 0.21.1 added it"*. **Item 8 still says neither
half has been run by a live agent, and that half of it is no longer true.** Left as it stands — this pass
covers items 1, 4 and 5 — but it is the same stale claim, in the same file, and it is owed the same rewrite.

#### The four mechanisms have run, in five repositories

0.10.0 was what one careful read of the prose found. The repositories are what running it found, and all
four of the things this item listed as *not known to have executed* have executed.

- **The phase-boundary heartbeat.** **84 feature issues across the five carry it**, with **308 comment
  lines announcing a phase opening and 273 announcing one closing** — often in the same comment, which is
  the shape the skill's *two lines is enough* produces: *"Phase 1 closed `done` in 6f360cc. Phase 2 (Move
  release.yml to changesets/action v2) opening."* (`snowsense` #35). It carries the commit sha, and it
  carries a `blocked` close three times, with the full finding in the comment and a later *"Phase 3 resumed
  from blocked"* (`snowsense` #35 again). *Checked:* every comment on every feature issue in the five.
- **The body read-modify-write.** This is the mechanism the 40 four-or-more-phase ledgers in item 1 are
  made of: each `done` row is a separate remote edit of a body that also holds the plan. Nothing in the
  five shows a clobbered plan — bodies carry full plans with §1 through §9 intact beside completed
  ledgers, up to eight rows (`snowsense` #57). *Checked:* the `Status ledger` section and the surrounding
  plan sections of all 116 feature issue bodies.
- **Optimistic claiming — the assign half.** **85 of the 116 feature issues are assigned**, and **none has
  more than one assignee**. *Checked:* `gh issue list --json assignees` in the five.
- **`/tracking-migrate`.** `piff`'s `tracking.md` names the skill by path and records the run: *"The
  migration ran on 2026-09-13, and the tree is empty"* — nine `roadmap.md` entries into issues #1 to #9,
  each body carrying the entry's lines, its `Size:`, a `Priority:` rank and its document in full, all nine
  open and unassigned because no entry was `active`. `snowsense`'s records a second run on 2026-10-01: four
  entries into #1 to #4, two `drafts/` documents folded into the bodies of #2 and #4 under *Reference
  material*, `roadmap.md` and `drafts/` then removed, landed as commit `ece1738` — which describes the
  migration but does not name the command, so that one is the shape rather than a citation. `dynjandi` and
  `quotavero` record the third state the skill has to handle: *set with nothing to migrate*. *Checked:*
  `context/tracking.md` and `git log` in the five.
- **And `blocked by`, §10.14's answer, is in use.** `piff` #45 waits on #34, #174 on #173, and #100 on #31
  and #99 — real relationships, readable from both ends. *Checked:* `gh api
  repos/baldurpan/piff/issues/<n>/dependencies/blocked_by`.

**What is still unrun under this answer:**

- **Claiming's contention branch, and it may be unreachable as written.** *Assign, re-read, confirm you are
  the sole assignee, and back off if you are not* — **every assignment in all five repositories is to the
  same GitHub account**, so the re-read always confirms the agent's own login and *"an issue that already
  has a different assignee is held"* can never fire. Two agents on one feature would both see themselves as
  the sole assignee and both proceed, which is precisely the state the protocol exists to prevent, and
  precisely the state *"a feature has exactly one writer"* rests on. **Candidate item, not fixed here:**
  either the claim needs a per-agent identity the assignee cannot carry, or the protocol needs to treat
  *already assigned* as held regardless of who holds it, and the second reading breaks a legitimate
  resume. §10 should say which. *Checked:* the assignee of all 116 feature issues, and every issue comment
  in the five for a recorded back-off or a named holder — there is none.
- **A clobbered body, and so the hazard's actual cost.** **303 ledger rows have reached `done`** across
  the five, each one a separate edit of a body that also holds the plan, and every one of them opened its
  row first — so the sequence has run several hundred times with no visible loss. That is evidence it is
  followed, not evidence the window is narrow.
- **A body that overflowed its 65,536-character ceiling** (§10.13), and so `/feature-implement`'s
  *shorten your own Note until the row fits* and `/tracking-migrate`'s refusal to guess at a split. The
  largest body in the five is **`piff` #6 at 56,445 characters** — 86% of the ceiling — then `piff` #22 at
  55,622, `quotavero` #2 at 41,986 and `snowsense` #57 at 40,903. Near, and not over. **§20's own
  measurement, recorded above, found six plans past the ceiling across four installs on the same day**, so
  the overflow is real in the field; what is unrun is a tracker-side response to it, and §20's `split.md`
  is unreleased, so the measurement has no home in any install yet.
- **A stale claim found and reported** — an assignee left behind by an agent that died. The heartbeat is
  what makes it visible and nothing in the five records one being found.

**One more candidate item, found while checking.** `piff` #45 is open and still carries a body line
*"Blocked by #34 `sponsorship-ledger` — the per-season amounts this weighting reads do not exist until it
lands"*, beside the real relationship, and **#34 closed on 2026-09-17**, so the line is now false.
`tracking.md` already flags it (*"**#45 carries such a line beside its real relationship** (seen
2026-09-30, its blocker #34 already closed) — a person's to remove, not a command's"*), and it is still
there on 2026-10-16. The rule *never a body line and never a comment* is the right one; it has no
enforcement, and this is the drift it predicted, sitting in the field for a month. Nothing to fix in the
package unless the answer is that `/feature-status` should report it.

**The `AGENTS.md` block hit its ceiling and the ceiling turned out to be the wrong shape.** It was a flat
`< 40` lines; a ninth command made it 40. Neither of the two options this file named was right — the
ceiling is now a budget on the *prose*, `lines - SKILL_NAMES.length < 32`, which is byte-identical to what
the prose was allowed at eight commands. A flat count made the block's one legitimate growth — a row per
command, which is the entire reason it inlines the table — indistinguishable from the failure it guards.

### 6. The release answer — both phases are built

`context/release.md` is the **sixth project-owned stub** and the one whose answer can be *false*:
*no lint step* is accurate in a project with no linter, but *"a change is announced by writing a note"* is
a lie in a repository where nothing records one — the same defect as a `done` row whose **Files:** do not
exist. The whole design, and the enumeration that produced it, is **§11**. Read that rather than this.

**Phase A landed, and it is entirely inert.** The shipped answer is *nothing here announces a change*, true
of every repository, so no existing install behaves differently until someone runs `/onboard`:

- **`templates/stubs/release.md`**, registered in `STUBS` with `onboard: true` — four answers: the per-path
  table, what records a note, the granularity, and a *what this project does not do here* section naming
  bump, tag, publish and deploy. `install`'s **Next** line is now derived from `STUBS` rather than retyped,
  which is how it had already gone one stub stale.
- **`/onboard` Step 9**, after Stack. It looks first and reports all four sweeps including the empty ones,
  asks per path, and **refuses**: where nothing on disk records a note it writes the true answer, names
  what is missing, and stops. It installs nothing and it will not generate a release job.
- **`/feature-implement` step 7** under *per phase* — the note's path goes on the **Files:** line, so step
  11 already refuses `done` on a phase whose note has not landed, for free.
- **`/feature-close`** — writes the note under *once per feature*, **reads** the phases' notes under *per
  phase*, and confirms the bump levels either way. `--dropped` writes none and removes none.
- **`/orchestrate`** — the cell granularity leaves empty: the change is the unit.
- `stack.md`, `reviewer.agent.md`, `workflow.md`, `context/README.md`, the `AGENTS.md` block's `/onboard`
  row, and both READMEs.
- **Seventeen tests**, including the sibling of the forge rule: **no template may name a release tool**,
  with no `/onboard` exemption needed — its detection describes the shapes ("a notes directory", "an
  `## Unreleased` heading") rather than the tools that produce them.

**Two findings from the enumeration are worth knowing without opening §11.** The bump level is a judgment,
so it is asked — and putting the ask in `/feature-implement` would have fired it between phases, which is
exactly what `--all` exists to prevent. Moving it to *where the note leaves the machine* keeps `--all`'s
stop list untouched. And three of the grid's six axes turned out **inert**: `tracking.md`'s answer and
`git.md`'s who-commits change nothing here, because a note is an artifact of the change rather than
workflow state. `release.md` is the first stub in this shape with no *Under the tracker answer* section,
and it says so, since every sibling has one.

**Phase B landed as `release-init`, a CLI subcommand — not a skill, and not a migration.** The ask that
produced it was *"another command for migrating? `/changeset-migrate`?"*, and both halves of that were
wrong. `/tracking-migrate`'s shape does not transfer: it moves existing data to a substrate that already
exists and was already chosen, and the release case has neither — a repository with no mechanism has no
notes to move, and the destination does not exist until something installs it. That is a setup. And a skill
named after a JavaScript tool is inherited by every install, including the Go and Python ones, where it is
nonsense — its own `name:` line would have failed the no-release-tool test, so shipping it meant deleting
the test to make room for the thing the test exists to prevent.

So the vendor lives in `src/`, which is the boundary the rule already drew: §11.7 is a rule about
`templates/`, because template prose is what every install inherits. A subcommand is a program someone
chooses to run, and it refuses where it does not apply. **§11.9 holds the decision; §11.8's mechanics are
what it implements**, and all of them are now exercised against the real tool rather than read from its
docs — a private app bumped `0.1.0 → 0.2.0` with `version: true` and its note went unconsumed forever with
`version: false`, which is the trap, reproduced.

What it does: writes `.changeset/` (config and a README pointing at `context/release.md`), adds the
devDependency, and adds `changeset:add`, `changeset:prepare-release` and `changeset:status` — **vendor-neutral script
names, because the script name is the seam `release.md` records.** What it refuses: no install, no
`package.json`, a mechanism already on disk, a script name already taken — all of them reported in one
pass. What it will not guess: whether a private package here is deployed. It asks on a terminal and refuses
without one, naming `--private-packages`.

**It does not write `context/release.md`.** One writer per file — `/onboard` Step 9 keeps the answer, and
now names the command in the gap it reports. Step 9 still installs nothing, and still generates no release
job: **naming an installer is not running one.**

**The dogfood question is untouched by this**, and B being exercised does not close it. What was verified
is the vendor's behaviour on a fixture repository, not the workflow running on itself.

**0.13.1 is the half both phases were missing: the event.** The ask was that opting into notes must not be an
npm-publishing feature — an app that goes live has to work the same way, and only on the merge of a pull
request where `changeset:prepare-release` was called. **§11.2 had already written the uniform half and then
spent it entirely on publishing**: a deploy appeared four times in §11 and never once as an event, so the
file's last section was *what this project does not do here* — bump, tag, publish, deploy, four unwired gaps
under a heading that was a disclaimer. Someone with a deployed app learned that the workflow would not deploy
it, and never learned what would.

**That section is deleted, not extended.** Its four lines survive as *what the event is wired to* inside
`## What a release ships, and on what event`, which ships as *nothing here ships on a merge* — true of every
repository, like the first answer in the file — and answers **per path** what the release merge does: publish
it, deploy it, or nothing. **The condition is that path's own version moving in that merge**, never *a release
happened*, because a release that bumped only the package must not deploy the app. That promotes §11.8's
drag-along warning into the rule's own exception: where a major pulls a dependent in with a patch, the app's
version really did move, and the deploy is right to fire.

Three things fell out of writing it, and the first is the one worth keeping:

- **Adding an answer re-runs the grid; it does not extend it.** *Per phase* justified itself with *"a deployed
  app, where each phase reaches users on its own"* — which the event contradicts outright, since a landed
  phase has shipped nothing either. The value survives, but what it claims is about **changelog entries**.
  Nothing lexical could have found that; re-reading one answer against another did.
- **Landing a change is not shipping it**, now a rule in the stub, in `workflow.md` and in the two commands
  that finish work. `done` plus a closed feature reads as *live*, and nothing had said otherwise.
- **A gate script was considered and rejected.** The obvious fourth script answers *is this a release commit*,
  and it cannot be written without a CI fact: comparing this commit's versions against its parent's needs
  more than the one commit a default checkout has. It would ship wrong or with a `fetch-depth` baked in — a
  generated workflow in everything but name, at exactly the boundary §11.2 draws. **§11.2's refusal narrows
  to the job, not the event**: the event belongs in the file, the credentials do not, and the publish and the
  deploy are one gap rather than two.

`/onboard` Step 9 collects it, reports **a deploy wired to every merge of the base branch** as the defect it
is — it ships whatever notes are pending, other people's included — and still rewires nothing and generates
no job. Existing installs hear about it the only way a project-owned file can be reached: the renamed section
is a gap `update` reports under **Next**. Eleven new tests; 202 in all.

**0.13.2 adds the record (§11.11), and it is item 1 arriving on its own.** `piff` ran the mechanism and the
tags page stayed empty; the write-up is in §11.11 and the two cells it adds are worth more than the fix.
**C15 — a true answer can be the wrong answer, and no gate looks at those.** Everything §11 built checks the
file against the repository; nothing checks the repository against what the user wanted, which is why a
default the user never sees gets laundered by the answer file into a decision they appear to have made. The
`version` half was asked out loud for exactly this reason and `tag` rode along underneath it. **C16 — the
sweep read the tree and never the tags**, which is a one-command answer and the only place this is visible.
One cost taken deliberately: `stubGaps` is heading-level, so an install already on 0.13.1's shape hears
nothing — giving the record its own heading would trip the detector and split the one answer that has to
stay whole. Four new tests; 206 in all.

**The dogfood question is unchanged, and it is item 1's wearing different clothes.** This repository
manages the workflow and does not use it: no `context/`, no skill trees, and `PLAN.md` is hand-maintained
rather than a document under `plans/`. `northguild/gmt` has its own bespoke `context/` and six unrelated
skills, so it is not an install either. **There is nowhere the workflow actually lives**, which is the real
reason item 1 has gone unrun across three releases — the run has to begin by standing up a repository for
the purpose. Two ways out, neither taken here: accept that this ships unrun and lean on the enumeration,
which is what was in place when 0.8.0 and 0.9.0 shipped broken; or give the workflow a home — self-hosting
here, which `PLAN.md` and `DESIGN-RECORD.md` doing a different job than a backlog argues against, or
installing into gmt, where `/onboard`'s adopt path would have to reconcile an existing tree and six skills,
which is the least-tested surface in the package.

---

### 7. Release notes here, and the two halves of §11 this repository does not run

**A gap in the template found by installing half of it here: the event assumes a pull request.**
`templates/stubs/release.md` and `/onboard` Step 9 both write the event as *the merge of the release pull
request*, and this repository does not use pull requests — work lands directly on `main`. The event is
unchanged in substance (the version moved) but the prose names a ceremony that is per repository, and
`git.md` already holds the answer about whether work is pushed or goes through a pull request. The release
answer does not consult it. Small, and not fixed: the wording here was adjusted by hand, which is exactly
the sort of local patch the stub exists to prevent.

`.changeset/` landed on 2026-09-14 (see item 3). What is worth checking after a few releases, because
neither is knowable yet:

- **Whether the notes are better than the commit bodies were.** The bet is that a changelog assembled from
  notes written at the time beats a release page quoting one commit. If the notes turn out to be thin
  restatements of the subject line, the mechanism is costing a step and buying nothing — reverse it, and
  say so here.
- **Whether a standing red run gets ignored.** `release-note.yml` compares `main` against the last release
  tag, so a package change landed without a note leaves it red until somebody writes one. That is the
  honest signal and it is also the shape people learn to tune out. If it sits red for a week, it is not
  doing its job and should go.

---

### 8. The backlog is legible from the issues list — built, and unrun like the rest of §10

**Reported from a real install, and nothing was broken.** Scanning
`github.com/OWNER/REPO/issues?q=label:workflow:feature`, a person could not tell which entries had plans
and which were still ideas. *Has a plan* is *the issue body holds a phase ledger* — observable, stored
nowhere, incapable of drift, and rendered by nothing on the page.

**Shipped: one label, `workflow:planned`.** `/onboard` creates it, `/feature-plan` applies it beside the
body write, `/tracking-migrate` applies it to a feature that arrives already planned, `/roadmap` refuses it
under both its modes, `/feature-status` reports a disagreement and never resolves one, and **nothing reads
it.** That last clause is the whole of why it is a second view rather than a second answer, and it is the
standing §10.11 already gives the issue's type. Three states now read off the row: one chip is an idea, two
is planned, two and an assignee is being worked. Six new invariants in `templates.test.ts` hold the line,
including that no skill may spell the label's literal name — `/onboard` excepted, since it collects it.

**`check` does not reconcile the label, and cannot.** It reads files under `context/` and makes no network
call, so a label on a remote issue is outside everything it can see. `/feature-status` is the only home.

**The write-up was wrong first time, and checking is what caught it** (§10.15's *Verified, not read*). It
had §10.4's refusal of this label going stale in 0.10.0 — sound while *has a plan* meant sub-issues, which
GitHub was taken to render on the parent row. **It does not, and nothing sourceable says it ever did:**
sub-issue progress is on the issue's own page, in `gh issue view`, and in an opt-in Projects field. The
list's row fragment carries no sub-issue field at all. So the backlog was never legible there under either
design, the refusal never rested on that ground, and what it actually rested on was drift alone — which is
answered the way §10.10 answered the same hazard for the ledger's closing row: make the disagreement
checkable and stop on it.

**Also shipped: `/roadmap`'s no-argument print, which was broken under the tracker answer.** Three of its
four steps named the working tree's `pending`/`active` marker, its **Doc** field and `active` itself, and
the translation table remapped step 1 and repaired none of the rest — so step 3, *"say which entries have a
plan and which do not"*, survived as an instruction with no stated mechanism under the answer where
satisfying it is hardest. It now has its own shape: **grouped by tier**, one line an entry with `Size:`,
`Priority:` and `waits on #N`, empty groups printed with `(0)`, and the whole thing derived from one
listing per run. Two lines hold it in place and both were easy to cross. **A plan is the ledger's
presence and nothing past it** — the body is already open, so the Status column is one glance away, and
*where does it stand* stays `/feature-status`'s question. **And the tier comes off the body, never off the
label** — a report that read the rendering while holding the original would go wrong precisely when the
two had drifted, which is the case the label was allowed to exist on condition of nobody depending on.

**Neither half has been run by a live agent**, which puts this in exactly the state item 5 describes for
everything else under §10: it is what a careful read found, not what running it found. The label's one new
hazard is the window between the body write and the label write, and the print's is the pull towards
reporting phase status from a body it already holds. **Fold both into item 1's run** — the same scratch
repo, the same two features, and the check is whether the issues list reads correctly at a glance
afterwards.

**Worth saying plainly: two field reports about the tracker answer, and neither was a bug.** §10.14's was a
fact with no home; this one was a fact with a home nobody could see. Both are what running the thing finds
and reading it does not, which is item 1's whole argument.

### 9. The SSRF section — in the bundled tree, closed by §25

`security/api-security.md` now carries the SSRF section that §13.4's trigger points at. It was brought
over from the retired upstream rather than re-vendored, along with three `tooling/dates.md` routing rows
the copy had been missing. There is no upstream to re-vendor from any more: edit `templates/standards/`
directly.

### 10. Two deferrals from the prose budget, each with a trigger rather than a date

§24.10 decided both, and neither is work to pick up unprompted:

- **`saysIn` — convert a sentence pin to section-scoped terms when one actually blocks a cut.** The pins
  hold about a kilobyte of `workflow.md` (§24.6 counts 508 literal characters across the nine sentence
  pins there), so the trigger is a real one: a rule that should be said in fewer words and a test that
  fails only because of the wording. §24.6 has the helper and a worked conversion. The move §24.9 made
  needed none of it — six tests simply read the file the prose moved to.
- **One name per invariant — the rename pass over about 27 `describe` strings.** Skipped. The trigger is
  wanting the agreement test between `INVARIANTS.md` and `test/templates.test.ts`, which cannot pass until
  the names agree. Until then that document says the pairing is maintained by hand and not checked, which
  is true and is the honest version of the claim.

**The always-loaded ceiling has 45 bytes of headroom** — `agents-block.md` plus `context/workflow.md` is
28,627 against a limit of 28,672, and it is the only number every invocation of every command pays. §26
spent 445 of the 491 that were free, on the worktree exception and *one run is one round*. **So the next
standing rule added to `workflow.md` needs a cut first**, or a raise typed into `templates.budget.json`
with a `why` naming the section that justifies it. That is the budget working as
intended rather than a problem to report: §24.2 is what happened the last time nothing held the line.

---

## Decisions that are cheap to reverse now

Five places the design left the call open and the build had to make one.

| Decision | Why | To reverse |
|---|---|---|
| `update` reconciles adapters to **what the running version ships**, not to what the manifest recorded — so a v0.1 install silently gains `.agents/skills/` | It is the only way an existing install ever reaches a new tree, and the alternative is a flag nobody knows to pass. The eight files are reported as `add`, visible under `--dry-run`, and a directory the tool did not write is still a conflict rather than an adoption | `const adapters = DEFAULT_ADAPTERS` → `manifest.adapters` in `src/commands/update.ts`, plus a way to opt in |
| An edited `context/standards/` file hands over **the whole tree**, not that file | §6.2 says a hash mismatch is a conflict; §4.1 says standards are ours only "while unmodified". The tree is an interface — the README's conditional table and the files it names have to agree, so a half-managed tree is one where an update replaces a file the user's own table no longer points at | the tree-level branch in `src/commands/update.ts` |
| An upgraded install **never gets `context/git.md`**, and never gains a section a newer stub added — `update` reports both and writes neither | Stubs are project-owned; a pass that writes missing ones is a pass that can overwrite a file someone deleted on purpose. Instead the absence is a defined state, and `update` ends by naming each gap under **Next** and pointing at `/onboard` (§6.2) — the boundary holds, and it is no longer silent | a stub-restore pass in `src/commands/update.ts` that writes only stubs whose destination does not exist, reported as `add` |
| Subagents pin **`model: opus`**, and the Claude copy of every skill carries a `model` and `effort` | Reversed from `inherit` on 2026-09-30 (§17.5). A command's own orchestration is bookkeeping and runs on `sonnet`; the planner and the reviewer are where the judgment lives. Aliases rather than dated ids, so they resolve to whatever the account has — which still assumes those two tiers exist, and they are the two every plan has | `CLAUDE_SKILL_SETTINGS` in `src/layout.ts`, and one line in each `templates/claude/agents/*.agent.md`. Pinning differently after install is a conflict on the next `update` — which is the correct signal |

---

## Findings from the build — worth not re-learning

- **npm silently refuses to publish a file named `.gitignore`.** The vendored standards carry one, so the
  package would have shipped 77 of upstream's 78 files while `standards/.source` claimed a ref the
  installed tree did not match. It now ships as `templates/_dot_gitignore` and the dot is restored at
  write time. **Anything vendored in future needs the same check** — `npm pack --dry-run` against the
  source tree, not a file count.
- **Importing the CLI module executed it.** A test that imported `parseArgs` ran the installer into this
  repo. The entry point is split: `src/cli.ts` exports, `src/bin.ts` runs. Keep that split.
- **The stubs' commented-out examples parsed as real content.** `check` strips HTML comments so it was
  never fooled, but an agent or a one-off script would be. Examples now sit in blockquotes above the
  `---`, outside the sections anything scans, and tests assert the stubs parse to zero entries and zero
  history rows.
- **The host question dissolved instead of shipping.** §3.9 step 1 was "which host?", deferred from v1.
  Once both trees install unconditionally there is nothing to ask and nothing to branch on — a deferred
  question that turned out to have no answer worth collecting. Worth checking for on any other deferral:
  the cheap resolution is sometimes deletion.
- **A ban is only real if a test enforces it.** "Do not hardcode the reviewer invocation" is the kind of
  rule that survives exactly as long as the person who wrote it. It is now a test: no template may name a
  coding-agent CLI, with `CLAUDE.md` and `.claude/` exempted as paths this tool writes rather than
  commands it runs. It passed on the first run, which means v1 had already been living by it.
- **Two links were correct at their destination rather than their source** — `plan-template.md`'s
  `../roadmap.md` (correct once copied into `plans/`) and `/feature-close`'s archived-header example
  (correct once written into `archive/`). The link test knows about the first; the second is now a fenced
  block, which reads better as "write this" anyway.
