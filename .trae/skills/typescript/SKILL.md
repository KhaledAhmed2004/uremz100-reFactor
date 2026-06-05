---
name: typescript
description: Standards for writing type-safe, maintainable, and observable TypeScript code in this backend project. MUST READ before writing or modifying any .ts files.
origin: Project
---

# TypeScript Code Style Guide

## Type Safety & Conventions

- **Inference**: Avoid explicit type annotations when TypeScript can infer accurately.
- **Strictness**: Avoid `any`. Use `unknown` or a specific interface.
- **Interfaces**: Prefer `interface` for object shapes (e.g., payloads, responses); use `type` for unions/intersections.
- **Enums**: Use `enum` for sets of related constants (e.g., `USER_ROLES`, `STATUS`).
- **Imports**: Separate type imports with `import type { ... }`.

Refer to [clean-code.md](file:///.claude/rules/clean-code.md) for naming conventions and best practices.

## Async Patterns

- Always use `async`/`await`. Avoid `.then()` or callbacks.
- Use `catchAsync()` to wrap all Express controller handlers for centralized error handling.
- Prefer `Promise.all()` for concurrent operations that don't depend on each other.

## Layered Architecture Patterns

This project follows a strict **Controller → Service → Model** flow.

- **Controllers**: Thin layer for request/response. Always named `*Controller`.
- **Services**: Fat layer for business logic. Always named `*Service`.
- **Models**: Mongoose schema and database interaction logic.

Refer to [codebase-blueprint.md](file:///.trae/templates/codebase-blueprint.md) for copy-paste templates.

## Observability & Auto-Labeling (CRITICAL)

This codebase has a sophisticated logging system built on **OpenTelemetry**.

- **Auto-Labeling**: Classes named `*Controller` or `*Service` are automatically labeled for tracing. **Naming conventions are mandatory.**
- **Request Context**: Use `getRequestContext()` from `src/app/logging/requestContext.ts` to access per-request metadata (request ID, user ID, etc.) without passing objects through the call stack.
- **Timeline Visualization**: Console logs will show span timelines for each request. Naming your functions descriptively helps in debugging.

Refer to [logging.md](file:///.claude/rules/logging.md) for more on observability.

## Error Handling

- Always throw `ApiError` from `src/errors/ApiError.ts`.
- Include descriptive error messages and appropriate HTTP status codes (from `http-status-codes`).

```typescript
throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
```

## Import Order (src/app.ts & src/server.ts)

The order of imports in entry files is **MANDATORY** for metrics and tracing to work.

1. `mongooseMetrics`
2. `autoLabelBootstrap`
3. `opentelemetry`
4. `patchBcrypt`, `patchJWT`, `patchStripe`
5. Routes/App logic

Refer to [architecture.md](file:///.claude/rules/architecture.md#L73) for the full list.
