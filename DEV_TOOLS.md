# Developer / Demo Tools

The app has a few UI affordances that exist only to let developers and testers preview
different states of the app (paywall limits, a fresh-signup flow, etc.) without needing
separate real accounts for each. These are not meant to be visible to real users in a
production build.

All of them are controlled from **one place**: `lib/devTools.ts`.

## The single switch

```ts
// lib/devTools.ts
export const DEV_TOOLS_ENABLED: boolean;
```

Resolution order:

1. If the env var `EXPO_PUBLIC_DEV_TOOLS_ENABLED` is set to `"true"` or `"false"`, that wins — forces dev tools on or off regardless of build type.
2. Otherwise it defaults to `__DEV__` — on for local/dev builds, off for release/production builds.

To force it explicitly, add to `.env`:

```
EXPO_PUBLIC_DEV_TOOLS_ENABLED=true   # force on
EXPO_PUBLIC_DEV_TOOLS_ENABLED=false  # force off
```

Anything gated by dev tools should import `DEV_TOOLS_ENABLED` from `lib/devTools.ts` — never
hardcode a separate `true`/`false` or invent a second flag for a new demo-only UI element.

## What it currently gates

| Location | What it is | Behind the flag |
|---|---|---|
| `app/auth.tsx` | "Choose app version" panel on the login screen — lets a tester switch between `free` / `paid` / `limit-hit` (paywall demo) / `new-user` account states without separate logins | `SHOW_LOGIN_VERSION_SWITCH` in `lib/monetisation.ts`, derived from `DEV_TOOLS_ENABLED` |
| `app/auth.tsx` | Whether the `limit-hit` paywall-demo option appears inside that same panel | `SHOW_PAYWALL_DEMO_MODE` in `lib/monetisation.ts`, derived from `DEV_TOOLS_ENABLED` |
| `app/new-user-verification.tsx` | "This is a demo verification — no real ID is required" disclaimer banner | Inline `DEV_TOOLS_ENABLED` check |

`lib/monetisation.ts`'s `APP_VERSION` constant (which decides whether the app *defaults* to
the free or paid tier for real users) is intentionally **not** part of this switch — that's a
real business/release config, not a dev tool, and stays in effect whether or not dev tools are
enabled.

## Adding a new dev-only UI element

Import the flag and conditionally render:

```tsx
import { DEV_TOOLS_ENABLED } from '@/lib/devTools';

{DEV_TOOLS_ENABLED ? <YourDebugOnlyThing /> : null}
```

Then add a row to the table above so this file stays the single source of truth for what's
gated.
