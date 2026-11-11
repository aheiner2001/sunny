# Training Gaps Reporting and Dual Sign-Off Logic

Implemented `GET /training/gaps` reflecting Sunny Fleet's dual sign-off lifecycle (trainer sign-off -> `awaiting_trainee` -> trainee certification -> `completed`, with miss threshold triggers -> `needs_retrain`). The manager endpoint filters out compliant `completed` records while surfacing actionable gaps with employee names, deadlines, and required interventions. Both endpoints now enforce strict server-side RBAC (401/403).
