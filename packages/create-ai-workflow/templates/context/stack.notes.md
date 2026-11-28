# Filling in `stack.md`

The guidance for filling [`stack.md`](stack.md), read by `/onboard` Step 8 and by anyone filling the file
by hand. The stub is the answer; this file is never read by a command in the loop. Each heading below
mirrors a section of the stub, in the stub's order.

## Before the first section

One paragraph, above the table: what the project does, and anything about its history that explains why
it is shaped the way it is. Then fill the table — runtime, package manager, database, storage, hosting —
one target each, and leave a cell empty where the project has none.

## Audience

Who uses what this project puts in front of a person. It sets how far the accessibility row of the
standards reaches, and nothing else: performance and security are owed whoever the users are, and so is
an end-to-end pass for a user interface. Paste one of the two answers. **Missing or empty reads as
public**, so an install that never answers keeps the standard as written.

**Public**: anyone may use it, or people you cannot name. That covers a product, a public site, and a
company's internal tool.

> **Public.** The accessibility standard applies as written.

**Private**: everyone who uses it is known by name, none of them needs more than the floor, and that is
not expected to change. A personal tool, a hobby project, an app for one household.

> **Private.** Accessibility is held to the floor: the right element for the job, a label on every input,
> and every control reachable by keyboard. The floor is reviewed like any other standard. Past it,
> screen-reader passes, contrast, focus management and audits are not review expectations, not §8
> Verification rows, and a gap there that was already present is a note, not a bug.

The floor stays because it costs almost nothing. The lint rules catch most of it, and tests that query by
role depend on it. A project with no user interface writes "no user interface".

## Layout

The directories that matter, one line each on what lives there, inside the fenced block. The fence is what
keeps a `##` in a sketched path from reading as a heading of this file.

## Conventions

The rules that are specific to this repo and would not be guessed: things that break in this runtime,
things deliberately kept separate, where local secrets live, what must never be run against production.
This section is the one that earns its keep; the rest is discoverable. Inherited prose is usually
strongest here and weakest at describing layout, which drifts.

## Documentation

Every place this project explains itself, one line each: the path or URL, who reads it, and what kind of
change has to reach it. READMEs at the root and in each package, `docs/`, a docs site or landing page, an
API reference or OpenAPI document, a changelog, a wiki, help text that lives in the code, comments that are
the only description of a format.

Say which ones are actually maintained — a directory nobody has updated in two years is worth writing down
as that, rather than leaving the next reader to discover it.

**A generated changelog is not a surface, and does not belong here.** A file assembled from release notes
is an output, so a plan that listed it would be proposing to hand-edit something a tool rewrites. What a
change announces is [`release.md`](release.md)'s answer, and the note that feeds the changelog is written
there. A hand-maintained changelog nobody generates is an ordinary surface and does belong here.

If this project documents itself nowhere, write "none". An empty section reads as "nobody checked", and a
plan cannot tell those two apart.

## Also in `context/`

Index anything you add under `context/` here — `decisions.md`, `glossary.md`, `ops-notes.md`. Not in
`context/README.md`: that file is tool-owned and replaced on every update, so a line added there is a line
lost. The closing sentence pointing at the other answer files is live prose and stays.
