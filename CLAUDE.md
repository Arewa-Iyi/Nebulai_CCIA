# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps + prisma generate + migrate
npm run dev          # Dev server with Turbopack at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest tests
npm run db:reset     # Reset SQLite database
```

Run a single test file:
```bash
npx vitest run src/components/__tests__/SomeComponent.test.tsx
```

Environment: copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without a key, the app uses a `MockLanguageModel` (safe for UI dev/testing).

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

### Layout

`main-content.tsx` is the shell: a resizable split with Chat (left, 35%) and a tabbed Code/Preview pane (right, 65%).

### Data Persistence

Authenticated users get projects persisted in SQLite via Prisma. Each `Project` stores serialized `VirtualFileSystem` JSON and the full message history. Anonymous sessions are ephemeral (browser only).

Always reference `prisma/schema.prisma` when needing to understand the structure of data stored in the database.

### Auth

JWT sessions in HTTP-only cookies. Server actions in `src/actions/` handle `signUp`/`signIn`/`signOut`. `src/middleware.ts` protects routes.

### Generated components

Claude always generates `/App.jsx` as the entry point. Components use Tailwind classes and `@/` alias imports. The `PreviewFrame` runs Babel standalone in an iframe to execute the generated JSX.

## Path Alias

`@/` maps to `src/` (configured in `tsconfig.json` and `next.config.ts`).
