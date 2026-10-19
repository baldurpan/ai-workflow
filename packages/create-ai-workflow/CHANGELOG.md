# @baldurpan/create-ai-workflow

## 0.27.0

### Minor Changes

- 9119e14: `/orchestrate --pr` no longer ends at the pull request: it applies the label `git.md`'s new *What a pull
  request carries* answer names, then runs up to three rounds of reading the open review threads, fixing what
  they ask for through the same two gates, pushing, replying, and resolving only the threads whose fix landed.
  Nothing merges, approves or waits for a check run, and a review comment cannot widen the scope or lift a
  refusal. `/onboard` asks for the label where a pull request is in the push answer; installs that answer
  nothing keep today's behaviour with no label applied.

## 0.26.0

### Minor Changes

- 6f5192a: The workflow now says where an expected value comes from: a change with behaviour at a seam is worked
  test-first in thin slices, each expected value is decided from the requirement or a source independent of
  the implementation before the code runs, a plan's §8 names what decides every value the feature computes,
  and the reviewer treats an untraceable expected value — or a rule the code implements that no test asserts
  — as a finding even on a green suite. `/onboard` also offers a Gate 1 section that fails on a skipped,
  focused or expected-to-fail test.
- b50ad14: `/orchestrate` no longer tells a review to put a non-blocking observation in the feature backlog. Its step
  4 now routes one by kind, the way `/feature-implement` already did — a bug goes wherever the project files
  bugs, a feature is named for `/roadmap` to admit, and anything else stays in the run's report — which is
  what the rest of that skill and `context/workflow.md` have said since 0.12.0.
- b50ad14: `/feature-close` now goes through the plan's §9 Open questions, and the ledger's Note column, before it
  writes anything: every item that still needs a person is answered, filed wherever this project already
  files bugs, or waived by the user in that turn — so a feature no longer retires `shipped` with a human
  check archived into a document no command reads again. The history row's Outcome is unchanged and its Why
  names the issue that carries the check, and a phase now answers in place whatever open question it settles.
- a5e8a60: Plans now have a size budget, in `context/tracking.md`, and it applies whether the backlog lives in the
  working tree or in an issue tracker — `/feature-plan` measures before it writes and proposes a split along
  phase boundaries instead of trimming, and `check` reports an oversized plan as a note that fails nothing, holding the reserve only for the
  rows still to be written and saying so when it had to measure against the shipped numbers.
  A ledger Note is now one line, with measurements and gate output going to the commit message or the run
  report, and every phase carries a `Decisions:` line so the coder and the reviewer are briefed with the
  phase's own section rather than the whole plan.
- 6fbe00b: The owner-check contract moved out of `context/workflow.md` into `/feature-close`, the only command that
  reads a plan's §9 after activation, leaving the standing rule and a pointer — every command's read falls
  by 3,513 bytes. The package README now opens with a quickstart and links its *what makes it different*
  section out to `INVARIANTS.md`.
- 2cc7ff3: `/feature-implement` now runs independent phases of one plan side by side — up to three, each with its own
  coder in a detached scratch checkout under `.phase-trees/` that it makes and removes itself, landing in
  phase order as one commit per phase. It decides this per round with no flag to type, and falls back to one
  phase at a time wherever an answer forbids a round or the host will not let a coder write in such a tree,
  naming what decided it. A tree is removed only once its phase's row reads `done`, so a phase that blocked
  or stopped short keeps its work for the next run, which lands it rather than re-running a coder.
  `context/executors.md` gains the cap (`1` turns it off) and `context/verify.md` gains a **Prepare a fresh
  tree** section — until `/onboard` fills that in, phases keep running one at a time. `/onboard` also adds
  `.phase-trees/` to your `.gitignore` and proves your own lint and test commands skip it, since a round is
  only safe where they do; no round forms while that entry is missing.
- e0c3743: The surface question in `context/workflow.md` now names a URL the server will fetch as a trust boundary,
  alongside input, authentication, a secret and a public endpoint — so a change that adds a server-side
  fetch reaches the security standards instead of passing as ordinary plumbing.
- 4c4b00f: The standards in `context/standards/` are now maintained in this package and covered by its MIT licence,
  instead of being copied from a separate repository. They gain an SSRF section in `api-security.md`, and the
  loading table now sends validation, forms and any `Date` work to `tooling/dates.md`. `update` removes the
  old `context/standards/.source` marker.

### Patch Changes

- The reviewer subagent's description no longer promises "a verdict with severities" — the review returns one
  bit per item, blocking or not, which is what its own body and `context/workflow.md` have always said and
  what the host shows when it picks a subagent. The package's own `npm run check` now typechecks its scripts
  and tests as well as `src/`, which changes nothing about an install.

## 0.25.0

### Minor Changes

- The bundled standards gain `tooling/i18n.md` — prefer Lingui, except where the framework owns locale
  routing — and `tooling/dates.md` now bans the `Date` object outright, naming the `@northguild/gmt` lint
  package that enforces it for ESLint, oxlint or Biome. Six other standards contradicted that ban with
  `z.coerce.date()` or `Date` as a type; a date field now validates with `z.iso.date()` and stays an ISO
  8601 string throughout.

## 0.24.0

### Minor Changes

- Adds `/release`: it makes the release branch `context/executors.md` names, runs the script
  `context/release.md`'s *Bump* wire names — once, and after Gate 1, because it cannot be run twice — and
  ends at a pull request for you to approve. `/feature-close --release` is unchanged and still fuses a
  release into a feature's own merge; reach for `/release` when the notes have been accumulating.

