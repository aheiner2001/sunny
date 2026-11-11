# Timesheet Boundary Calculations and HTTP 400 Validation

Learner requested full guided support for date arithmetic and query validation. We scaffolded `prototype/fixtures.mjs` and `prototype/server.mjs`. Using Luxon's `DateTime.fromISO` in `America/Denver`, the service computes strict Monday-to-Sunday boundaries (resolving DST transitions) and validates input with HTTP 400 Bad Request. Test records confirmed 1.75 approved hours and 2.00 pending hours while filtering out prior-week and boundary records.
