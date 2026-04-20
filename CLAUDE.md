# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps + prisma generate + migrate
npm run dev          # Dev server with Turbopack at localhost:3000
npm run dev:daemon   # Dev server in background, logs to logs.txt
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest tests
npm run db:reset     # Reset SQLite database
```

Run a single test file:
```bash
npx vitest run src/hooks/__tests__/use-auth.test.ts
```

Environment: set `ANTHROPIC_API_KEY` in `.env`. Without a key, the app uses a `MockLanguageModel` (safe for UI dev/testing). `JWT_SECRET` defaults to a dev key; set it explicitly in production. All dev/build scripts require `node-compat.cjs` via `NODE_OPTIONS` to strip Node 25+ WebStorage globals that break SSR.

## Architecture

**UIGen** is an AI-powered React component generator. Users describe UI in natural language; Claude generates React code into a virtual file system with a live preview.

### Request Flow

1. User types a prompt → `ChatInterface` → POST `/api/chat` (streaming)
2. The API route sends system prompt + chat history + two tools (`str_replace_editor`, `file_manager`) to Claude
3. Claude calls those tools to manipulate the **VirtualFileSystem** (in-memory, no disk I/O)
4. Streamed tool results propagate back via Vercel AI SDK → `FileSystemProvider` context updates
5. `PreviewFrame` re-renders the live component; `FileTree` + `CodeEditor` reflect the new files

### Key Abstractions

- **`src/lib/file-system.ts`** — `VirtualFileSystem` class: an in-memory tree that Claude writes into. Serializes to JSON for DB storage. All file ops go through here.
- **`src/lib/tools/`** — Claude tool definitions (`str_replace_editor`, `file_manager`) that wrap VirtualFileSystem methods.
- **`src/lib/provider.ts`** — Selects `claude-haiku-4-5` or `MockLanguageModel` based on whether `ANTHROPIC_API_KEY` is set.
- **`src/lib/contexts/`** — `ChatProvider` and `FileSystemProvider` share state between the chat panel and the editor/preview panels.
- **`src/lib/prompts/`** — System prompts that define Claude's code-gen persona and constraints (always use `/App.jsx` as entry, `@/` import alias, Tailwind CSS).
- **`src/lib/transform/jsx-transformer.ts`** — Babel standalone transforms + import map builder. Resolves `@/` aliases, auto-fetches third-party packages from `esm.sh`, stubs missing local imports with placeholder modules, inlines CSS, and emits the full iframe HTML for `PreviewFrame`.
- **`src/lib/anon-work-tracker.ts`** — Buffers anonymous session messages + VFS state in `sessionStorage` so they can be recovered and saved to a project after the user signs in.

### Layout

`main-content.tsx` is the shell: a resizable split with Chat (left, 35%) and a tabbed Code/Preview pane (right, 65%).

### Data Persistence

Authenticated users get projects persisted in SQLite via Prisma. Each `Project` stores serialized `VirtualFileSystem` JSON and the full message history. Anonymous sessions are ephemeral (browser only).

Always reference `prisma/schema.prisma` when needing to understand the structure of data stored in the database. The Prisma client is generated to `src/generated/prisma` (non-standard path); import from there, not from `@prisma/client`.

### Auth

JWT sessions in HTTP-only cookies. Server actions in `src/actions/` handle `signUp`/`signIn`/`signOut`. `src/middleware.ts` protects only `/api/projects` and `/api/filesystem` — `/api/chat` is intentionally public.

### Testing

Tests run in jsdom. `server-only` is stubbed via a vitest alias (`src/__mocks__/server-only.ts`) so server modules can be tested without Next.js. When writing tests for modules that import `server-only`, this alias is already wired up — no additional setup needed.

### Tool limitations

`str_replace_editor` does not support `undo_edit`; the execute handler returns an error string rather than reverting. Claude is instructed to use `str_replace` to revert changes instead.

### Generated components

Claude always generates `/App.jsx` as the entry point. Components use Tailwind classes and `@/` alias imports. The `PreviewFrame` runs Babel standalone in an iframe to execute the generated JSX.

## Path Alias

`@/` maps to `src/` (configured in `tsconfig.json` and `next.config.ts`).
