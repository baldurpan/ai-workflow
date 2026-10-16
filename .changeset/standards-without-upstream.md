---
"@baldurpan/create-ai-workflow": minor
---

The standards in `context/standards/` are now maintained in this package and covered by its MIT licence,
instead of being copied from a separate repository. They gain an SSRF section in `api-security.md`, and the
loading table now sends validation, forms and any `Date` work to `tooling/dates.md`. `update` removes the
old `context/standards/.source` marker.