## 0.23.0

### Minor Changes

- `/orchestrate` gains a `--pr` flag that ends the run at a pull request instead of in the working tree: one
  commit, the current branch pushed, and the work opened for a person to read. The flag itself is the
  permission, so no `git.md` answer changes and nothing it does carries over to the next invocation — and it
  creates no branch of its own, stops rather than pushing the default branch, and never merges.

## 0.22.0

### Minor Changes

- Every command now reads less before it starts: the tracker-answer half of five skills, each stub's setup
  guidance and `workflow.md`'s reasoning have moved into files that are read only when they apply, and a plan
  names per phase the standards files the coder and the reviewer load instead of the whole table. `update`
  brings the new files in and leaves your stubs untouched.
- The shipped executor answers now prefer a subagent where the runtime has one — the coder on `sonnet`, with
  the tier written in `executors.md` — and fall back to in-host and self-review where it does not; the Claude
  Code copy of each skill carries a `model` and `effort`, and the planner and reviewer subagents run on
  `opus`. Existing installs keep whatever their `executors.md` already says, and a re-run of `/onboard` no
  longer re-asks an answer that is not the shipped one.

## 0.21.1

### Patch Changes

- `/prototype` no longer leaves the invented half of a mockup unguided: where there is genuinely nothing to
  borrow it says to reach for a design-guidance skill if your runtime offers one, and where there is, the
  project's own values still win over whatever opinion that skill has.

## 0.21.0

### Minor Changes

- Under the issue-tracker answer, the backlog can now be read without opening anything: a second label
  `workflow:planned` marks a feature that has a plan, so one chip on the issues list is an idea, two is
  planned, and two with an assignee is being worked. `/roadmap` with no argument also gains a real output
  shape under that answer — grouped by tier, with size, priority and what each entry waits on — replacing
  steps that named the working tree's marker and `Doc` field, neither of which exists there.

## 0.20.1

### Patch Changes

- Point the standards tree at `@northguild/worktree` and `@northguild/gmt`; both were still written under the
  old `@burglekitt` scope in `tooling/ci.md`, `tooling/dates.md` and `docs/SPEC.md`. The standards are
  tool-owned, so `update` carries the corrected names into an existing install unless you have edited those
  files yourself.

## 0.20.0

### Minor Changes

- `/onboard` now asks about a dependency audit along with the other checks the four gate headings miss, and
  `context/verify.md` says where one belongs: a check that can turn red with nothing in the diff is not a
  phase gate however cheap it is, unless the project holds it clean as a standing invariant.

## 0.19.0

### Minor Changes

- A bug is now its own category: Gate 2 files a defect wherever the project already files bugs, and nothing
  enters the backlog except through `/roadmap`, which applies the worth-adopting test first.
  `/orchestrate #<issue>` takes an issue as its brief and closes it from the commit, so a task-sized bug has
  a route through the gates.

## 0.18.1

### Patch Changes

- A non-blocking review finding no longer always becomes a backlog issue. Gate 2 files one only when it is
  user-visible or a regression would land green; everything else goes in `context/notes.md`, a branch-local
  file that nothing reads and `/feature-close` deletes whole.

## 0.18.0

### Minor Changes

- Git now happens on instruction and never on initiative — staging counts, permission is never inferred from
  an approved plan or a chosen option, and force-pushing, pushing to the default branch and rewriting
  published history are asked for by name each time. `executors.md` gains a **Branch and worktree** section
  holding the command that makes one, so a bare `git worktree add` is no longer the fallback; run `/onboard`
  after updating to fill in the two new stub sections.

## 0.17.0

### Minor Changes

- Under the issue-tracker answer, the workflow now records what a feature is waiting on as the tracker's own
  `blocked by` relationship: `/roadmap` sets the order the user's wording names, `/feature-plan` corrects it
  with research and links the chunks of a split, and `/feature-implement` and `/feature-status` read it — a
  blocked entry is no longer offered as the next thing to pick up.

### Patch Changes

- `/feature-status`'s report block and `/feature-implement`'s report list no longer ask for findings and
  severities, which 0.12.0 deleted along with `context/findings.md`.

## 0.16.0

### Minor Changes

- Planning now asks whether a change has an accessibility, performance or security surface instead of waiting
  to notice one, and records what proves it — an end-to-end pass in a real browser for anything with a user
  interface. Gate 1 also runs every section of `verify.md` above *Not run by Gate 1*, so a project whose real
  checks do not fit Lint / Typecheck / Build / Test has somewhere to put them, and `/onboard` now asks for
  them.

## 0.15.0

### Minor Changes

- `/onboard`'s release sweep now asks, of every workflow or job it names as a wire, whether it has ever run
  and what it left behind — because a file that reads correctly is a claim about a mechanism, not the
  mechanism, and a workflow that fails to load is inert in its entirety while looking perfectly sensible.
  `context/release.md` gains the matching rule: a wire names something that has run, or says that it has not.

## 0.14.0

### Minor Changes

- A note check must be exempt on the release commit, where the notes are gone because they became the
  changelog — `context/release.md` now asks for that exemption, `/onboard`'s release sweep reads the check and
  reports one that lacks it, and writing an empty note to satisfy a check is forbidden outright.
  `/feature-close --release` is the new and only shape of the *asked for in that turn* exception: it runs
  whatever the Bump wire names, after listing every pending note it will consume.
