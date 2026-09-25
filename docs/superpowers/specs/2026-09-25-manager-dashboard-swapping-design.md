# Manager dashboard swapping and personal color option

## Intent and scope

On `preview`, managers can rearrange Sunny's existing fleet dashboard by dragging a visible handle on a card whenever they want. The motion and hover swap should resemble the supplied Swapy example. A manager can independently enable colorful dashboard cards in Settings > Appearance. Keep real fleet numbers and actions; do not copy the example's fictional agency metrics. Main, production QR URLs, Firebase rules, and employee screens are outside this change.

## Existing behavior

`src/app/dashboard/page.tsx` renders eight named widget sections in several places; native HTML drag starts only in Customize mode, and arrow buttons reorder. `src/lib/dashboardLayout.ts` already normalizes sizes and persists order per user in localStorage. Settings > Appearance exists, but `AppSettings` currently stores a single local-only recent inspector preference and is unsuitable for a manager-specific color preference.

## Design

Render the movable dashboard sections in one responsive Swapy grid of stable slots and items. Keep the urgent safety banner and pending delete approvals outside the grid so critical actions remain prominent. Preserve the existing data, widget content, manager actions, links, size choices, saved order, and reset behavior. A dedicated drag handle on each widget enables dragging in normal viewing mode; interacting with controls inside cards never starts dragging. Hover swaps update the displayed slot mapping, and completed swaps persist the resulting order under the current manager's existing dashboard layout key. Changes to the set of visible widgets (such as empty lifespan review) must reconcile slots safely without losing saved order. The grid should stack on narrow screens and preserve workable widths for tables and calendars.

Add a manager-specific boolean preference, default false, using a key scoped to the signed-in user. Add a toggle under Settings > Appearance and load it on the dashboard. The colorful state applies a palette inspired by the supplied emerald, blue, purple, pink, and yellow examples to widget outer surfaces while keeping text, status meanings, nested tables, links, buttons, and focus indicators readable. The standard dashboard remains the default. A change to another manager's preference must not affect this manager. The preference is stored per browser/account, matching existing dashboard layout persistence; cross-device sync is not part of this version.

## Failure handling and accessibility

Malformed or unavailable stored layout or color preferences fall back to the default layout and standard palette. Drag handles have descriptive accessible names. Keep keyboard reorder controls (up/down) and reset as an alternative to pointer and touch dragging. If the Swapy library cannot initialize, render the saved order and preserve keyboard controls. Do not let dragging trigger card navigation or destructive action buttons.

## Verification

Test order normalization, swap persistence, preference isolation and defaults, and conditional widget visibility. In a browser, drag on desktop and touch, reload to confirm saved order, click links and controls inside widgets, change the manager color setting, sign in as a different manager to check isolation, inspect mobile width and table overflow, and verify critical notices stay above the grid. Run TypeScript/build and the existing test suite. Keep unrelated existing date-sensitive test failures visible in the report.
