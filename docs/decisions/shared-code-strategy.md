# Decision: Shared Code Strategy Across Projects

> Created: 2026-04-29
> Status: Decided — Option 2 (copy env var, no shared code)
> Revisit when: 4+ projects share meaningful prompt logic

---

## Context

Multiple PowerParent projects (snap-remind-calendar-kid, falling-notes) use the Anthropic API.
Question: how do we avoid duplicating client setup and shared logic?

---

## Options Considered

### Option 1 — Private npm package (`@powerparent/ai-client`)
Create a third repo, publish to npm (private or public). Both projects `npm install @powerparent/ai-client`.

**Pros:** Proper versioning, clean imports, standard practice at companies
**Cons:** Every change needs a publish step before other repos see it. Overkill for 2 projects.

---

### Option 2 — Copy the config, not the logic ✅ CHOSEN
Each project has its own Anthropic client initialisation (3 lines). Share only the API key via environment variables.

**Pros:** Zero coupling between repos, each project fully independent, no build overhead
**Cons:** If client setup changes (retries, timeouts), change it in 2 places

**Why chosen:** The Anthropic client is 3 lines — `new Anthropic({ apiKey })`. Nothing meaningful to share.
Prompts are domain-specific per project. 2 projects don't justify package overhead.

---

### Option 3 — Git submodule
Shared folder included in both repos as a git submodule.

**Pros:** One source of truth
**Cons:** Git submodules are painful to work with. Avoid.

---

### Option 4 — Monorepo (Turborepo / pnpm workspaces)
Both projects in one repo with shared `packages/` directory.

**Pros:** Best long-term for 5+ projects sharing code
**Cons:** Big restructure for marginal benefit at 2 projects

---

## Decision

**Use Option 2 now.** Each project has its own `.env` with `ANTHROPIC_API_KEY`.
Prompts stay project-specific.

**Upgrade trigger:** When 4+ projects share non-trivial prompt logic or utility functions,
create `@powerparent/ai-client` as a private npm package.
