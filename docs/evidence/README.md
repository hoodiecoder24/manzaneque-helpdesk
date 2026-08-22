# Evidence file naming convention

Every test case in `docs/TEST_PLAN.md` has an **Evidence File** column pre-filled with the
name the corresponding screenshot, terminal capture, or saved output should use. Save each
piece of evidence into this folder (`docs/evidence/`) under exactly that filename so the
test plan and the evidence stay linked without any extra index.

## Pattern

```
docs/evidence/<Test ID>_<short description>.<extension>
```

- **`<Test ID>`** — the exact ID from the test plan, e.g. `TC-AUTH-01`, `TC-VAL-05`.
- **`<short description>`** — a few lowercase words, underscore-separated, matching what
  the test plan's filename already says. Don't invent a different description — copy it
  from the Evidence File column.
- **`<extension>`** — pick based on what the evidence actually is:
  - `.png` — a browser screenshot (UI-visible steps: forms, tables, error banners, the
    Reports screen, etc.)
  - `.txt` — captured terminal output (`curl` responses, `mysql` query output, `EXPLAIN`
    plans, `SHOW GRANTS` output, rate-limit responses)
  - `.sql` — a saved dump file, where the evidence *is* a `.sql` file rather than a text
    capture of running one (see `TC-MNT-01`, which points at the real backup under
    `db/maintenance/backups/`, not this folder — that one file's location is the evidence)

## A few rules

- One file per test case. If a test case has two levels (e.g. TC-VAL-19's API check and its
  direct-SQL check are both erroneous), that is already two separate rows with two separate
  filenames in the test plan — don't combine them into one file.
- For `.txt` captures, include the command you ran as the first line of the file, then the
  full output below it, so the evidence is self-contained without needing the test plan open
  side by side.
- Don't rename a file after the test plan is written without also updating the Evidence File
  column in `docs/TEST_PLAN.md` — they're expected to match exactly.
- This folder is tracked in git (`docs/evidence/.gitkeep`), but its contents accumulate
  during test execution, not before. It's fine for this folder to be empty in a commit that
  only adds the test plan.
