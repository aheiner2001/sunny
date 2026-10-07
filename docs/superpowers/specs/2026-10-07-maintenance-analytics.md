# Manager maintenance analytics

Authorized scope: /settings/analytics, current ManagerOnly access, VisActor charts,
side-by-side truck cards, oil service history and configurable intervals, yearly
planning timeline, equipment lifespan summary and an isolated sample mode.

VIN decoding identifies available vehicle configuration via NHTSA vPIC. It does
not supply service history or maintenance intervals. Managers confirm interval
applicability and enter the source. Unknown baselines stay unknown. Forecasts use
the earlier mileage/time limit, with stale or invalid readings excluded from
mileage extrapolation. Future repeated events are projections, not appointments.

Maintenance profiles/readings/history extend vehicle records. Targeted dbService
updates avoid overwriting unrelated assignment state. Service append uses
Firestore arrayUnion. Failed shared writes surface errors. Existing authentication
and Firebase rules are unchanged as requested. Equipment keeps its current
lifespan model; no invented hour-meter maintenance schedule.

Design: charcoal hero, light comparison cards with subtle gradient hover borders,
metric cards, VisActor bar chart, alternating timeline cards inspired by the
provided Timeline repository. Reduced motion and mobile layouts are supported.
Sample changes stay in component state and never call dbService write methods.

Checks: calculation edge cases, service validation, VIN decode failures, manager
gating, database persistence, full test suite, TypeScript, static exports for
Vercel and GitHub Pages, hosting/QR safety, preview deployment inspection.
