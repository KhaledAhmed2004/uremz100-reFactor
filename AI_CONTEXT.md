# AI-Developer Collaboration Context (AI Brain)

This document serves as the central context file for any AI agents interacting with this repository. Read this file before proceeding with debugging, refactoring, or feature development.

## 1. Project Architecture & Tech Stack
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB (via Mongoose)
- **Caching**: Redis
- **Testing**: Vitest + Supertest for e2e and integration tests.

## 2. Database Schema Gotchas & Rules
- **Poster Fields**: The image URL field in the `Content` collection must ALWAYS be referenced and saved as `posterUrl`. Avoid using the legacy field name `poster`. If you encounter scripts using `poster`, refactor them to `posterUrl`.
- **Virtual Fields**: Some fields like `isRecent` are Mongoose virtuals. They will not be found in direct MongoDB queries unless `.toObject({ virtuals: true })` or similar is used.

## 3. Debugging & Scratchpad Protocol
- **Do NOT bloat the main codebase with temporary debugging scripts.**
- Instead, use the pre-configured `scripts/ai-debug.ts` playground for any fast data querying or logic testing.
- Run it using: `npm run ai:debug`
- For temporary scratch files, store them in a `.scratch/` directory and ensure they are added to `.gitignore`.

## 4. Testing Conventions
- New features should have accompanying automated tests.
- Prefer e2e tests using `supertest` hitting the Express `app` directly rather than mocking internal services unless necessary.
- Manual verification should be done via VS Code REST Client or Postman using the auto-generated Postman collection (`npm run postman`).

---
*Maintain this file as the project evolves so the AI always has up-to-date context.*
