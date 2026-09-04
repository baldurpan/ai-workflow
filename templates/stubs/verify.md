# Verification commands

This project's real verification stack. **Gate 1 reads this file** — no skill, agent prompt or role file
carries a copy of these commands, because a hardcoded stack rots the moment the project changes shape.

This is the single home for every command in this project. If you find a command written down anywhere else
in `context/`, that copy is the one that is wrong.

Keep it in step with CI. If a command here fails while CI is green, this file is the one that is wrong.

Run `/onboard` to fill these sections in — it proposes candidates, **runs each one, and writes only the
ones that exit 0.** Filling them in by hand is fine too; running them first is not optional either way.

<!-- Prerequisites, if any: node version, package manager, install step already run, services up. -->

## Lint

```bash
```

## Typecheck

```bash
```

## Build

```bash
```

## Test

```bash
```

## Not run by Gate 1

<!-- Commands that need Docker, a cloud account, or a deploy target. CI and deploy concerns, not
     per-task verification. List them here so nobody adds them above by mistake. -->

## Rules

- **A missing entry is skipped, never faked.** An empty section above means there is no such step. Gate 1
  skips it and says so; it never substitutes a command it invented.
- **Docs-only changes run Lint only**, plus a read of the diff. Skip build and test for changes that touch
  no application code.
- **Exit 0 is the verdict.** A non-zero exit is a Gate 1 failure regardless of what the summary text says.
- **If this file has no filled-in section at all, Gate 1 stops and says so.** It does not guess.
