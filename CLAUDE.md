# Build rules — Manzaneque Limited IT Helpdesk

This is assessed coursework (Pearson HND Unit 4). `ARCHITECTURE.md` is the authoritative
specification. These rules govern every change made in this repository.

1. **Build the specified scope. Do not add to it.** No extra tables, endpoints, reports,
   screens or abstractions. If something appears missing, ask — do not build it speculatively.
2. **Database logic belongs in the database.** Aggregation in views, multi-step operations in
   stored procedures running in transactions, derived values from triggers. Do not pull rows
   into JavaScript and compute there.
3. **Parameterised queries only.** No string-concatenated SQL anywhere, including seed and
   maintenance scripts.
4. **Comment SQL for a human marker.** Every view, procedure, trigger, index and standalone
   query carries a header comment stating its purpose.
5. **It must run on a fresh machine.** Assume the assessor has Docker, or has MySQL and Node
   and nothing else. Both paths work from the README alone.
6. **No stubs.** Anything reported as complete works against real seeded data.
7. **Ask before assuming.** If the specification is ambiguous on something affecting the
   schema or a business rule, stop and ask.
8. **Commit at the end of each phase**, message naming the phase.

## Working method

Phases are worked in order (see MASTER_PROMPT process). After each phase, post a short
summary: what was built, what to verify, and which screenshots are needed with filenames.
`PROGRESS.md` is kept current so a fresh session can resume.

## Assumptions in force

See `PROGRESS.md` for the running list of assumptions made where `ARCHITECTURE.md` was silent.
