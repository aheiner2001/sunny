# Authentication vs. Authorization in Reporting Endpoints

Established the distinction between AuthN (401 Unauthorized: caller identity cannot be verified) and AuthZ (403 Forbidden: verified caller lacks manager role). Verified with Bearer tokens (`token-employee-1` vs `token-manager-1`). Mapped local token lookup to production Firebase Admin SDK `verifyIdToken()` and Firestore server-side role resolution to prevent client-side role tampering.
