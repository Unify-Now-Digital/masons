# Contracts: sentry-proxy

| Document | Description |
|----------|-------------|
| [sentry-proxy.md](./sentry-proxy.md) | HTTP API for the `sentry-proxy` Edge Function |

All requests require a valid **Supabase user JWT** (`Authorization: Bearer <access_token>`). The function additionally enforces **admin allowlist** server-side.
