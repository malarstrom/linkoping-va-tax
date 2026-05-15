# Coding Standards

## Principles

- Prefer **simple, obvious code** over clever abstractions.
- Keep components **small and focused**.
- Extract a module when logic becomes reusable, testable, or hard to read.
- Favor **TypeScript types** that reflect real domain concepts.
- Make invalid states unrepresentable where practical.

## TypeScript

- Use `strict` TypeScript.
- Avoid `any`.
- Prefer `type` for unions and `interface` for object shapes when extension is useful.
- Name domain types after the business concept, not the UI element.
- Keep helper functions pure unless they explicitly manage I/O or persistence.

## React

- Components should be:
  - readable in one screen where possible
  - controlled from the top
  - explicit about props and state
- Prefer composition over prop explosions.
- Keep state as local as possible.
- Derive data instead of storing duplicated state.
- Use hooks only when they add clarity.
- Do not put business rules directly in JSX if they can live in a function.

## Domain Modeling

- Use the glossary terms from `CONTEXT.md`.
- Do not invent synonyms for canonical domain terms.
- Keep tax rules and domain rules separate from presentation.
- Treat taxeversioner, profiles, and calculations as versioned concepts.
- Preserve audit trace and revision history for user-managed data.

## UI

- Use Tailwind and shadcn/ui patterns consistently.
- Prefer composition over custom styling where a primitive already exists.
- Keep UI text short and domain-accurate.
- Use accessible labels, focus states, and semantic HTML.

## Persistence

- All user data must remain client-side.
- IndexedDB is for structured app data.
- localStorage is only for small UI preferences.
- Never silently mutate persisted records in place when a revision is required.

## Calculations

- Keep calculation logic deterministic and pure.
- Do not mix calculation, formatting, and persistence.
- Return both totals and line-item breakdowns.
- Include source references for each calculated line whenever possible.
- Preserve internal precision; round only for display when needed.

## Imports / Exports

- Use JSON.
- Include schema version.
- Support mergeable object identities via UUID.
- Treat import as a data operation with conflict handling, not a blind overwrite.

## Testing

- Test behavior, not implementation details.
- Prefer fast unit tests for domain logic.
- Add regression tests for rule changes.
- Cover edge cases explicitly: versioning, history, merge conflicts, and special tax rules.

## Git

- Keep commits small and descriptive.
- Commit after a coherent slice is working.
- Do not commit generated build output or dependencies.
