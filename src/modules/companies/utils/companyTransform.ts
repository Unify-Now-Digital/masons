import type { Company, CompanyInsert, CompanyUpdate } from '../hooks/useCompanies';
import type { CompanyFormData } from '../schemas/company.schema';

// UI-friendly company format (camelCase)
export interface UICompany {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  teamMembers: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transform database company to UI-friendly format
 */
export function transformCompanyFromDb(company: Company): UICompany {
  return {
    id: company.id,
    name: company.name,
    address: company.address || '',
    city: company.city || '',
    country: company.country || '',
    phone: company.phone || '',
    email: company.email || '',
    teamMembers: company.team_members || [],
    notes: company.notes || '',
    createdAt: company.created_at,
    updatedAt: company.updated_at,
  };
}

/**
 * Transform array of database companies to UI format
 */
export function transformCompaniesFromDb(companies: Company[]): UICompany[] {
  return companies.map(transformCompanyFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toCompanyInsert(form: CompanyFormData): CompanyInsert {
  return {
    name: form.name,
    address: form.address || null,
    city: form.city || null,
    country: form.country || null,
    phone: form.phone || null,
    email: form.email || null,
    team_members: form.team_members || [],
    notes: form.notes || null,
  };
}

/**
 * Convert form data to database update payload
 */
export function toCompanyUpdate(form: CompanyFormData): CompanyUpdate {
  return {
    name: form.name,
    address: form.address || null,
    city: form.city || null,
    country: form.country || null,
    phone: form.phone || null,
    email: form.email || null,
    team_members: form.team_members || [],
    notes: form.notes || null,
  };
}

/**
 * Parse team members string (comma/newline-separated) to array
 */
export function parseTeamMembers(input: string): string[] {
  if (!input.trim()) return [];
  return input
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Format team members array to comma-separated string
 */
export function formatTeamMembers(members: string[]): string {
  return members.join(', ');
}

