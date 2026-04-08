/** DTOs aligned with specs/001-admin-sentry-monitor/data-model.md (sentry-proxy responses). */

export interface SentryIssueRow {
  id: string;
  title: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  level?: string;
  permalink?: string;
}

export interface SentryPeriodStats {
  errors24h: number;
  errors7d: number;
  errors30d: number;
  usersAffected: number;
}

export interface SentryTrendPoint {
  ts: string;
  errors: number;
}

export interface SentryStatsResponse {
  period: SentryPeriodStats;
  series: SentryTrendPoint[];
}

export interface SentryIssuesResponse {
  issues: SentryIssueRow[];
}
