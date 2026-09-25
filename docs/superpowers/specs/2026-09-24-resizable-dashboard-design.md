# Resizable manager dashboard

## Approved outcome

Replace the current Swapy dashboard with a responsive drag and resize grid. Managers can move cards using a large visible handle at any time. Customize layout reveals resize handles for both width and height. Desktop widths snap to one, two, or three columns. The five fleet metrics become individual cards. Keep the existing personal color option and real fleet data and actions.

Scope: deliver to the `preview` branch and Vercel preview. Production main and its QR routes are not part of this change.

## Current problems

- The `stats` widget groups five metrics into a single movable section.
- The legacy size model offers small, medium, and wide; small and medium both occupy one desktop column.
- Swapy swaps items between slots. Its integration recreates instances as order changes and requires separate code for resizing and placement.
- Dragging starts only on the existing header handle, while the card body rejects dragging; this affordance has been unclear to the user.
- Forced minimum widths introduced to retain horizontal groups create scrolling inside narrow slots.

## Architecture

Use `react-grid-layout` (the inspected current package is 2.2.4 and accepts React 18) for layout, dragging, collision handling, and resizing. Remove Swapy from the dashboard and remove the dependency if no other source file uses it. Keep layout data in a pure TypeScript module and React interaction code in a focused dashboard grid component. The dashboard page continues to own fleet data and existing action callbacks.

Render a stable widget registry with individual IDs for total vehicles, inspections today, open issue count, vehicles in use count, and equipment due count. Keep the existing activity, calendar, issue lists, van needs, equipment review, and vehicles in use sections. Urgent safety notices and pending deletion approvals remain above the grid.

## Interaction

- A visible header grip has a generous pointer and touch target and a descriptive accessible label. Drag remains enabled in normal viewing mode.
- Customize layout shows right-edge and bottom/corner resize affordances. Width snaps to available whole columns; height snaps to grid rows. The existing reset control remains available.
- Buttons, links, inputs, tables, and scrollable content never start dragging. Keyboard move and size controls remain available as alternatives.
- Show a destination outline while dragging or resizing. Resolve collisions through the grid library so cards never overlap after a completed operation.
- Minimum dimensions keep titles and controls reachable. Card bodies scroll when their content exceeds the selected height. Metric cards adapt text and spacing to their width instead of enforcing a large horizontal minimum width.
- Save after completed drag or resize operations. Live data updates change card content without resetting an interaction or its layout.

## Responsive layout and persistence

Save a versioned structure containing widget ID and grid coordinates (`x`, `y`, `w`, `h`) per breakpoint, under a key scoped to the signed-in manager. Use three columns at desktop widths, two at tablet widths, and one on phones. Breakpoint sizing uses the dashboard container's available width. Each breakpoint's layout is saved independently so arranging a phone dashboard does not overwrite desktop placement.

On first load, read the previous order and size preferences without modifying their original storage key. Convert them into non-overlapping positions. Expand the old `stats` entry into the five individual metrics, in their current metric order. Convert legacy wide to three desktop columns and other sizes to one; choose sensible initial heights by widget kind. Derive smaller-screen layouts by clamping widths and packing cards in reading order. Write the new layout only after successful validation. Preserve the personal color preference under its current key.

Validate saved data: reject unknown IDs, duplicate IDs, non-finite coordinates, negative positions, and invalid spans. Add newly introduced widgets once using defaults. Clamp sizes to the current column count and widget minimums. Corrupt or inaccessible storage falls back to a usable default layout. If a layout cannot be saved, retain the in-memory arrangement and show a concise save error rather than implying persistence succeeded.

Conditional widgets retain saved placements when temporarily hidden. When they become visible again, reconcile collisions without discarding other widgets. Reset clears only the new layout for the current manager and leaves personal color preferences intact.

## Appearance

Retain the manager-specific colorful mode. Standard and colorful cards use the same geometry and interactions. Status badges retain their meanings, contrast, and focus visibility. Remove the forced desktop minimum widths that were added to keep grouped metrics horizontal; individual metric cards now solve that problem directly. Tables can still scroll horizontally where their data requires it.

### Requested friendly palette

Use the user's exact five color ramps in the personal colorful dashboard mode: sky-surge, ivory-mist, prussian-blue, charcoal-blue, and light-coral. Register all supplied shades (50 through 950) as Tailwind tokens. Use ivory-mist-50 (#faf7eb) for the colorful dashboard backdrop; sky-surge-100 (#cdf4fe), ivory-mist-100 (#f5efd6), prussian-blue-100 (#dbe3f0), charcoal-blue-100 (#dee6ed), and light-coral-100 (#fccfd3) for card surfaces. Use prussian-blue-900 (#0f1724) for primary text and charcoal-blue-700 (#354e64) for secondary text. Sky-surge-700 (#037996) supplies focus/interaction accents. Coral is a restrained accent; existing critical, warning, and success status meanings remain distinct. Color settings continue to apply only to the manager who enabled them. This is a dashboard palette change, not a global recolor of other managers' screens.

## Verification and acceptance

1. Unit tests cover migration of grouped stats, unique widget IDs, bounds and collision normalization, corrupt data, per-manager isolation, breakpoint independence, and hidden-widget restoration.
2. In a browser, repeatedly drag different cards before and after resizing; confirm every visible handle works, interactive card controls still work, and no card overlap remains.
3. Resize a metric from one to two to three desktop columns and change its height; reload and confirm both dimensions and position persist.
4. Repeat pointer/touch checks at tablet and phone widths. Moving or resizing one breakpoint must preserve the saved desktop layout.
5. Toggle colors and switch manager accounts to verify preference isolation. Confirm urgent notices remain prominent and long content remains reachable.
6. Run TypeScript, the complete test suite, production builds, and both hosting/QR checks. Report any unavailable browser verification explicitly; passing unit tests and builds alone does not prove drag usability.

## Delivery

Publish the reviewed implementation to `preview`, verify its Vercel deployment and both hosting jobs, and provide the preview link. The feature is ready for production review only after interactive drag and resize checks succeed.
