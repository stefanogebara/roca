# Lessons

Append-only log of mistakes and the rules that prevent them. Newest first.

## 2026-07-15 — Surgical partial-commits must match import *paths*, not just symbols

**Context:** Committing the caderno-de-aplicacoes feature whose changes were
interleaved, in shared files (`pipeline.ts`, `db.ts`), with a concurrent session's
location-decoupling refactor. Staged only my hunks via `git apply --cached` + an awk
hunk filter, guarded by a contamination grep.

**What went wrong:** the contamination grep searched for the *other* feature's
identifier symbols (`ungeocodable`, `LocationPrecision`, `geocod`, `statedLocation`)
but not the bare `import ... from './location'` line. That import sat in the same hunk
as my own import additions, got swept into the Phase 0 commit (`b1274d3`), and left
HEAD importing a module that was not committed -> **the commit did not build.** Caught
only later via an isolated `git worktree` typecheck; the next commit removed it.

**Rules:**
- When surgically staging hunks out of a shared file, the contamination check MUST
  include **import specifiers/paths and references to files the commit does not add**,
  not only identifier symbols. Grep the *staged* diff for `from './`, `require(`, and
  any symbol the commit itself does not define.
- **Verify every partial commit builds in isolation** before moving on — a green
  working tree != a green commit when the tree has extra uncommitted files the commit
  references:
  `git worktree add /tmp/verify <sha> && ln -s "$PWD/node_modules" /tmp/verify/ && (cd /tmp/verify && npx tsc --noEmit)`
- Prefer **reconstruct-from-HEAD** over hunk-filtering for a badly entangled file:
  `git show HEAD:path > path`, re-apply only your own edits, stage, then restore the
  full worktree from a backup. Deterministic — no foreign hunk can slip in.

## 2026-07-15 — Concurrent sessions share one working tree; back up before racing git

**Context:** A parallel session ran `add -A` / commit / reset cycles on `master` while
I was mid-commit. It unstaged my staged changes, and briefly created then reset a commit
that bundled my files with theirs. Nothing was lost — but it was luck-adjacent.

**Rules:**
- In a shared worktree with another active agent, treat uncommitted work as **volatile**.
  Before any risky git operation, back up artifacts (untracked files + `git diff`
  patches) to `/tmp`; a concurrent `git reset --hard` / `git clean` would otherwise wipe
  unstaged changes.
- **Don't fight a concurrent committer.** If commit boundaries scramble (a commit appears
  then vanishes, staged changes get unstaged), stop, snapshot, and surface — don't keep
  issuing git writes into a moving target.
