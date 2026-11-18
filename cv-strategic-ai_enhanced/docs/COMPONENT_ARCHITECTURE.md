# Component architecture

The UI is composed from focused functional components. Server Components are the default; only interactive islands use `"use client"`.

## Component tree

```text
RootLayout
└── Providers (TanStack QueryClientProvider)
    ├── HomePage (Server Component)
    │   ├── LaunchOfferBanner
    │   └── AuthPanel (Client Component)
    └── DashboardPage (Server Component; session guard)
        └── DashboardShell (Client Component)
            ├── TrialStatus
            ├── Account summary tiles
            ├── AnalysisWorkspace
            │   ├── Analysis form (React Hook Form + Zod)
            │   ├── Consultant-mode paywall
            │   └── AnalysisResults
            │       └── DOCX generation action
            └── Upgrade notice dialog
```

## Separation of responsibilities

- `app/`: route composition, metadata and route handlers only.
- `components/auth/`: user-facing authentication forms and OAuth launch actions.
- `components/dashboard/`: dashboard shell, launch-offer messaging and account status.
- `components/analysis/`: CV input, analysis state and result presentation.
- `lib/auth.ts`: server-side Better Auth configuration.
- `lib/auth-client.ts`: browser-side auth client.
- `lib/db/`: PostgreSQL connection pool and Drizzle schema.
- `lib/entitlements/`: server-only trial reservation, completion and release operations.
- `lib/ai/`: Groq integration, output schema, normalization and deterministic scoring.
- `lib/documents/`: uploaded document text extraction.

## State ownership

| State | Owner |
|---|---|
| Form fields and selected file | `AnalysisWorkspace` / React Hook Form |
| Current analysis result and temporary CV text | `AnalysisWorkspace` component state (memory only) |
| Account, role and trial counters | PostgreSQL; queried through `/api/account` |
| Cached account response | TanStack Query |
| Authentication session | Better Auth + PostgreSQL |
| Modal visibility and auth-panel mode | Local component `useState` |

No Redux store is required. Do not duplicate database entitlements into a mutable client-side global store. The server is authoritative.

## Hook guidelines

- `useState`: local interaction state only.
- `useQuery` / `useMutation`: server state, request lifecycle and cache invalidation.
- `useForm`: form state, validation and submission lifecycle.
- `useEffect`: only when synchronizing with an external system; do not use it to derive render values or mirror props into state.
- `useMemo`: only for expensive calculations or stable derived values that demonstrably benefit from memoization.
- `useCallback`: only when callback identity matters to memoized children or hook dependencies.
- `useRef`: DOM references or mutable values that must not trigger rendering.

Avoid premature memoization. Keep server-only secrets, database operations, Groq calls and authorization out of Client Components.
