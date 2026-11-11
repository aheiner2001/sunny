# Learning Record 0001: Connecting AWS Lambda to GitHub CI/CD

- **Date:** 2026-11-09
- **Topic:** Replacing manual AWS Console uploads with GitHub Actions OIDC deployment.
- **Context:** Senior Project CSE 499 (56 remaining hours).
- **Decision:**
  - Store Lambda source code inside the repository (`lambda/index.mjs`).
  - Deploy via GitHub Actions using AWS IAM OIDC roles rather than static long-lived credentials.
  - Test function code before triggering deployment.
