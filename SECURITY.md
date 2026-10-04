# Security Overview — DairyIntel AI

This document lists the security measures implemented and the known limitations
(deferred as future work), so evaluators and deployers understand the posture.

## Implemented

**Authentication & passwords**
- Passwords are hashed with bcrypt (never stored in plain text).
- `passwordHash` is stripped from all API responses (`.select("-passwordHash")`).
- JWT access tokens are signed with a server-side secret and verified on every
  protected route; tokens expire after 7 days.
- Role-based authorization: `auth` middleware verifies the token, `adminOnly`
  restricts admin routes. Ownership checks stop a farmer accessing another
  farmer's animals/records.

**Privilege escalation fixed**
- Public registration (`POST /api/auth/register`) always creates a `user`.
  The `role` field from the request body is ignored. Admins can only be created
  by an existing admin via the admin-only "Manage Users" flow.

**Transport & headers**
- `helmet` sets secure HTTP response headers.
- CORS is restricted to an allow-list (localhost in dev, `FRONTEND_URL` in prod).

**Abuse protection**
- Rate limiting on `/api/auth/*` (30 requests / 15 min / IP) mitigates
  brute-force login attempts.
- JSON body size capped at 100kb (mitigates large-payload DoS).

**Injection**
- Custom `sanitizeBody` middleware strips keys beginning with `$` or containing
  `.` from request bodies, blocking NoSQL operator injection (e.g. the login
  `$or` query cannot be abused with `{ "$gt": "" }`).

**Error handling**
- Controllers no longer return raw `err.message` to clients; internal errors are
  logged server-side and a generic message is returned. A central error handler
  catches anything unhandled.

**Secrets**
- `.env` is gitignored and excluded from distribution. `.env.example` files
  document required variables without real values.

## Known limitations (future work)

- **JWT in localStorage.** Convenient and standard for an SPA, but readable by
  JavaScript, so an XSS bug could leak the token. A production-grade approach
  would use httpOnly, Secure, SameSite cookies with CSRF protection.
- **No password reset flow.** Requires email/OTP infrastructure. Currently an
  admin resets a user's password via Manage Users.
- **No input schema validation** (e.g. zod/express-validator) on every endpoint.
  Sanitization and required-field checks exist, but full schema validation is
  recommended before real-world use.
- **No refresh-token rotation / token revocation list.** Logout is client-side
  (token discarded); a stolen token remains valid until expiry.
- **Rate limiting is in-memory.** For multi-instance deployments, back it with
  Redis so limits are shared across instances.

## Operational reminders

- Rotate `MONGO_URI` credentials and `JWT_SECRET` if the project folder
  (including `.env`) is ever shared.
- In MongoDB Atlas, restrict Network Access to known IPs where possible rather
  than 0.0.0.0/0.
- Set `NODE_ENV=production` in the deployed backend (disables verbose logging).

## Added in v2 (OTP)
- Login, signup and password reset need a 6-digit email OTP. Codes are bcrypt-hashed, expire after 10 minutes, allow 5 attempts, can be resent after 30 seconds, and are single-use.
- Separate rate limit on code requests (10 per 10 minutes per IP) in addition to the auth limiter.
- `devOtp` is never returned when `NODE_ENV=production` unless `ALLOW_DEV_OTP=true`.
- Resend responses are the same whether or not the account exists, so they don't reveal which emails are registered.
- Admins can block accounts. Blocked users can't log in.
- ML inputs are range-checked in both the API and FastAPI (pydantic).
