// Common type definitions shared across modules

export type ID = string;

export interface BaseEntity {
  id: ID;
  created_at: string;
  updated_at: string;
}

export type Status = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

