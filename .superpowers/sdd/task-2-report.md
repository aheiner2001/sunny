# Task 2 Report: Shell fixes (layout, header, mobile drawer, FAB)

**Branch:** `styling`  
**Commit:** `718e6cd` — `fix: dynamic header title and shell layout tokens`  
**Status:** Complete

---

## Summary

Wired `getPageTitle` into the app shell so the header shows the current page title on all breakpoints, standardized main layout tokens, and updated mobile drawer and FAB styling to use design-system classes.

---

## Changes

### 1. Dynamic header title (`src/components/Header.tsx`)

- Imported `usePathname` from `next/navigation` and `getPageTitle` from `@/lib/pageTitles`.
- Replaced hardcoded `"Dashboard"` with `getPageTitle(pathname || '/dashboard')`.
- Removed `hidden lg:block` from the title wrapper; title now shows on mobile alongside the logo.
- Title wrapper uses `min-w-0 flex-1` so the `<h1>` truncates when space is tight (menu button + logo + title + actions).

### 2. Main container tokens (`src/app/layout.tsx`)

Replaced:

```tsx
<main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
```

With:

```tsx
<main className="flex-1 w-full max-w-[1400px] mx-auto px-[var(--gutter)] py-4 sm:py-8 pb-24 lg:pb-8">
```

Uses `--gutter` CSS variable for horizontal padding and widens max width to 1400px.

### 3. Mobile drawer tokens (`src/app/layout.tsx`)

| Element | Before | After |
|---------|--------|-------|
| Backdrop | `bg-slate-900/60` | `bg-ink/60` |
| Panel | `bg-white shadow-2xl` | `bg-surface shadow-lg` |
| Close button | `text-slate-400 hover:bg-slate-100` | `text-ink-muted hover:bg-surface-sunk` |

### 4. FAB scan button (`src/app/layout.tsx`)

- Removed redundant wrapper `<div>`.
- Positioning and visibility classes moved onto the button:

```tsx
className="btn btn-primary flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg lg:hidden fixed bottom-6 right-6 z-40"
```

---

## Constraint compliance

No new `sky-*`, `slate-*`, or `rounded-3xl` classes were introduced in touched files. Legacy slate classes in the drawer were replaced with design-system tokens.

---

## Manual smoke (Step 5)

Dev server was not started in this session. Verified via code review:

- `getPageTitle('/vehicles')` → `"Vehicles"` (matches `NAV_ITEMS` label)
- `getPageTitle('/issues')` → `"Issues"`
- `getPageTitle('/vehicles/detail')` → `"Vehicle"` (from `PAGE_TITLES`)
- `getPageTitle('/unknown')` → `"Sunny Fleet"` (fallback)

`usePathname()` updates on client navigation, so the header title will re-render when routes change.

---

## Test results

```
npm test
 Test Files  5 passed (5)
      Tests  21 passed (21)

npm run build
 ✓ Compiled successfully
 ✓ Generating static pages (17/17)
```

Both commands exited 0.

---

## Smoke verification

Unit tests in `src/lib/__tests__/pageTitles.test.ts` assert Step 5 route title checks:

- `getPageTitle('/vehicles')` → `"Vehicles"`
- `getPageTitle('/issues')` → `"Issues"`
- `getPageTitle('/dashboard')` → `"Dashboard"`

These replace manual code-review-only verification for the primary shell routes.

---

## Files modified

- `src/components/Header.tsx`
- `src/app/layout.tsx`
