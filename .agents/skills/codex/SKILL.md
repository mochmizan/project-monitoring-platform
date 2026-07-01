# Skill: Delegate Tasks to OpenAI Codex CLI

## When to use this skill
Use when the user wants to delegate a coding task to **OpenAI Codex CLI** (`codex`). Trigger on phrases like:
- "use codex to build / fix / refactor / review"
- "send this to codex", "delegate to codex"
- "run codex on this PR / issue / feature"
- "fix multiple issues in parallel with codex"
- "batch PR review with codex"

Requires: `codex` CLI installed and a git repository. For scratch work, initialize a temp repo first.

> For help choosing between Codex, `agy`, or Claude Code agents — see the `ai-agent-routing` skill.

---

## Prerequisites

```bash
# Install
npm install -g @openai/codex

# Authenticate — either:
export OPENAI_API_KEY=<your-key>
# or use OAuth (managed credentials via codex auth)
```

Must be inside a git repo. For scratch tasks: `cd $(mktemp -d) && git init`.

---

## Task Delegation Patterns

### 1. One-shot task
Use for well-defined tasks that run and exit cleanly.
```bash
codex exec "Add dark mode toggle to the settings page"
```

For scratch/throwaway work:
```bash
cd $(mktemp -d) && git init && codex exec "Build a snake game in Python"
```

### 2. Auto-approve file changes (`--full-auto`)
Use when building features — sandboxed, auto-approves all file changes in the workspace.
```bash
codex exec --full-auto "Refactor the auth module to use OAuth2"
```

### 3. No sandbox, no approvals (`--yolo`)
Fastest mode. Use only when you trust the task scope completely.
```bash
codex --yolo exec "Fix all TypeScript type errors in src/"
```

### 4. Long-running background task
Run in background and monitor separately.
```bash
# Start in background (separate terminal or nohup)
codex exec --full-auto "Migrate all API handlers to async/await" &

# Check progress
jobs
```

### 5. PR review
Safe review in a temp clone — never touches your working tree.
```bash
REVIEW=$(mktemp -d) && \
  git clone https://github.com/user/repo.git $REVIEW && \
  cd $REVIEW && \
  gh pr checkout 42 && \
  codex review --base origin/main
```

### 6. Parallel issue fixing with worktrees
Run multiple Codex processes simultaneously, one per issue.
```bash
# Create isolated worktrees
git worktree add -b fix/issue-78 /tmp/issue-78 main
git worktree add -b fix/issue-99 /tmp/issue-99 main

# Dispatch in parallel (background)
codex --yolo exec "Fix issue #78: <description>. Commit when done." \
  --workdir /tmp/issue-78 &
codex --yolo exec "Fix issue #99: <description>. Commit when done." \
  --workdir /tmp/issue-99 &

# Wait and push
wait
cd /tmp/issue-78 && git push -u origin fix/issue-78
gh pr create --head fix/issue-78 --title "fix: issue 78" --body "..."

# Clean up
git worktree remove /tmp/issue-78
git worktree remove /tmp/issue-99
```

### 7. Batch PR reviews
```bash
git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'

# Review multiple PRs in parallel
codex exec "Review PR #86. git diff origin/main...origin/pr/86" &
codex exec "Review PR #87. git diff origin/main...origin/pr/87" &
wait

# Post comments
gh pr comment 86 --body "<review output>"
gh pr comment 87 --body "<review output>"
```

---

## Key Flags Reference

| Flag | Purpose |
|------|---------|
| `exec "prompt"` | One-shot execution — runs and exits when done |
| `--full-auto` | Auto-approves file changes inside sandbox (safe for builds) |
| `--yolo` | No sandbox, no approvals — fastest, use with trusted tasks only |

---

## Rules

1. **Git repo required** — use `mktemp -d && git init` for scratch work
2. **Use `exec` for one-shots** — runs and exits cleanly
3. **`--full-auto` for building** — auto-approves sandbox changes without full YOLO risk
4. **Background for long tasks** — use `&` and `wait`, or a separate terminal
5. **Parallel is fine** — multiple Codex processes can run simultaneously via worktrees
6. **Don't interfere** — once dispatched, let it finish; premature interruption can leave partial changes
7. **`--yolo` sparingly** — only for trusted, well-scoped tasks in isolated worktrees

---

## Workflow: How to Delegate

1. **Clarify the task** — specific scope, target files, expected output
2. **Choose a mode:**
   - Simple task → `codex exec "..."`
   - Building a feature → `codex exec --full-auto "..."`
   - Many issues at once → parallel worktrees + `--yolo`
   - PR review → temp clone + `codex review --base origin/main`
3. **Ensure git repo context** — check `git status` first
4. **Monitor** — use `jobs` for background processes
5. **Review and push** — inspect diffs before pushing branches
