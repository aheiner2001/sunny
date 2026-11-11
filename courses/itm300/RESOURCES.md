# Sunny Fleet API & Auth Resources

## Knowledge

- [MDN Web Docs: HTTP Overview & Methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
  Foundational reference on HTTP status codes, request/response headers, and REST conventions. Use for: response structure and status code semantics (200, 400, 401, 403, 404).
- [Firebase Auth Documentation: Verify ID Tokens on Backend](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
  Official guide for validating JWT tokens server-side with Firebase Admin SDK. Use for: token validation flow and claims extraction.
- [Luxon Documentation: Time Zones & Math](https://moment.github.io/luxon/#/tour)
  Standard library used across Sunny for DST-safe datetime arithmetic in `America/Denver`. Use for: shift splitting and boundary computation.
- [RFC 6750: The OAuth 2.0 Authorization Framework: Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
  Standard for `Authorization: Bearer <token>` headers. Use for: client credential transmission conventions.

## Wisdom (Communities)

- [Node.js Official Documentation & Community](https://nodejs.org/en/learn)
  Reference for native `node:http` request routing and stream handling.
- [Firebase Google Group / Discord](https://firebase.google.com/community)
  High-signal community for Firestore rules, authentication pitfalls, and custom claims best practices.
