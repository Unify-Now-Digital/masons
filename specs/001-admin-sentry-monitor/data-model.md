# Data model: Admin Sentry monitoring (view models)

This feature does **not** introduce new PostgreSQL tables in v1. Below are **canonical DTOs** returned by `sentry-proxy` and consumed by the monitoring module. Field names are stable API contracts; internal mapping from Sentry JSON happens in the Edge Function.

## `SentryIssueRow`

| Field        | Type   | Description |
|-------------|--------|-------------|
| `id`        | string | Sentry issue ID (stringified). |
| `title`     | string | Primary human-readable title / culprit line. |
| `count`     | number | Event count (total or per issue, per Sentry). |
| `firstSeen` | string | ISO 8601 timestamp. |
| `lastSeen`  | string | ISO 8601 timestamp. |
| `level`     | string | Optional: error level (e.g. `error`). |
| `permalink` | string | Optional: Sentry UI URL for deep link (if allowed). |

## `SentryPeriodStats`

| Field           | Type   | Description |
|----------------|--------|-------------|
| `errors24h`    | number | Total errors in last 24 hours (definition aligned with Sentry query). |
| `errors7d`     | number | Total errors in last 7 days. |
| `errors30d`    | number | Total errors in last 30 days. |
| `usersAffected`| number | Distinct users affected (Sentry “users” or equivalent aggregate). |

## `SentryTrendPoint`

| Field    | Type   | Description |
|----------|--------|-------------|
| `ts`     | string | Bucket start ISO 8601 or date-only string. |
| `errors` | number | Count in bucket. |

## `SentryStatsResponse`

| Field    | Type                | Description |
|----------|---------------------|-------------|
| `period` | `SentryPeriodStats` | Headline numbers. |
| `series` | `SentryTrendPoint[]` | Time series for chart (uniform bucket size, e.g. hourly or daily). |

## `SentryIssuesResponse`

| Field     | Type              | Description |
|----------|-------------------|-------------|
| `issues` | `SentryIssueRow[]` | Recent issues, newest first. |

## Validation rules

- All numeric counts **≥ 0**.
- `series` sorted ascending by `ts`.
- `issues` length bounded by `limit` query param (default e.g. 25, max e.g. 100).

## Relationships

- **Issues** and **stats** are independent reads; no foreign keys—same org/project context from Edge secrets.
