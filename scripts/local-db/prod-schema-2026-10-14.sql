-- Schema-only snapshot of production public schema (bfwohzcugtwbhhxdqgme), generated 2026-10-14
-- from pg_catalog via read-only SELECTs. NO DATA. Used to build a LOCAL test database because the
-- repo migrations cannot be replayed from empty (history drift; see /workspace/mason/rls-audit.md #9).
set check_function_bodies = off;
set search_path = public, extensions;
create sequence if not exists public.invoice_number_seq;
create sequence if not exists public.orders_order_number_seq;
create sequence if not exists public.partner_comments_id_seq;
create sequence if not exists public.partners_id_seq;
create sequence if not exists public.partner_sessions_id_seq;
create sequence if not exists public.quotes_quote_number_seq;
create sequence if not exists public.admin_sessions_id_seq;
create sequence if not exists public.inscription_requests_id_seq;
create sequence if not exists public.customer_activity_id_seq;
create sequence if not exists public.password_reset_tokens_id_seq;
create sequence if not exists public.portal_security_events_id_seq;
create sequence if not exists public.partner_magic_link_tokens_id_seq;
create sequence if not exists public.customer_portal_tokens_id_seq;
create table public.activity_logs (id uuid default gen_random_uuid() not null, created_at timestamp with time zone default now() not null, user_id uuid not null, entity_type text not null, entity_id uuid not null, action text not null, changes jsonb default '{}'::jsonb not null, context jsonb default '{}'::jsonb not null, organization_id uuid);
create table public.admin_sessions (id integer default nextval('admin_sessions_id_seq'::regclass) not null, token text not null, expires_at timestamp with time zone not null, created_at timestamp with time zone default now());
create table public.burial_ground_contact_candidates (id uuid default gen_random_uuid() not null, organization_id uuid not null, cemetery_id uuid, burial_ground_name text not null, area text, postcode text, governing_body text, governing_body_type text, contact_name text, contact_role text, email text not null, normalized_email text generated always as (lower(btrim(email))) stored, email_category text not null, phone text, source_url text not null, source_title text, source_excerpt text, source_domain text, confidence smallint default 50 not null, status text default 'pending_review'::text not null, promoted_contact_id uuid, discovered_at timestamp with time zone default now() not null, last_verified_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.cemeteries (id uuid default gen_random_uuid() not null, slug text not null, name text not null, area text not null, region text default 'North London'::text not null, postcode text, kerb_allowed boolean default true, lawn_section boolean default true, cremation_section boolean default true, permit_fee integer, processing_weeks text, installed_count text, note text, is_active boolean default true, display_order integer default 0, created_at timestamp with time zone default now(), address text, latitude numeric(9,6), longitude numeric(9,6), governing_body text, governing_body_type text, country text default 'England'::text not null, organization_id uuid not null, max_height_mm integer, max_width_mm integer, allowed_typefaces text[], regulation_notes text, primary_email text, phone text, avg_approval_days integer, notes text, updated_at timestamp with time zone default now() not null, is_test boolean default false not null, permit_contact_id uuid, permit_contact_assigned_at timestamp with time zone, permit_contact_assigned_by text, permit_form_id uuid, permit_form_assigned_at timestamp with time zone, permit_form_assigned_by text);
create table public.cemetery_contacts (id uuid default gen_random_uuid() not null, cemetery_id uuid not null, name text, role text, email text, phone text, address text, notes text, is_primary boolean default false not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.cemetery_match_reviews (id uuid default gen_random_uuid() not null, organization_id uuid not null, order_id uuid not null, source_cemetery_id uuid, resolved_cemetery_id uuid not null, decision text default 'confirmed'::text not null, selection_mode text not null, score numeric not null, reasons jsonb default '[]'::jsonb not null, evidence jsonb default '{}'::jsonb not null, reviewer_session_hash text not null, created_at timestamp with time zone default now() not null);
create table public.cemetery_pricing (id uuid default gen_random_uuid() not null, cemetery_id uuid not null, memorial_type text not null, permit_fee numeric(8,2), notes text, is_available boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.companies (id uuid default gen_random_uuid() not null, name text not null, address text, city text, country text, phone text, email text, team_members text[] default '{}'::text[], notes text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), organization_id uuid not null);
create table public.contact_handles (id uuid default gen_random_uuid() not null, owner_type text not null, owner_id uuid not null, channel text not null, handle text not null, is_primary boolean default false not null, created_at timestamp with time zone default now() not null);
create table public.customer_activity (id integer default nextval('customer_activity_id_seq'::regclass) not null, order_id uuid not null, action text not null, detail text, created_at timestamp with time zone default now(), customer_id uuid);
create table public.customer_portal_tokens (id bigint generated by default as identity not null, organization_id uuid not null, person_id uuid not null, token_hash text not null, expires_at timestamp with time zone not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.enquiries (id uuid default gen_random_uuid() not null, organization_id uuid not null, person_id uuid not null, channel text not null, sub_type text, source_page text, message text, contact_pref text, location text, appointment_at timestamp with time zone, appointment_kind text, photo_urls text[], details jsonb, order_id uuid, status text default 'new'::text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone, cemetery_id uuid, gclid text, gbraid text, wbraid text, utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text);
create table public.ghl_connections (id uuid default gen_random_uuid() not null, organization_id uuid not null, ghl_location_id text not null, status text default 'disconnected'::text not null, last_verified_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, ghl_api_key bytea, outbound_enabled boolean default false not null);
create table public.ghl_send_idempotency (request_id uuid not null, organization_id uuid not null, conversation_id text not null, contact_id text not null, channel_type text not null, status text not null, ghl_message_id text, ghl_conversation_id text, error_message text, created_at timestamp with time zone default now() not null, completed_at timestamp with time zone);
create table public.gmail_connections (id uuid default gen_random_uuid() not null, user_id uuid not null, provider text default 'google'::text not null, email_address text, access_token text, refresh_token text not null, token_expires_at timestamp with time zone, scope text, status text default 'active'::text not null, last_synced_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.inbox_ai_suggestions (id uuid default gen_random_uuid() not null, message_id uuid not null, suggestion_text text not null, created_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.inbox_ai_thread_summaries (id uuid default gen_random_uuid() not null, scope text not null, conversation_id uuid, person_id uuid, summary_text text not null, messages_fingerprint text not null, updated_at timestamp with time zone default now() not null, user_id uuid, unlinked_channel text, unlinked_handle text, organization_id uuid not null);
create table public.inbox_channel_accounts (id uuid default gen_random_uuid() not null, channel text not null, display_name text, is_connected boolean default false not null, meta jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null);
create table public.inbox_conversations (id uuid default gen_random_uuid() not null, channel text not null, external_thread_id text, primary_handle text not null, subject text, status text default 'open'::text not null, unread_count integer default 0 not null, last_message_at timestamp with time zone, last_message_preview text, created_at timestamp with time zone default now() not null, person_id uuid, link_state text default 'unlinked'::text not null, link_meta jsonb default '{}'::jsonb not null, user_id uuid, whatsapp_connection_mode text, whatsapp_managed_connection_id uuid, organization_id uuid not null, order_id uuid, last_inbound_at timestamp with time zone, last_outbound_at timestamp with time zone, enquiry_stage text default 'new'::text not null, ai_priority integer, ai_reason text, ai_category text, ai_scored_at timestamp with time zone, ai_dismissed_at timestamp with time zone);
create table public.inbox_enquiry_extraction (conversation_id uuid not null, organization_id uuid not null, order_type text, customer_name text, customer_phone text, cemetery_text text, product_text text, inscription_text text, linked_order_id uuid, confidence integer, flags text[] default '{}'::text[] not null, model text, model_meta jsonb, extracted_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.inbox_messages (id uuid default gen_random_uuid() not null, conversation_id uuid not null, channel text not null, direction text not null, sent_at timestamp with time zone not null, from_handle text not null, to_handle text not null, body_text text not null, external_message_id text, status text, meta jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null, user_id uuid, gmail_connection_id uuid, whatsapp_connection_id uuid, whatsapp_managed_connection_id uuid, subject text, whatsapp_connection_mode text, whatsapp_sender_sid text, body_html text, organization_id uuid not null);
create table public.inbox_muted_senders (id uuid default gen_random_uuid() not null, organization_id uuid not null, normalized_handle text not null, created_by uuid, created_at timestamp with time zone default now() not null, source text default 'manual'::text not null, unmuted_at timestamp with time zone);
create table public.inscription_requests (id integer default nextval('inscription_requests_id_seq'::regclass) not null, order_id uuid not null, requested_text text not null, reason text, status text default 'pending'::text, created_at timestamp with time zone default now(), resolved_at timestamp with time zone);
create table public.inscriptions (id uuid default gen_random_uuid() not null, order_id uuid, inscription_text text not null, type text not null, style text, color text, proof_url text, status text default 'pending'::text not null, engraved_by text, engraved_date date, notes text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), organization_id uuid not null);
create table public.invoice_line_items (id uuid default gen_random_uuid() not null, organization_id uuid not null, invoice_id uuid not null, order_id uuid, source_order_additional_option_id uuid, stripe_invoice_item_id text, stripe_invoice_line_item_id text, line_position integer not null, line_type text not null, description text not null, quantity numeric(12,3) default 1 not null, unit_amount_pence bigint not null, gross_amount_pence bigint not null, currency text not null, counts_toward_order_value boolean default true not null, tax_treatment text default 'unconfirmed'::text not null, tax_rate_basis_points integer, net_amount_pence bigint, vat_amount_pence bigint, source text default 'order'::text not null, locked_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.invoice_payments (id uuid default gen_random_uuid() not null, user_id uuid, invoice_id uuid not null, stripe_invoice_id text not null, stripe_payment_intent_id text, stripe_charge_id text, amount bigint not null, status text not null, created_at timestamp with time zone default now() not null, organization_id uuid not null, stripe_invoice_payment_id text, stripe_payment_record_id text, source text default 'unknown'::text not null, method text, external_reference text, received_at timestamp with time zone, verified_at timestamp with time zone, verified_by_user_id uuid, qualifying_amount_pence bigint, permit_amount_pence bigint, reversed_at timestamp with time zone, reversal_reason text);
create table public.invoices (id uuid default gen_random_uuid() not null, order_id uuid, invoice_number text not null, customer_name text not null, amount numeric(10,2) not null, status text default 'pending'::text, due_date date not null, issue_date date default CURRENT_DATE, payment_method text, payment_date date, notes text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), stripe_checkout_session_id text, stripe_payment_intent_id text, stripe_status text default 'unpaid'::text, paid_at timestamp with time zone, stripe_invoice_id text, stripe_invoice_status text, user_id uuid, hosted_invoice_url text, amount_paid bigint default 0, amount_remaining bigint, revised_from_invoice_id uuid, locked_at timestamp with time zone, deleted_at timestamp with time zone, organization_id uuid, is_test boolean default false not null, stripe_credential_mode text, intended_deposit_pence bigint, person_id uuid, job_id uuid, invoice_type text, billing_party text, currency text, stripe_customer_id text);
create table public.jobs (id uuid default gen_random_uuid() not null, organization_id uuid not null, person_id uuid, conversation_id uuid, enquiry_id uuid, source text not null, stage text default 'enquired'::text not null, stage_status text, paid_at timestamp with time zone, exit_reason text, exited_at timestamp with time zone, wake_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.memorials (id uuid default gen_random_uuid() not null, order_id uuid, deceased_name text, date_of_birth date, date_of_death date, cemetery_name text, cemetery_section text, cemetery_plot text, memorial_type text, material text, color text, dimensions text, inscription_text text, inscription_language text, installation_date date, status text default 'planned'::text, condition text, notes text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), name text, price numeric, photo_url text);
create table public.oauth_state (nonce text not null, user_id uuid not null, organization_id uuid not null, expires_at timestamp with time zone not null, consumed_at timestamp with time zone, created_at timestamp with time zone default now() not null);
create table public.order_additional_options (id uuid default gen_random_uuid() not null, order_id uuid not null, name text not null, description text, cost numeric(10,2) default 0 not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.order_events (id uuid default gen_random_uuid() not null, order_id uuid not null, event_type text not null, summary text not null, detail jsonb, created_at timestamp with time zone default now());
create table public.order_payments (id uuid default gen_random_uuid() not null, order_id uuid, organization_id uuid, user_id uuid, source text not null, external_id text not null, amount numeric not null, currency text default 'GBP'::text, payment_type text, reference text, match_reason text, match_candidates jsonb, matched_at timestamp with time zone, matched_by text, status text default 'unmatched'::text not null, received_at timestamp with time zone, created_at timestamp with time zone default now() not null);
create table public.order_people (id uuid default gen_random_uuid() not null, order_id uuid not null, person_id uuid not null, is_primary boolean default false not null, created_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.order_permits (id uuid default gen_random_uuid() not null, order_id uuid not null, organization_id uuid not null, permit_form_id uuid, cemetery_id uuid, permit_phase text default 'select_form'::text not null, sent_via text, sent_at timestamp with time zone, returned_via text, returned_at timestamp with time zone, spec_fixings text, spec_plot_ref text, specs_completed_at timestamp with time zone, submitted_at timestamp with time zone, approved_at timestamp with time zone, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, next_action text default 'match_form'::text not null, waiting_on text default 'sears_melvin'::text not null, stage_entered_at timestamp with time zone default now() not null, next_action_at timestamp with time zone default now() not null, state_version integer default 1 not null, written_approval_evidence_ref text);
create table public.order_proof_ai_checks (id uuid default gen_random_uuid() not null, proof_id uuid not null, organization_id uuid not null, version integer not null, level text not null, label text not null, suggest text, dismissed_at timestamp with time zone, dismissed_by uuid, created_at timestamp with time zone default now() not null);
create table public.order_proof_versions (id uuid default gen_random_uuid() not null, proof_id uuid not null, organization_id uuid not null, version integer not null, event text not null, actor text not null, note text, render_url text, days_from_inscription integer, created_at timestamp with time zone default now() not null);
create table public.order_proofs (id uuid default gen_random_uuid() not null, order_id uuid not null, user_id uuid not null, inscription_text text not null, stone_photo_url text not null, font_style text, additional_instructions text, render_url text, render_method text default 'ai_image'::text not null, render_provider text, render_meta jsonb, state text default 'not_started'::text not null, last_error text, sent_via text, sent_at timestamp with time zone, inbox_conversation_id uuid, approved_at timestamp with time zone, approved_by text, changes_requested_at timestamp with time zone, changes_note text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, organization_id uuid not null, inscription_received_at timestamp with time zone);
create table public.order_tracking_tokens (order_id uuid not null, organization_id uuid not null, token_hash text not null, expires_at timestamp with time zone not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.orders (id uuid default gen_random_uuid() not null, customer_name text not null, customer_email text, customer_phone text, order_type text not null, sku text, material text, color text, stone_status text default 'NA'::text, permit_status text default 'pending'::text, proof_status text default 'Not_Received'::text, deposit_date date, second_payment_date date, due_date date, installation_date date, location text, value numeric(10,2), progress integer default 0, assigned_to text, priority text default 'medium'::text, timeline_weeks integer default 12, notes text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), invoice_id uuid, latitude numeric(10,8), longitude numeric(10,8), permit_cost numeric(10,2) default 0 not null, renovation_service_description text, renovation_service_cost numeric(10,2) default 0 not null, geocode_status text, geocode_error text, geocoded_at timestamp with time zone, geocode_place_id text, order_number bigint default nextval('orders_order_number_seq'::regclass), person_id uuid, person_name text, product_photo_url text, permit_form_id uuid, partner_id integer, edit_token text, product_config text, status text default 'pending'::text, quote_id uuid, tracking_token text, inscription_text text, inscription_status text default 'pending'::text, proof_url text, proof_uploaded_at timestamp with time zone, proof_notes text, estimated_completion text, permit_transferred_at timestamp with time zone, permit_fee numeric(10,2) default 0, inscription_font text, inscription_font_other text, inscription_layout text, inscription_additional text, product_id uuid, organization_id uuid not null, cemetery_id uuid, admin_notes text, is_test boolean default false not null, custom_product_name text, job_id uuid, stage text default 'quote_received'::text not null, archived_at timestamp with time zone);
create table public.organization_members (id uuid default gen_random_uuid() not null, organization_id uuid not null, user_id uuid not null, role text not null, created_at timestamp with time zone default now() not null);
create table public.organization_stripe_config (organization_id uuid not null, live_payments_enabled boolean default false not null, test_round_trip_passed_at timestamp with time zone, test_secret_key_encrypted bytea, test_publishable_key text, test_webhook_secret_encrypted bytea, live_secret_key_encrypted bytea, live_publishable_key text, live_webhook_secret_encrypted bytea, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.organizations (id uuid default gen_random_uuid() not null, name text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.partner_comments (id integer default nextval('partner_comments_id_seq'::regclass) not null, order_id uuid not null, partner_id integer not null, comment text not null, created_at timestamp with time zone default now());
create table public.partner_magic_link_tokens (id bigint generated by default as identity not null, partner_id integer not null, token_hash text not null, expires_at timestamp with time zone not null, consumed_at timestamp with time zone, created_at timestamp with time zone default clock_timestamp() not null);
create table public.partner_sessions (id integer default nextval('partner_sessions_id_seq'::regclass) not null, partner_id integer not null, token text not null, expires_at timestamp with time zone not null, created_at timestamp with time zone default now(), actor_email text, staff_role text);
create table public.partners (id integer default nextval('partners_id_seq'::regclass) not null, email text not null, password_hash text, name text not null, company text, phone text, active boolean default true, created_at timestamp with time zone default now(), status text default 'pending'::text not null, declined_at timestamp with time zone, approved_at timestamp with time zone, notes text, updated_at timestamp with time zone default now());
create table public.password_reset_tokens (id integer default nextval('password_reset_tokens_id_seq'::regclass) not null, partner_id integer not null, token text not null, expires_at timestamp with time zone not null, used boolean default false, used_at timestamp with time zone, created_at timestamp with time zone default now());
create table public.payments (id uuid default gen_random_uuid() not null, invoice_id uuid not null, amount numeric(10,2) not null, date date default CURRENT_DATE not null, method text not null, reference text, notes text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), organization_id uuid not null);
create table public.people (id uuid default gen_random_uuid() not null, first_name text not null, last_name text not null, email text, phone text, address text, city text, country text, company_id uuid, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), portal_token text, portal_token_expires_at timestamp with time zone, organization_id uuid not null, is_customer boolean default false not null, is_test boolean default false not null, is_customer_override boolean, customer_override_at timestamp with time zone, created_via text);
create table public.permit_cemetery_email_deliveries (id uuid default gen_random_uuid() not null, idempotency_key uuid not null, organization_id uuid not null, order_id uuid not null, permit_id uuid not null, cemetery_id uuid not null, permit_document_id uuid not null, permit_contact_id uuid not null, state_version integer not null, provider text default 'gmail'::text not null, status text default 'reserved'::text not null, recipient_email_snapshot text not null, recipient_validation_status_snapshot text not null, recipient_validated_at_snapshot timestamp with time zone, recipient_fingerprint text not null, payload_fingerprint text not null, provider_message_id text, provider_thread_id text, error_code text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, sent_at timestamp with time zone);
create table public.permit_contacts (id uuid default gen_random_uuid() not null, email text not null, normalized_email text generated always as (lower(btrim(email))) stored, email_domain text generated always as (split_part(lower(btrim(email)), '@'::text, 2)) stored, name text, role text, phone text, category text default 'other_official'::text not null, is_generic_inbox boolean default false not null, validation_status text default 'unverified'::text not null, validation_basis text, validated_at timestamp with time zone, first_seen_at timestamp with time zone, last_seen_at timestamp with time zone, inbound_count integer default 0 not null, outbound_count integer default 0 not null, direct_header_count integer default 0 not null, body_mention_count integer default 0 not null, bounce_count integer default 0 not null, last_bounce_at timestamp with time zone, source_system text not null, source_ref text, source_metadata jsonb default '{}'::jsonb not null, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.permit_documents (id uuid default gen_random_uuid() not null, organization_id uuid not null, order_id uuid not null, permit_id uuid not null, parent_document_id uuid, document_role text not null, google_drive_file_id text not null, document_url text not null, file_name text not null, mime_type text not null, source_system text not null, source_ref text, ocr_status text default 'pending'::text not null, extracted_fields jsonb default '{}'::jsonb not null, review_status text default 'confirmed'::text not null, reviewed_at timestamp with time zone, reviewer_session_hash text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.permit_email_deliveries (id uuid default gen_random_uuid() not null, idempotency_key uuid not null, organization_id uuid not null, order_id uuid not null, permit_id uuid not null, state_version integer not null, provider text not null, status text default 'reserved'::text not null, recipient_fingerprint text not null, payload_fingerprint text not null, provider_message_id text, provider_thread_id text, error_code text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, sent_at timestamp with time zone);
create table public.permit_form_match_reviews (id uuid default gen_random_uuid() not null, organization_id uuid not null, order_id uuid not null, permit_form_id uuid not null, previous_permit_form_id uuid, decision text default 'confirmed'::text not null, selection_mode text not null, score numeric not null, reasons jsonb default '[]'::jsonb not null, evidence jsonb default '{}'::jsonb not null, reviewer_session_hash text not null, created_at timestamp with time zone default now() not null);
create table public.permit_forms (id uuid default gen_random_uuid() not null, name text not null, link text, note text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, google_drive_file_id text, google_drive_folder_id text, mime_type text, last_synced_at timestamp with time zone, organization_id uuid not null, cemetery_id uuid, match_reason text, original_filename text, proposed_clean_name text, source_folder_name text, source_modified_at timestamp with time zone, source_size_bytes bigint, source_last_seen_at timestamp with time zone, authority_name text, authority_type text, coverage_sites text, form_purpose text, jurisdiction_category text, cemetery_aliases text, postcode_area text, legacy_confidence text, ai_confidence numeric(5,2), review_status text default 'needs_review'::text not null, ocr_status text default 'not_processed'::text not null, duplicate_status text default 'not_checked'::text not null, active_status text default 'candidate'::text not null, matching_eligible boolean default false not null, human_notes text, confirmed_by uuid, confirmed_at timestamp with time zone, legacy_source_row integer, reconciliation_status text default 'legacy_unreconciled'::text not null, reconciled_at timestamp with time zone, quarantine_reason text, legacy_snapshot jsonb, content_hash text, shared_with_all_organizations boolean default false not null);
create table public.portal_rate_limits (key_hash text not null, window_started_at timestamp with time zone not null, attempts integer not null, blocked_until timestamp with time zone, expires_at timestamp with time zone not null, updated_at timestamp with time zone default now() not null);
create table public.portal_security_events (id bigint generated always as identity not null, event_type text not null, actor_type text not null, success boolean not null, identifier_hash text, ip_hash text not null, user_agent_hash text not null, request_id text, metadata jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null);
create table public.product_addons (id uuid default gen_random_uuid() not null, name text not null, slug text not null, description text, price numeric(10,2) not null, image_url text, display_order integer default 0, is_active boolean default true, created_at timestamp with time zone default now());
create table public.product_categories (id uuid default gen_random_uuid() not null, name text not null, slug text not null, description text, display_order integer default 0, is_active boolean default true, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now());
create table public.product_sizes (id uuid default gen_random_uuid() not null, product_id uuid, size_name text not null, size_code text not null, dimensions text, price_adjustment numeric(10,2) default 0, display_order integer default 0, is_default boolean default false, created_at timestamp with time zone default now());
create table public.products (id uuid default gen_random_uuid() not null, name text not null, slug text not null, description text, short_description text, category_id uuid, supplier_sku text, base_price numeric(10,2) not null, image_url text, gallery_images jsonb, included_features jsonb, inscription_chars_included integer default 80, inscription_price_per_char numeric(4,2) default 2.40, is_active boolean default true, is_featured boolean default false, display_order integer default 0, seo_title text, seo_description text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), sku text, organization_id uuid not null, is_listed boolean default true not null, is_popular boolean default false not null);
create table public.quote_access_tokens (order_id uuid not null, organization_id uuid not null, token_hash text not null, expires_at timestamp with time zone not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.quote_followups (id uuid default gen_random_uuid() not null, thread_id text not null, order_ref text, customer_name text, customer_email text not null, cemetery text, quote_sent_at timestamp with time zone not null, status text default 'pending'::text not null, followup_1_sent_at timestamp with time zone, followup_2_sent_at timestamp with time zone, followup_3_sent_at timestamp with time zone, reply_detected_at timestamp with time zone, thread_message_count integer default 1, ghl_contact_id text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now());
create table public.quotes (id uuid default gen_random_uuid() not null, quote_number bigint default nextval('quotes_quote_number_seq'::regclass) not null, customer_id uuid, partner_id integer, product_name text not null, product_sku text, material text, color text, location text, inscription text, product_config text, value numeric(10,2), permit_cost numeric(10,2), status text default 'draft'::text not null, sent_at timestamp with time zone, accepted_at timestamp with time zone, paid_at timestamp with time zone, expires_at timestamp with time zone, converted_to_order_id uuid, converted_at timestamp with time zone, notes text, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), total_value numeric(10,2) generated always as ((COALESCE(value, (0)::numeric) + COALESCE(permit_cost, (0)::numeric))) stored, enquiry_id uuid, deceased_name text, organization_id uuid not null);
create table public.stone_colours (id uuid default gen_random_uuid() not null, name text not null, slug text not null, hex_primary text not null, hex_secondary text, image_url text, display_order integer default 0, is_active boolean default true, created_at timestamp with time zone default now(), is_premium boolean default false not null, tier text default 'standard'::text not null);
create table public.table_view_presets (id uuid default gen_random_uuid() not null, module text not null, name text not null, config jsonb not null, is_default boolean default false not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.whatsapp_connection_events (id uuid default gen_random_uuid() not null, managed_connection_id uuid not null, user_id uuid not null, actor_type text not null, event_type text not null, previous_status text, new_status text, payload jsonb default '{}'::jsonb not null, request_id text, correlation_id text, occurred_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.whatsapp_connections (id uuid default gen_random_uuid() not null, company_id uuid, user_id uuid not null, provider text default 'twilio'::text not null, twilio_account_sid text not null, twilio_api_key_sid text not null, twilio_api_key_secret_encrypted text not null, whatsapp_from text not null, status text default 'disconnected'::text not null, last_error text, last_validated_at timestamp with time zone, disconnected_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.whatsapp_managed_connections (id uuid default gen_random_uuid() not null, user_id uuid not null, provider text default 'twilio'::text not null, platform_twilio_account_sid text, twilio_sender text, display_number text, label text, state text not null, last_error text, meta jsonb default '{}'::jsonb not null, last_state_change_at timestamp with time zone, connected_at timestamp with time zone, disconnected_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, provider_ready boolean default false not null, organization_id uuid not null);
create table public.whatsapp_user_preferences (user_id uuid not null, preferred_whatsapp_mode text default 'manual'::text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, organization_id uuid not null);
create table public.workflow_slas (organization_id uuid not null, workflow text not null, stage text not null, target_days integer not null, warn_days integer not null, max_days integer not null, updated_at timestamp with time zone default now() not null);
CREATE OR REPLACE FUNCTION public.prune_expired_portal_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.admin_sessions
  where ctid in (
    select ctid from public.admin_sessions
    where expires_at <= pg_catalog.clock_timestamp()
    order by expires_at limit 100
  );

  delete from public.partner_sessions
  where ctid in (
    select ctid from public.partner_sessions
    where expires_at <= pg_catalog.clock_timestamp()
    order by expires_at limit 100
  );

  delete from public.password_reset_tokens
  where ctid in (
    select ctid from public.password_reset_tokens
    where expires_at <= pg_catalog.clock_timestamp()
       or (used and coalesce(used_at, created_at) < pg_catalog.clock_timestamp() - interval '7 days')
    order by expires_at limit 100
  );

  delete from public.customer_portal_tokens
  where ctid in (
    select ctid from public.customer_portal_tokens
    where expires_at <= pg_catalog.clock_timestamp()
    order by expires_at limit 100
  );

  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.change_member_role(p_organization_id uuid, p_user_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_updated integer;
begin
  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to change member roles'
      using errcode = '42501';
  end if;

  v_role := lower(trim(both from p_role));
  if v_role not in ('admin', 'member', 'staff') then
    raise exception 'Role must be admin, member or staff'
      using errcode = 'P0001';
  end if;

  update public.organization_members m
  set role = v_role
  where m.organization_id = p_organization_id
    and m.user_id = p_user_id;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Membership not found for this organisation'
      using errcode = 'P0001';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.prune_expired_order_tracking_tokens()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.order_tracking_tokens
  where ctid in (
    select ctid from public.order_tracking_tokens
    where expires_at <= pg_catalog.clock_timestamp()
    order by expires_at limit 100
  );
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.capture_quote_access_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.order_type = 'quote' and new.edit_token is not null then
    insert into public.quote_access_tokens (
      order_id, organization_id, token_hash, expires_at, created_at, updated_at
    ) values (
      new.id,
      new.organization_id,
      'sha256:' || pg_catalog.encode(extensions.digest(new.edit_token, 'sha256'), 'hex'),
      coalesce(new.created_at, pg_catalog.clock_timestamp()) + interval '90 days',
      coalesce(new.created_at, pg_catalog.clock_timestamp()),
      pg_catalog.clock_timestamp()
    )
    on conflict (order_id) do update set
      organization_id = excluded.organization_id,
      token_hash = excluded.token_hash,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;

    update public.orders set edit_token = null where id = new.id;
  end if;
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.prune_expired_quote_access_tokens()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.quote_access_tokens
  where ctid in (
    select ctid from public.quote_access_tokens
    where expires_at <= pg_catalog.clock_timestamp()
    order by expires_at limit 100
  );
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.prune_partner_magic_links()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.partner_magic_link_tokens
  where ctid in (
    select ctid
    from public.partner_magic_link_tokens
    where expires_at <= pg_catalog.clock_timestamp()
       or consumed_at < pg_catalog.clock_timestamp() - interval '7 days'
    order by expires_at
    limit 100
  );
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_unlinked_messages(p_channel text, p_handle text, p_organization_id uuid)
 RETURNS SETOF inbox_messages
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.*
  from public.inbox_messages as m
  join public.inbox_conversations as c
    on c.id = m.conversation_id
  where public.user_is_member_of_org(p_organization_id)
    and c.organization_id = p_organization_id
    and c.channel = p_channel
    and c.primary_handle = p_handle
    and c.person_id is null
  order by coalesce(m.sent_at, m.created_at) asc, m.created_at asc, m.id asc;
$function$
;
CREATE OR REPLACE FUNCTION public.user_is_admin_of_org(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.organization_members_last_admin_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_org_id uuid;
  v_admin_count_after integer;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.organization_id;

    -- Skip if parent org is being deleted (cascade)
    if not exists (
      select 1
      from public.organizations
      where id = old.organization_id
    ) then
      return old;
    end if;

    select count(*)::integer
      into v_admin_count_after
      from public.organization_members m
      where m.organization_id = v_org_id
        and m.role = 'admin'
        and m.id is distinct from old.id;

    if old.role = 'admin' and v_admin_count_after = 0 then
      raise exception 'Cannot remove the last organisation admin'
        using errcode = 'P0001';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    v_org_id := old.organization_id;

    if old.organization_id is distinct from new.organization_id then
      raise exception 'Cannot change organization_id on organisation membership'
        using errcode = 'P0001';
    end if;

    select
      (
        select count(*)::integer
        from public.organization_members m
        where m.organization_id = v_org_id
          and m.role = 'admin'
          and m.id is distinct from old.id
      )
      + case when new.role = 'admin' then 1 else 0 end
      into v_admin_count_after;

    if v_admin_count_after = 0 then
      raise exception 'Cannot demote the last organisation admin'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enquiries_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.confirm_permit_form_match_v1(p_organization_id uuid, p_order_id uuid, p_permit_form_id uuid, p_expected_order_updated_at timestamp with time zone, p_score numeric, p_reasons jsonb, p_evidence jsonb, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_form public.permit_forms%rowtype;
  v_permit public.order_permits%rowtype;
  v_cemetery public.cemeteries%rowtype;
  v_review_id uuid;
  v_mode text := coalesce(p_evidence ->> 'selectionMode', 'rules_shortlist');
begin
  if v_mode not in ('rules_shortlist', 'manual_search') then raise exception 'Invalid form selection mode'; end if;
  if p_score is null or p_score < 0 or p_score > 100 then raise exception 'Invalid form match score'; end if;
  if nullif(trim(p_reviewer_session_hash), '') is null
     or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then raise exception 'Reviewer session is required'; end if;

  select * into v_order from public.orders
  where id = p_order_id and organization_id = p_organization_id and is_test = false
  for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.permit_order_payment_confirmed_v1(v_order.id) then raise exception 'Order is not payment-confirmed'; end if;
  if v_order.cemetery_id is null then raise exception 'Confirm the cemetery address match first'; end if;
  if p_expected_order_updated_at is not null and v_order.updated_at is distinct from p_expected_order_updated_at then
    raise exception 'Order changed while it was being reviewed';
  end if;

  select * into v_cemetery from public.cemeteries
  where id = v_order.cemetery_id and organization_id = p_organization_id and is_test = false
  for update;
  if not found then raise exception 'Confirmed cemetery not found in this organization'; end if;

  select * into v_form from public.permit_forms
  where id = p_permit_form_id
    and (organization_id = p_organization_id or shared_with_all_organizations = true)
  for update;
  if not found then raise exception 'Permit form not found'; end if;
  if v_form.reconciliation_status not in ('canonical_matched', 'canonical_inserted')
     or v_form.active_status in ('inactive', 'quarantined', 'superseded', 'source_missing')
     or v_form.google_drive_file_id is null then
    raise exception 'Permit form is not an active canonical Drive form';
  end if;

  if v_order.permit_form_id is not null and v_order.permit_form_id <> p_permit_form_id then
    raise exception 'Order already has a different permit form';
  end if;

  update public.permit_forms
  set review_status = 'confirmed', matching_eligible = true, active_status = 'active',
      shared_with_all_organizations = true,
      confirmed_at = coalesce(confirmed_at, now()), updated_at = now()
  where id = v_form.id;

  if v_cemetery.permit_form_id is null then
    update public.cemeteries
    set permit_form_id = v_form.id,
        permit_form_assigned_at = now(),
        permit_form_assigned_by = left(p_reviewer_session_hash, 64),
        updated_at = now()
    where id = v_cemetery.id;
  elsif v_cemetery.permit_form_id <> v_form.id then
    raise exception 'Cemetery already has a different default permit form';
  end if;

  if v_order.permit_form_id is null then
    update public.orders set permit_form_id = v_form.id, updated_at = now() where id = v_order.id;

    insert into public.order_permits (
      organization_id, order_id, permit_form_id, cemetery_id,
      permit_phase, next_action, waiting_on, stage_entered_at, next_action_at
    ) values (
      p_organization_id, v_order.id, v_form.id, v_order.cemetery_id,
      'select_form', 'review_send_customer', 'sears_melvin', now(), now()
    )
    on conflict (organization_id, order_id) do update set
      permit_form_id = excluded.permit_form_id,
      cemetery_id = excluded.cemetery_id,
      next_action = case when public.order_permits.permit_phase = 'select_form' then 'review_send_customer' else public.order_permits.next_action end,
      waiting_on = case when public.order_permits.permit_phase = 'select_form' then 'sears_melvin' else public.order_permits.waiting_on end,
      next_action_at = case when public.order_permits.permit_phase = 'select_form' then now() else public.order_permits.next_action_at end,
      state_version = public.order_permits.state_version + 1,
      updated_at = now()
    returning * into v_permit;

    insert into public.permit_form_match_reviews (
      organization_id, order_id, permit_form_id, previous_permit_form_id,
      decision, selection_mode, score, reasons, evidence, reviewer_session_hash
    ) values (
      p_organization_id, v_order.id, v_form.id, null, 'confirmed', v_mode, p_score,
      coalesce(p_reasons, '[]'::jsonb), coalesce(p_evidence, '{}'::jsonb), left(p_reviewer_session_hash, 64)
    ) returning id into v_review_id;

    insert into public.order_events (order_id, event_type, summary, detail)
    values (
      v_order.id, 'permit_form_confirmed', 'Permit form confirmed and linked',
      jsonb_build_object(
        'permitId', v_permit.id, 'permitFormId', v_form.id,
        'cemeteryId', v_order.cemetery_id, 'googleDriveFileId', v_form.google_drive_file_id,
        'formName', coalesce(v_form.proposed_clean_name, v_form.name),
        'matchScore', p_score, 'matchReasons', coalesce(p_reasons, '[]'::jsonb),
        'selectionMode', v_mode, 'paymentConfirmedAtReview', true,
        'reviewId', v_review_id, 'emailSent', false,
        'stage', v_permit.permit_phase, 'nextAction', v_permit.next_action
      )
    );
  else
    update public.order_permits
    set cemetery_id = v_order.cemetery_id,
        permit_form_id = v_form.id,
        updated_at = now()
    where organization_id = p_organization_id and order_id = v_order.id
    returning * into v_permit;
  end if;

  return jsonb_build_object(
    'orderId', v_order.id, 'permitId', v_permit.id,
    'permitFormId', v_form.id, 'cemeteryId', v_order.cemetery_id,
    'reviewId', v_review_id, 'alreadyLinked', v_order.permit_form_id is not null,
    'formalStage', coalesce(v_permit.permit_phase, 'select_form'),
    'currentActionType', coalesce(v_permit.next_action, 'review_send_customer'),
    'waitingOn', coalesce(v_permit.waiting_on, 'sears_melvin'),
    'stateVersion', v_permit.state_version
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.user_is_member_of_org(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = (select auth.uid())
  );
$function$
;
CREATE OR REPLACE FUNCTION public.delete_organization(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Must be authenticated to delete an organisation'
      using errcode = '28000';
  end if;

  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to delete this organisation'
      using errcode = '42501';
  end if;

  delete from public.organizations o
  where o.id = p_organization_id;

  if not found then
    raise exception 'Organisation not found'
      using errcode = 'P0001';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_conversation_directional_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.direction = 'inbound' then
    update public.inbox_conversations
      set last_inbound_at = greatest(coalesce(last_inbound_at, new.sent_at), new.sent_at)
      where id = new.conversation_id;
  elsif new.direction = 'outbound' then
    update public.inbox_conversations
      set last_outbound_at = greatest(coalesce(last_outbound_at, new.sent_at), new.sent_at)
      where id = new.conversation_id;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_customer_messages(p_person_id uuid, p_organization_id uuid)
 RETURNS SETOF inbox_messages
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.*
  from public.inbox_messages as m
  join public.inbox_conversations as c
    on c.id = m.conversation_id
  where public.user_is_member_of_org(p_organization_id)
    and c.person_id = p_person_id
    and c.organization_id = p_organization_id
  order by coalesce(m.sent_at, m.created_at) asc, m.created_at asc, m.id asc;
$function$
;
CREATE OR REPLACE FUNCTION public.get_next_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is not null
     and not public.user_has_organization() then
    raise exception 'Organisation membership is required'
      using errcode = '42501';
  end if;
  return 'INV-' || pg_catalog.lpad(
    pg_catalog.nextval('public.invoice_number_seq'::pg_catalog.regclass)::text,
    6,
    '0'
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.permit_order_payment_confirmed_v1(p_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.is_test = false
      and (
        exists (
          select 1
          from public.invoices i
          where i.order_id = o.id
            and i.deleted_at is null
            and i.is_test = false
            and (
              lower(coalesce(i.status, '')) = 'paid'
              or lower(coalesce(i.stripe_status, '')) = 'paid'
            )
        )
        or exists (
          select 1
          from public.order_payments p
          where p.order_id = o.id
            and lower(coalesce(p.status, '')) in ('matched', 'confirmed', 'paid')
        )
        or exists (
          select 1
          from public.jobs j
          where j.id = o.job_id
            and (
              j.paid_at is not null
              or lower(coalesce(j.stage, '')) in (
                'confirmed', 'in_production', 'fixed', 'complete'
              )
            )
        )
        or o.deposit_date is not null
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.initialize_confirmed_permit_workflow_v1(p_organization_id uuid, p_order_id uuid, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_permit public.order_permits%rowtype;
  v_created boolean := false;
  v_action text;
begin
  if nullif(trim(p_reviewer_session_hash), '') is null
     or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Reviewer session is required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and organization_id = p_organization_id
    and is_test = false
  for update;

  if not found then raise exception 'Order not found'; end if;
  if not public.permit_order_payment_confirmed_v1(v_order.id) then
    raise exception 'Order is not payment-confirmed';
  end if;

  v_action := case
    when v_order.permit_form_id is null then 'match_form'
    else 'review_send_customer'
  end;

  insert into public.order_permits (
    organization_id, order_id, permit_form_id, cemetery_id,
    permit_phase, next_action, waiting_on
  ) values (
    p_organization_id, v_order.id, v_order.permit_form_id, v_order.cemetery_id,
    'select_form', v_action, 'sears_melvin'
  )
  on conflict (organization_id, order_id) do nothing
  returning * into v_permit;

  if found then
    v_created := true;
    insert into public.order_events (order_id, event_type, summary, detail)
    values (
      v_order.id,
      'permit_workflow_initialized',
      'Confirmed-order permit workflow initialized',
      jsonb_build_object(
        'permitId', v_permit.id,
        'stage', v_permit.permit_phase,
        'nextAction', v_permit.next_action,
        'paymentConfirmedAtInitialization', true,
        'reviewerSessionHash', left(p_reviewer_session_hash, 64)
      )
    );
  else
    select * into strict v_permit
    from public.order_permits
    where organization_id = p_organization_id
      and order_id = v_order.id;
  end if;

  return jsonb_build_object(
    'permitId', v_permit.id,
    'orderId', v_permit.order_id,
    'created', v_created,
    'formalStage', v_permit.permit_phase,
    'currentActionType', v_permit.next_action,
    'waitingOn', v_permit.waiting_on,
    'stageEnteredAt', v_permit.stage_entered_at,
    'actionReadyAt', v_permit.next_action_at,
    'stateVersion', v_permit.state_version
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.record_permit_customer_sent_v1(p_organization_id uuid, p_order_id uuid, p_expected_state_version integer, p_external_message_ref text, p_sent_at timestamp with time zone, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_permit public.order_permits%rowtype;
  v_sent_at timestamptz := coalesce(p_sent_at, now());
begin
  if nullif(trim(p_reviewer_session_hash), '') is null
     or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Reviewer session is required';
  end if;
  if nullif(trim(p_external_message_ref), '') is null
     or p_external_message_ref !~ '^(gmail|ghl):.+' then
    raise exception 'A Gmail or HighLevel message reference is required';
  end if;
  if p_expected_state_version is null or p_expected_state_version < 1 then
    raise exception 'A current permit state version is required';
  end if;
  if v_sent_at > now() + interval '5 minutes' then
    raise exception 'Customer send time is invalid';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and organization_id = p_organization_id
    and is_test = false
  for update;

  if not found then raise exception 'Order not found'; end if;
  if not public.permit_order_payment_confirmed_v1(v_order.id) then
    raise exception 'Order is not payment-confirmed';
  end if;
  if v_order.permit_form_id is null then
    raise exception 'A confirmed permit form is required';
  end if;

  select * into v_permit
  from public.order_permits
  where organization_id = p_organization_id
    and order_id = v_order.id
  for update;

  if not found then raise exception 'Permit workflow not found'; end if;
  if v_permit.sent_at is not null then
    return jsonb_build_object(
      'permitId', v_permit.id,
      'orderId', v_permit.order_id,
      'alreadyRecorded', true,
      'formalStage', v_permit.permit_phase,
      'stateVersion', v_permit.state_version
    );
  end if;
  if v_permit.state_version <> p_expected_state_version then
    raise exception 'Permit changed while it was being reviewed';
  end if;
  if v_permit.permit_phase <> 'select_form'
     or v_permit.next_action <> 'review_send_customer' then
    raise exception 'Permit is not ready for customer sending';
  end if;

  update public.order_permits
  set permit_phase = 'with_customer',
      next_action = 'wait_customer_return',
      waiting_on = 'customer',
      stage_entered_at = v_sent_at,
      next_action_at = v_sent_at + interval '14 days',
      sent_via = 'email',
      sent_at = v_sent_at,
      state_version = state_version + 1,
      updated_at = now()
  where id = v_permit.id
  returning * into v_permit;

  insert into public.order_events (order_id, event_type, summary, detail)
  values (
    v_order.id,
    'permit_customer_sent',
    'Permit form sent to customer',
    jsonb_build_object(
      'permitId', v_permit.id,
      'permitFormId', v_order.permit_form_id,
      'externalMessageRef', trim(p_external_message_ref),
      'sentAt', v_sent_at,
      'stage', v_permit.permit_phase,
      'nextAction', v_permit.next_action,
      'nextActionAt', v_permit.next_action_at,
      'reviewerSessionHash', left(p_reviewer_session_hash, 64)
    )
  );

  return jsonb_build_object(
    'permitId', v_permit.id,
    'orderId', v_permit.order_id,
    'alreadyRecorded', false,
    'formalStage', v_permit.permit_phase,
    'currentActionType', v_permit.next_action,
    'waitingOn', v_permit.waiting_on,
    'nextActionAt', v_permit.next_action_at,
    'stateVersion', v_permit.state_version
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reserve_permit_customer_send_v1(p_organization_id uuid, p_order_id uuid, p_expected_state_version integer, p_provider text, p_idempotency_key uuid, p_recipient_fingerprint text, p_payload_fingerprint text, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_permit public.order_permits%rowtype;
  v_delivery public.permit_email_deliveries%rowtype;
begin
  if nullif(trim(p_reviewer_session_hash), '') is null
     or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Reviewer session is required';
  end if;
  if p_provider not in ('ghl', 'gmail') then
    raise exception 'Email provider is invalid';
  end if;
  if p_expected_state_version is null or p_expected_state_version < 1 then
    raise exception 'A current permit state version is required';
  end if;
  if p_recipient_fingerprint !~ '^[0-9a-f]{64}$'
     or p_payload_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Email fingerprints are invalid';
  end if;

  select * into v_delivery
  from public.permit_email_deliveries
  where idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_delivery.organization_id <> p_organization_id
       or v_delivery.order_id <> p_order_id
       or v_delivery.state_version <> p_expected_state_version
       or v_delivery.provider <> p_provider
       or v_delivery.recipient_fingerprint <> p_recipient_fingerprint
       or v_delivery.payload_fingerprint <> p_payload_fingerprint then
      raise exception 'Idempotency key was already used for a different send';
    end if;
    return jsonb_build_object(
      'deliveryId', v_delivery.id,
      'status', v_delivery.status,
      'provider', v_delivery.provider,
      'alreadyReserved', true,
      'providerMessageId', v_delivery.provider_message_id,
      'providerThreadId', v_delivery.provider_thread_id,
      'sentAt', v_delivery.sent_at
    );
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and organization_id = p_organization_id
    and is_test = false
  for update;

  if not found then raise exception 'Order not found'; end if;
  if not public.permit_order_payment_confirmed_v1(v_order.id) then
    raise exception 'Order is not payment-confirmed';
  end if;
  if v_order.permit_form_id is null then
    raise exception 'A confirmed permit form is required';
  end if;

  select * into v_permit
  from public.order_permits
  where organization_id = p_organization_id
    and order_id = v_order.id
  for update;

  if not found then raise exception 'Permit workflow not found'; end if;
  if v_permit.state_version <> p_expected_state_version then
    raise exception 'Permit changed while it was being reviewed';
  end if;
  if v_permit.sent_at is not null
     or v_permit.permit_phase <> 'select_form'
     or v_permit.next_action <> 'review_send_customer' then
    raise exception 'Permit is not ready for customer sending';
  end if;

  select * into v_delivery
  from public.permit_email_deliveries
  where organization_id = p_organization_id
    and order_id = p_order_id
    and state_version = p_expected_state_version
    and status in ('reserved', 'sent', 'uncertain')
  order by created_at desc
  limit 1
  for update;

  if found then
    raise exception 'A send already exists or needs reconciliation for this permit state';
  end if;

  insert into public.permit_email_deliveries (
    idempotency_key,
    organization_id,
    order_id,
    permit_id,
    state_version,
    provider,
    recipient_fingerprint,
    payload_fingerprint
  ) values (
    p_idempotency_key,
    p_organization_id,
    p_order_id,
    v_permit.id,
    p_expected_state_version,
    p_provider,
    p_recipient_fingerprint,
    p_payload_fingerprint
  )
  returning * into v_delivery;

  return jsonb_build_object(
    'deliveryId', v_delivery.id,
    'status', v_delivery.status,
    'provider', v_delivery.provider,
    'alreadyReserved', false
  );
exception
  when unique_violation then
    raise exception 'A send already exists or needs reconciliation for this permit state';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.complete_permit_customer_send_v1(p_delivery_id uuid, p_provider_message_id text, p_provider_thread_id text, p_sent_at timestamp with time zone, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_delivery public.permit_email_deliveries%rowtype;
  v_workflow jsonb;
  v_sent_at timestamptz := coalesce(p_sent_at, now());
begin
  if nullif(trim(p_reviewer_session_hash), '') is null
     or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Reviewer session is required';
  end if;
  if nullif(trim(p_provider_message_id), '') is null
     or length(trim(p_provider_message_id)) > 500 then
    raise exception 'A provider message ID is required';
  end if;
  if v_sent_at > now() + interval '5 minutes' then
    raise exception 'Customer send time is invalid';
  end if;

  select * into v_delivery
  from public.permit_email_deliveries
  where id = p_delivery_id
  for update;

  if not found then raise exception 'Email delivery reservation not found'; end if;
  if v_delivery.status = 'sent' then
    return jsonb_build_object(
      'deliveryId', v_delivery.id,
      'status', v_delivery.status,
      'provider', v_delivery.provider,
      'alreadyCompleted', true,
      'workflow', null
    );
  end if;
  if v_delivery.status <> 'reserved' then
    raise exception 'Email delivery is not reserved';
  end if;

  v_workflow := public.record_permit_customer_sent_v1(
    v_delivery.organization_id,
    v_delivery.order_id,
    v_delivery.state_version,
    v_delivery.provider || ':' || trim(p_provider_message_id),
    v_sent_at,
    p_reviewer_session_hash
  );

  update public.permit_email_deliveries
  set status = 'sent',
      provider_message_id = trim(p_provider_message_id),
      provider_thread_id = nullif(left(trim(coalesce(p_provider_thread_id, '')), 500), ''),
      error_code = null,
      sent_at = v_sent_at,
      updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  return jsonb_build_object(
    'deliveryId', v_delivery.id,
    'status', v_delivery.status,
    'provider', v_delivery.provider,
    'alreadyCompleted', false,
    'workflow', v_workflow
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.fail_permit_customer_send_v1(p_delivery_id uuid, p_uncertain boolean, p_error_code text, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_delivery public.permit_email_deliveries%rowtype;
begin
  if nullif(trim(p_reviewer_session_hash), '') is null
     or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Reviewer session is required';
  end if;

  select * into v_delivery
  from public.permit_email_deliveries
  where id = p_delivery_id
  for update;

  if not found then raise exception 'Email delivery reservation not found'; end if;
  if v_delivery.status = 'sent' then
    raise exception 'A sent delivery cannot be failed';
  end if;

  update public.permit_email_deliveries
  set status = case when coalesce(p_uncertain, true) then 'uncertain' else 'failed' end,
      error_code = nullif(left(trim(coalesce(p_error_code, 'provider_error')), 160), ''),
      updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  return jsonb_build_object(
    'deliveryId', v_delivery.id,
    'status', v_delivery.status,
    'provider', v_delivery.provider
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_cemetery_permit_contact_assignment_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.permit_contact_id is not null
        or new.permit_contact_assigned_at is not null
        or new.permit_contact_assigned_by is not null
      then
        raise exception 'Permit contact assignment is service-only';
      end if;
    elsif new.permit_contact_id is distinct from old.permit_contact_id
      or new.permit_contact_assigned_at is distinct from old.permit_contact_assigned_at
      or new.permit_contact_assigned_by is distinct from old.permit_contact_assigned_by
    then
      raise exception 'Permit contact assignment is service-only';
    end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.upsert_permit_contacts_v1(p_contacts jsonb, p_source_system text, p_source_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_received integer;
  v_upserted integer;
begin
  if jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'p_contacts must be a JSON array';
  end if;

  v_received := jsonb_array_length(p_contacts);
  if v_received > 5000 then
    raise exception 'Contact import exceeds 5000 rows';
  end if;

  if nullif(btrim(p_source_system), '') is null then
    raise exception 'p_source_system is required';
  end if;

  with raw as (
    select value as record
    from jsonb_array_elements(p_contacts)
  ),
  prepared as (
    select
      lower(btrim(coalesce(record->>'normalized_email', record->>'email'))) as email,
      nullif(btrim(coalesce(record->>'name', record->>'authority_or_display_name')), '') as name,
      nullif(btrim(record->>'role'), '') as role,
      nullif(btrim(record->>'phone'), '') as phone,
      case
        when record->>'category' in ('gov_uk', 'church_parish', 'other_official')
          then record->>'category'
        else 'other_official'
      end as category,
      coalesce((record->>'is_generic_inbox')::boolean, false) as is_generic_inbox,
      case
        when record->>'validation_status' in (
          'validated_inbound',
          'validated_two_way',
          'mentioned_only',
          'outbound_only',
          'delivery_failed',
          'legacy_assigned',
          'unverified'
        ) then record->>'validation_status'
        else 'unverified'
      end as validation_status,
      nullif(record->>'validation_basis', '') as validation_basis,
      nullif(record->>'validated_at', '')::timestamptz as validated_at,
      nullif(record->>'first_seen', '')::timestamptz as first_seen_at,
      nullif(record->>'last_seen', '')::timestamptz as last_seen_at,
      coalesce((record->>'inbound_count')::integer, 0) as inbound_count,
      coalesce((record->>'outbound_count')::integer, 0) as outbound_count,
      coalesce((record->>'direct_header_count')::integer, 0) as direct_header_count,
      coalesce((record->>'body_mention_count')::integer, 0) as body_mention_count,
      coalesce((record->>'bounce_count')::integer, 0) as bounce_count,
      nullif(record->>'last_bounce_at', '')::timestamptz as last_bounce_at,
      jsonb_strip_nulls(jsonb_build_object(
        'domain', record->>'domain',
        'evidence_terms', record->'evidence_terms',
        'message_count', coalesce((record->>'message_count')::integer, 0),
        'review_note', record->>'review_note',
        'validated', coalesce((record->>'validated')::boolean, false)
      )) as source_metadata
    from raw
  ),
  valid as (
    select *
    from prepared
    where position('@' in email) > 1
      and position('.' in split_part(email, '@', 2)) > 1
  )
  insert into public.permit_contacts (
    email,
    name,
    role,
    phone,
    category,
    is_generic_inbox,
    validation_status,
    validation_basis,
    validated_at,
    first_seen_at,
    last_seen_at,
    inbound_count,
    outbound_count,
    direct_header_count,
    body_mention_count,
    bounce_count,
    last_bounce_at,
    source_system,
    source_ref,
    source_metadata,
    active
  )
  select
    v.email,
    v.name,
    v.role,
    v.phone,
    v.category,
    v.is_generic_inbox,
    v.validation_status,
    v.validation_basis,
    v.validated_at,
    v.first_seen_at,
    v.last_seen_at,
    v.inbound_count,
    v.outbound_count,
    v.direct_header_count,
    v.body_mention_count,
    v.bounce_count,
    v.last_bounce_at,
    btrim(p_source_system),
    nullif(btrim(p_source_ref), ''),
    v.source_metadata,
    v.validation_status <> 'delivery_failed'
  from valid v
  on conflict (normalized_email) do update
  set
    email = excluded.email,
    name = coalesce(excluded.name, public.permit_contacts.name),
    role = coalesce(excluded.role, public.permit_contacts.role),
    phone = coalesce(excluded.phone, public.permit_contacts.phone),
    category = excluded.category,
    is_generic_inbox = excluded.is_generic_inbox,
    validation_status = excluded.validation_status,
    validation_basis = excluded.validation_basis,
    validated_at = excluded.validated_at,
    first_seen_at = case
      when public.permit_contacts.first_seen_at is null then excluded.first_seen_at
      when excluded.first_seen_at is null then public.permit_contacts.first_seen_at
      else least(public.permit_contacts.first_seen_at, excluded.first_seen_at)
    end,
    last_seen_at = case
      when public.permit_contacts.last_seen_at is null then excluded.last_seen_at
      when excluded.last_seen_at is null then public.permit_contacts.last_seen_at
      else greatest(public.permit_contacts.last_seen_at, excluded.last_seen_at)
    end,
    inbound_count = excluded.inbound_count,
    outbound_count = excluded.outbound_count,
    direct_header_count = excluded.direct_header_count,
    body_mention_count = excluded.body_mention_count,
    bounce_count = excluded.bounce_count,
    last_bounce_at = excluded.last_bounce_at,
    source_system = excluded.source_system,
    source_ref = excluded.source_ref,
    source_metadata = public.permit_contacts.source_metadata || excluded.source_metadata,
    active = case
      when excluded.validation_status = 'delivery_failed' then false
      else public.permit_contacts.active
    end,
    updated_at = now();

  get diagnostics v_upserted = row_count;

  return jsonb_build_object(
    'received', v_received,
    'upserted', v_upserted,
    'skipped', v_received - v_upserted
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_ghl_api_key(p_connection_id uuid, p_encryption_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  encrypted bytea;
begin
  if p_encryption_key is null or length(trim(p_encryption_key)) = 0 then
    raise exception 'encryption_key is required';
  end if;

  select c.ghl_api_key into encrypted
  from public.ghl_connections as c
  where c.id = p_connection_id;

  if encrypted is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(encrypted, p_encryption_key);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.resolve_cemetery_permit_contact_v1(p_organization_id uuid, p_cemetery_id uuid)
 RETURNS TABLE(cemetery_id uuid, organization_id uuid, permit_contact_id uuid, email text, contact_name text, category text, is_generic_inbox boolean, validation_status text, validated_at timestamp with time zone, source_system text, source_ref text, can_prepare boolean, block_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    c.id,
    c.organization_id,
    pc.id,
    pc.email,
    pc.name,
    pc.category,
    pc.is_generic_inbox,
    pc.validation_status,
    pc.validated_at,
    pc.source_system,
    pc.source_ref,
    case
      when pc.id is null then false
      when not pc.active or pc.validation_status = 'delivery_failed' then false
      else true
    end,
    case
      when pc.id is null then 'recipient_not_assigned'
      when not pc.active or pc.validation_status = 'delivery_failed' then 'recipient_unavailable'
      else null
    end
  from public.cemeteries c
  left join public.permit_contacts pc on pc.id = c.permit_contact_id
  where c.id = p_cemetery_id
    and c.organization_id = p_organization_id;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_sync_enquiry_to_inbox()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.create_inbox_from_enquiry(new.id);
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_conversations(p_conversation_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid;
  v_ids uuid[];
  v_ids_len integer;
  v_distinct_len integer;
  v_deleted_count integer := 0;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Must be authenticated to delete conversations'
      using errcode = '28000';
  end if;

  v_ids := coalesce(p_conversation_ids, '{}'::uuid[]);
  v_ids_len := coalesce(array_length(v_ids, 1), 0);

  if v_ids_len = 0 then
    raise exception 'At least one conversation id is required'
      using errcode = 'P0001';
  end if;

  if v_ids_len > 50 then
    raise exception 'Cannot delete more than 50 conversations at once'
      using errcode = 'P0001';
  end if;

  select count(distinct t.id)::integer
    into v_distinct_len
    from unnest(v_ids) as t(id);

  if v_distinct_len <> v_ids_len then
    raise exception 'Conversation id list contains duplicates'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as t(id)
    left join public.inbox_conversations c on c.id = t.id
    where c.id is null
  ) then
    raise exception 'One or more conversations were not found'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.inbox_conversations c
    where c.id = any(v_ids)
      and not (select public.user_is_member_of_org(c.organization_id))
  ) then
    raise exception 'Cannot delete conversations outside your organisation access'
      using errcode = '42501';
  end if;

  delete from public.inbox_conversations c
  where c.id = any(v_ids);

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_cemetery_permit_form_assignment_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.permit_form_id is not null
        or new.permit_form_assigned_at is not null
        or new.permit_form_assigned_by is not null
      then
        raise exception 'Permit form assignment is service-only';
      end if;
    elsif new.permit_form_id is distinct from old.permit_form_id
      or new.permit_form_assigned_at is distinct from old.permit_form_assigned_at
      or new.permit_form_assigned_by is distinct from old.permit_form_assigned_by
    then
      raise exception 'Permit form assignment is service-only';
    end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.confirm_order_cemetery_match_v1(p_organization_id uuid, p_order_id uuid, p_candidate_cemetery_id uuid, p_create_from_address boolean, p_expected_order_updated_at timestamp with time zone, p_score numeric, p_reasons jsonb, p_evidence jsonb, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_source public.cemeteries%rowtype;
  v_target public.cemeteries%rowtype;
  v_permit public.order_permits%rowtype;
  v_review_id uuid;
  v_mode text := coalesce(p_evidence ->> 'selectionMode', 'rules_shortlist');
  v_primary_name text;
  v_postcode text;
  v_slug text;
begin
  if v_mode not in ('rules_shortlist', 'manual_search', 'create_from_address') then
    raise exception 'Invalid cemetery selection mode';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'Invalid cemetery match score';
  end if;
  if nullif(trim(p_reviewer_session_hash), '') is null
     or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Reviewer session is required';
  end if;
  if coalesce(p_create_from_address, false) = (p_candidate_cemetery_id is not null) then
    raise exception 'Choose an existing cemetery or create one from the order address';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and organization_id = p_organization_id
    and is_test = false
  for update;

  if not found then raise exception 'Order not found'; end if;
  if not public.permit_order_payment_confirmed_v1(v_order.id) then
    raise exception 'Order is not payment-confirmed';
  end if;
  if nullif(trim(v_order.location), '') is null then
    raise exception 'Order cemetery address is required';
  end if;
  if p_expected_order_updated_at is not null
     and v_order.updated_at is distinct from p_expected_order_updated_at then
    raise exception 'Order changed while it was being reviewed';
  end if;

  if v_order.cemetery_id is not null then
    if p_candidate_cemetery_id = v_order.cemetery_id then
      return jsonb_build_object(
        'orderId', v_order.id,
        'cemeteryId', v_order.cemetery_id,
        'alreadyLinked', true
      );
    end if;
    raise exception 'Order already has a different cemetery';
  end if;

  v_postcode := upper(substring(v_order.location from '([A-Z]{1,2}[0-9][A-Z0-9]?[[:space:]]*[0-9][A-Z]{2})'));
  if v_postcode is not null then
    v_postcode := regexp_replace(v_postcode, '[[:space:]]+', ' ', 'g');
  end if;

  if p_candidate_cemetery_id is not null then
    select * into v_source
    from public.cemeteries
    where id = p_candidate_cemetery_id
      and is_test = false
      and is_active is distinct from false
    for update;

    if not found then raise exception 'Cemetery candidate not found'; end if;

    if v_source.organization_id = p_organization_id then
      v_target := v_source;
      if v_target.address is null or v_target.postcode is null then
        update public.cemeteries
        set address = coalesce(address, v_order.location),
            postcode = coalesce(postcode, v_postcode),
            updated_at = now()
        where id = v_target.id
        returning * into v_target;
      end if;
    else
      select * into v_target
      from public.cemeteries c
      where c.organization_id = p_organization_id
        and c.is_test = false
        and lower(trim(c.name)) = lower(trim(v_source.name))
        and (
          nullif(trim(c.postcode), '') is null
          or nullif(trim(v_source.postcode), '') is null
          or upper(replace(c.postcode, ' ', '')) = upper(replace(v_source.postcode, ' ', ''))
        )
      order by c.updated_at desc
      limit 1
      for update;

      if not found then
        v_slug := left(
          regexp_replace(lower(v_source.slug), '[^a-z0-9-]+', '-', 'g')
          || '-' || substr(replace(p_organization_id::text, '-', ''), 1, 8)
          || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
          120
        );
        insert into public.cemeteries (
          slug, name, area, region, postcode,
          kerb_allowed, lawn_section, cremation_section,
          permit_fee, processing_weeks, installed_count, note,
          is_active, display_order, address, latitude, longitude,
          governing_body, governing_body_type, country, organization_id,
          max_height_mm, max_width_mm, allowed_typefaces,
          regulation_notes, primary_email, phone, avg_approval_days, notes,
          is_test, permit_contact_id, permit_contact_assigned_at,
          permit_contact_assigned_by, permit_form_id,
          permit_form_assigned_at, permit_form_assigned_by
        ) values (
          v_slug, v_source.name, v_source.area, v_source.region,
          coalesce(v_source.postcode, v_postcode),
          v_source.kerb_allowed, v_source.lawn_section, v_source.cremation_section,
          v_source.permit_fee, v_source.processing_weeks, v_source.installed_count, v_source.note,
          true, v_source.display_order, coalesce(v_source.address, v_order.location),
          v_source.latitude, v_source.longitude,
          v_source.governing_body, v_source.governing_body_type, v_source.country,
          p_organization_id, v_source.max_height_mm, v_source.max_width_mm,
          v_source.allowed_typefaces, v_source.regulation_notes,
          v_source.primary_email, v_source.phone, v_source.avg_approval_days,
          v_source.notes, false, v_source.permit_contact_id,
          case when v_source.permit_contact_id is null then null else now() end,
          case when v_source.permit_contact_id is null then null else 'cemetery_match_copy' end,
          v_source.permit_form_id,
          case when v_source.permit_form_id is null then null else now() end,
          case when v_source.permit_form_id is null then null else 'cemetery_match_copy' end
        ) returning * into v_target;
      end if;
    end if;
  else
    v_primary_name := trim(split_part(v_order.location, ',', 1));
    if v_primary_name !~* '\m(cemetery|cemetry|crematorium|churchyard|burial[[:space:]]+ground)\M'
       or length(v_primary_name) < 8 then
      raise exception 'The order address does not contain a clear cemetery name';
    end if;
    v_primary_name := regexp_replace(v_primary_name, '\mcemetry\M', 'Cemetery', 'i');
    v_slug := left(
      regexp_replace(lower(v_primary_name), '[^a-z0-9]+', '-', 'g')
      || '-' || substr(replace(p_organization_id::text, '-', ''), 1, 8)
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
      120
    );

    insert into public.cemeteries (
      slug, name, area, region, postcode, address, country,
      organization_id, is_active, is_test
    ) values (
      v_slug,
      v_primary_name,
      v_primary_name,
      'Unclassified',
      v_postcode,
      v_order.location,
      'England',
      p_organization_id,
      true,
      false
    ) returning * into v_target;
  end if;

  update public.orders
  set cemetery_id = v_target.id,
      updated_at = now()
  where id = v_order.id;

  update public.order_permits
  set cemetery_id = v_target.id,
      state_version = state_version + 1,
      updated_at = now()
  where organization_id = p_organization_id
    and order_id = v_order.id
  returning * into v_permit;

  insert into public.cemetery_match_reviews (
    organization_id, order_id, source_cemetery_id, resolved_cemetery_id,
    selection_mode, score, reasons, evidence, reviewer_session_hash
  ) values (
    p_organization_id, v_order.id, p_candidate_cemetery_id, v_target.id,
    v_mode, p_score, coalesce(p_reasons, '[]'::jsonb),
    coalesce(p_evidence, '{}'::jsonb), left(p_reviewer_session_hash, 64)
  ) returning id into v_review_id;

  insert into public.order_events (order_id, event_type, summary, detail)
  values (
    v_order.id,
    'cemetery_match_confirmed',
    'Cemetery address match confirmed',
    jsonb_build_object(
      'cemeteryId', v_target.id,
      'sourceCemeteryId', p_candidate_cemetery_id,
      'cemeteryName', v_target.name,
      'orderAddress', v_order.location,
      'matchScore', p_score,
      'matchReasons', coalesce(p_reasons, '[]'::jsonb),
      'selectionMode', v_mode,
      'reviewId', v_review_id,
      'emailSent', false
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'cemeteryId', v_target.id,
    'cemeteryName', v_target.name,
    'permitContactId', v_target.permit_contact_id,
    'permitFormId', v_target.permit_form_id,
    'reviewId', v_review_id,
    'organizationCopyCreated', v_source.id is not null and v_source.organization_id <> p_organization_id and v_source.id <> v_target.id,
    'stateVersion', v_permit.state_version,
    'alreadyLinked', false
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.register_permit_document_v1(p_organization_id uuid, p_order_id uuid, p_document_role text, p_google_drive_file_id text, p_document_url text, p_file_name text, p_mime_type text, p_source_ref text, p_evidence jsonb, p_expected_state_version integer, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_permit public.order_permits%rowtype;
  v_document public.permit_documents%rowtype;
  v_now timestamptz := now();
begin
  if p_document_role not in ('customer_return', 'completed_application') then raise exception 'Document role is invalid'; end if;
  if p_google_drive_file_id !~ '^[A-Za-z0-9_-]{10,200}$' then raise exception 'Google Drive file ID is invalid'; end if;
  if p_document_url !~ '^https://drive[.]google[.]com/' then raise exception 'Google Drive document URL is required'; end if;
  if nullif(trim(p_file_name), '') is null or length(trim(p_file_name)) > 240 then raise exception 'File name is invalid'; end if;
  if p_mime_type not in (
    'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-apps.document', 'image/jpeg', 'image/png'
  ) then raise exception 'Document type is not supported'; end if;
  if p_expected_state_version is null or p_expected_state_version < 1 then raise exception 'A current permit state version is required'; end if;
  if nullif(trim(p_reviewer_session_hash), '') is null or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Reviewer session is required';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and organization_id = p_organization_id and is_test = false
  for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.permit_order_payment_confirmed_v1(v_order.id) then raise exception 'Order is not payment-confirmed'; end if;
  if v_order.cemetery_id is null or v_order.permit_form_id is null then raise exception 'Confirmed cemetery and permit form are required'; end if;

  select * into v_permit from public.order_permits
  where organization_id = p_organization_id and order_id = v_order.id
  for update;
  if not found then raise exception 'Permit workflow not found'; end if;
  if v_permit.state_version <> p_expected_state_version then raise exception 'Permit changed while it was being reviewed'; end if;

  if p_document_role = 'customer_return' then
    if v_permit.permit_phase not in ('with_customer', 'check_return') then raise exception 'Permit is not ready for customer-return validation'; end if;
    if coalesce((p_evidence ->> 'signatureConfirmed')::boolean, false) is not true
       or nullif(trim(p_evidence ->> 'graveOwnerName'), '') is null then
      raise exception 'Grave-owner name and visible signature confirmation are required';
    end if;
  else
    if v_permit.permit_phase <> 'complete_form' then raise exception 'Permit is not ready for a completed application'; end if;
    if coalesce((p_evidence ->> 'memorialDetailsConfirmed')::boolean, false) is not true
       or coalesce((p_evidence ->> 'fixingDetailsConfirmed')::boolean, false) is not true then
      raise exception 'Memorial and fixing details must be confirmed';
    end if;
  end if;

  insert into public.permit_documents (
    organization_id, order_id, permit_id, document_role,
    google_drive_file_id, document_url, file_name, mime_type,
    source_system, source_ref, ocr_status, extracted_fields,
    review_status, reviewed_at, reviewer_session_hash
  ) values (
    p_organization_id, v_order.id, v_permit.id, p_document_role,
    trim(p_google_drive_file_id), trim(p_document_url), trim(p_file_name), p_mime_type,
    'google_drive', nullif(trim(p_source_ref), ''), 'pending', coalesce(p_evidence, '{}'::jsonb),
    'confirmed', v_now, left(p_reviewer_session_hash, 64)
  )
  on conflict (order_id, document_role, google_drive_file_id) do update set
    document_url = excluded.document_url,
    file_name = excluded.file_name,
    mime_type = excluded.mime_type,
    source_ref = coalesce(excluded.source_ref, public.permit_documents.source_ref),
    extracted_fields = public.permit_documents.extracted_fields || excluded.extracted_fields,
    review_status = 'confirmed',
    reviewed_at = excluded.reviewed_at,
    reviewer_session_hash = excluded.reviewer_session_hash,
    updated_at = now()
  returning * into v_document;

  if p_document_role = 'customer_return' then
    update public.order_permits
    set permit_phase = 'complete_form',
        next_action = 'complete_form',
        waiting_on = 'sears_melvin',
        returned_at = coalesce(returned_at, v_now),
        stage_entered_at = v_now,
        next_action_at = v_now,
        state_version = state_version + 1,
        updated_at = now()
    where id = v_permit.id
    returning * into v_permit;
  else
    update public.order_permits
    set next_action = 'review_send_cemetery',
        waiting_on = 'sears_melvin',
        specs_completed_at = coalesce(specs_completed_at, v_now),
        next_action_at = v_now,
        state_version = state_version + 1,
        updated_at = now()
    where id = v_permit.id
    returning * into v_permit;
  end if;

  insert into public.order_events (order_id, event_type, summary, detail)
  values (
    v_order.id,
    case when p_document_role = 'customer_return' then 'permit_customer_return_validated' else 'permit_application_completed' end,
    case when p_document_role = 'customer_return' then 'Customer permit return validated' else 'Completed permit application linked' end,
    jsonb_build_object(
      'permitId', v_permit.id, 'permitDocumentId', v_document.id,
      'documentRole', p_document_role, 'googleDriveFileId', v_document.google_drive_file_id,
      'stage', v_permit.permit_phase, 'nextAction', v_permit.next_action,
      'reviewerSessionHash', left(p_reviewer_session_hash, 64), 'emailSent', false
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id, 'permitId', v_permit.id,
    'permitDocumentId', v_document.id, 'documentRole', v_document.document_role,
    'formalStage', v_permit.permit_phase, 'currentActionType', v_permit.next_action,
    'stateVersion', v_permit.state_version
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reserve_permit_cemetery_send_v1(p_organization_id uuid, p_order_id uuid, p_permit_document_id uuid, p_expected_state_version integer, p_idempotency_key uuid, p_recipient_fingerprint text, p_payload_fingerprint text, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_permit public.order_permits%rowtype;
  v_document public.permit_documents%rowtype;
  v_cemetery public.cemeteries%rowtype;
  v_contact public.permit_contacts%rowtype;
  v_delivery public.permit_cemetery_email_deliveries%rowtype;
begin
  if p_expected_state_version is null or p_expected_state_version < 1 then raise exception 'A current permit state version is required'; end if;
  if p_recipient_fingerprint !~ '^[0-9a-f]{64}$' or p_payload_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Email fingerprints are invalid'; end if;
  if nullif(trim(p_reviewer_session_hash), '') is null or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then raise exception 'Reviewer session is required'; end if;

  select * into v_delivery from public.permit_cemetery_email_deliveries
  where idempotency_key = p_idempotency_key for update;
  if found then
    if v_delivery.organization_id <> p_organization_id or v_delivery.order_id <> p_order_id
       or v_delivery.permit_document_id <> p_permit_document_id
       or v_delivery.state_version <> p_expected_state_version
       or v_delivery.recipient_fingerprint <> p_recipient_fingerprint
       or v_delivery.payload_fingerprint <> p_payload_fingerprint then
      raise exception 'Idempotency key was already used for a different send';
    end if;
    return jsonb_build_object('deliveryId', v_delivery.id, 'status', v_delivery.status, 'alreadyReserved', true, 'sentAt', v_delivery.sent_at);
  end if;

  select * into v_order from public.orders
  where id = p_order_id and organization_id = p_organization_id and is_test = false
  for update;
  if not found then raise exception 'Order not found'; end if;
  if not public.permit_order_payment_confirmed_v1(v_order.id) then raise exception 'Order is not payment-confirmed'; end if;
  if v_order.cemetery_id is null or v_order.permit_form_id is null then raise exception 'Confirmed cemetery and permit form are required'; end if;

  select * into v_permit from public.order_permits
  where organization_id = p_organization_id and order_id = v_order.id for update;
  if not found then raise exception 'Permit workflow not found'; end if;
  if v_permit.state_version <> p_expected_state_version then raise exception 'Permit changed while it was being reviewed'; end if;
  if v_permit.permit_phase <> 'complete_form' or v_permit.next_action <> 'review_send_cemetery' then
    raise exception 'Permit is not ready for cemetery sending';
  end if;

  select * into v_document from public.permit_documents
  where id = p_permit_document_id and organization_id = p_organization_id
    and order_id = v_order.id and permit_id = v_permit.id
    and document_role = 'completed_application' and review_status = 'confirmed'
  for update;
  if not found then raise exception 'A confirmed completed application is required'; end if;

  select * into v_cemetery from public.cemeteries
  where id = v_order.cemetery_id and organization_id = p_organization_id and is_test = false
  for update;
  if not found or v_cemetery.permit_contact_id is null then raise exception 'Cemetery permit recipient is not assigned'; end if;

  select * into v_contact from public.permit_contacts
  where id = v_cemetery.permit_contact_id for update;
  if not found or not v_contact.active or v_contact.validation_status = 'delivery_failed' then
    raise exception 'Cemetery permit recipient is unavailable';
  end if;

  insert into public.permit_cemetery_email_deliveries (
    idempotency_key, organization_id, order_id, permit_id, cemetery_id,
    permit_document_id, permit_contact_id, state_version,
    recipient_email_snapshot, recipient_validation_status_snapshot,
    recipient_validated_at_snapshot, recipient_fingerprint, payload_fingerprint
  ) values (
    p_idempotency_key, p_organization_id, v_order.id, v_permit.id, v_cemetery.id,
    v_document.id, v_contact.id, p_expected_state_version,
    v_contact.email, v_contact.validation_status, v_contact.validated_at,
    p_recipient_fingerprint, p_payload_fingerprint
  ) returning * into v_delivery;

  return jsonb_build_object('deliveryId', v_delivery.id, 'status', v_delivery.status, 'alreadyReserved', false);
exception
  when unique_violation then raise exception 'A cemetery send already exists or needs reconciliation for this permit state';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.activity_log_write(p_user_id uuid, p_entity_type text, p_entity_id uuid, p_action text, p_changes jsonb, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.activity_logs (user_id, entity_type, entity_id, action, changes, context)
  values (
    p_user_id,
    p_entity_type,
    p_entity_id,
    p_action,
    coalesce(p_changes, '{}'::jsonb),
    coalesce(p_context, '{}'::jsonb)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.log_activity_generic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_entity_type text := tg_argv[0];
  v_entity_id uuid;
  v_action text;
  v_changes jsonb := '{}'::jsonb;
  v_status_changed boolean := false;
begin
  -- Determine actor: auth.uid(), or optional mason.user_id setting for service-role flows
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if v_user_id is null then
    begin
      v_user_id := current_setting('mason.user_id', true)::uuid;
    exception when others then
      v_user_id := null;
    end;
  end if;

  -- If we have no user, skip logging but never block DML
  if v_user_id is null then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_action := 'insert';
    -- For inserts, you can log full row or keep changes empty; here we leave changes as {}
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_action := 'update';
    v_changes := public.jsonb_diff_rows(to_jsonb(old), to_jsonb(new), array['updated_at']);
    if v_changes = '{}'::jsonb then
      return new; -- no meaningful change
    end if;
  elsif tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_action := 'delete';
  else
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  -- Status change classification per table
  if tg_op = 'UPDATE' then
    if tg_table_name = 'invoices' then
      if (old.status is distinct from new.status)
         or (old.stripe_invoice_status is distinct from new.stripe_invoice_status) then
        v_status_changed := true;
      end if;
    elsif tg_table_name = 'orders' then
      if old.status is distinct from new.status then
        v_status_changed := true;
      end if;
    elsif tg_table_name = 'inbox_conversations' then
      if old.status is distinct from new.status then
        v_status_changed := true;
      end if;
    elsif tg_table_name = 'jobs' then
      begin
        if (to_jsonb(old) -> 'status') is distinct from (to_jsonb(new) -> 'status') then
          v_status_changed := true;
        end if;
      exception when others then
        v_status_changed := false;
      end;
    end if;

    if v_status_changed then
      v_action := 'status_changed';
    end if;
  end if;

  perform public.activity_log_write(
    v_user_id,
    v_entity_type,
    v_entity_id,
    v_action,
    v_changes,
    '{}'::jsonb
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.complete_permit_cemetery_send_v1(p_delivery_id uuid, p_provider_message_id text, p_provider_thread_id text, p_sent_at timestamp with time zone, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_delivery public.permit_cemetery_email_deliveries%rowtype;
  v_permit public.order_permits%rowtype;
  v_document public.permit_documents%rowtype;
  v_sent_at timestamptz := coalesce(p_sent_at, now());
begin
  if nullif(trim(p_reviewer_session_hash), '') is null or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then raise exception 'Reviewer session is required'; end if;
  if nullif(trim(p_provider_message_id), '') is null or length(trim(p_provider_message_id)) > 500 then raise exception 'A provider message ID is required'; end if;
  if v_sent_at > now() + interval '5 minutes' then raise exception 'Cemetery send time is invalid'; end if;

  select * into v_delivery from public.permit_cemetery_email_deliveries
  where id = p_delivery_id for update;
  if not found then raise exception 'Cemetery delivery reservation not found'; end if;
  if v_delivery.status = 'sent' then
    return jsonb_build_object('deliveryId', v_delivery.id, 'status', 'sent', 'alreadyCompleted', true, 'sentAt', v_delivery.sent_at);
  end if;
  if v_delivery.status <> 'reserved' then raise exception 'Cemetery delivery is not reserved'; end if;

  select * into v_permit from public.order_permits
  where id = v_delivery.permit_id and organization_id = v_delivery.organization_id
  for update;
  if not found then raise exception 'Permit workflow not found'; end if;
  if v_permit.state_version <> v_delivery.state_version then raise exception 'Permit changed while it was being sent'; end if;
  if v_permit.permit_phase <> 'complete_form' or v_permit.next_action <> 'review_send_cemetery' then
    raise exception 'Permit is not ready for cemetery sending';
  end if;

  update public.order_permits
  set permit_phase = 'with_cemetery',
      next_action = 'wait_cemetery_response',
      waiting_on = 'cemetery',
      submitted_at = v_sent_at,
      stage_entered_at = v_sent_at,
      next_action_at = v_sent_at + interval '42 days',
      state_version = state_version + 1,
      updated_at = now()
  where id = v_permit.id
  returning * into v_permit;

  update public.permit_cemetery_email_deliveries
  set status = 'sent', provider_message_id = trim(p_provider_message_id),
      provider_thread_id = nullif(left(trim(coalesce(p_provider_thread_id, '')), 500), ''),
      error_code = null, sent_at = v_sent_at, updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  select * into v_document from public.permit_documents where id = v_delivery.permit_document_id;
  insert into public.permit_documents (
    organization_id, order_id, permit_id, parent_document_id, document_role,
    google_drive_file_id, document_url, file_name, mime_type,
    source_system, source_ref, ocr_status, extracted_fields,
    review_status, reviewed_at, reviewer_session_hash
  ) values (
    v_delivery.organization_id, v_delivery.order_id, v_delivery.permit_id,
    v_document.id, 'cemetery_submission', v_document.google_drive_file_id,
    v_document.document_url, v_document.file_name, v_document.mime_type,
    'gmail', 'gmail:' || trim(p_provider_message_id), 'not_required',
    jsonb_build_object('recipientContactId', v_delivery.permit_contact_id,
      'recipientEmailSnapshot', v_delivery.recipient_email_snapshot,
      'recipientValidationStatusSnapshot', v_delivery.recipient_validation_status_snapshot),
    'confirmed', v_sent_at, left(p_reviewer_session_hash, 64)
  ) on conflict (order_id, document_role, google_drive_file_id) do update set
    source_ref = excluded.source_ref, reviewed_at = excluded.reviewed_at, updated_at = now();

  insert into public.order_events (order_id, event_type, summary, detail)
  values (
    v_delivery.order_id, 'permit_cemetery_sent', 'Completed permit application sent to cemetery',
    jsonb_build_object(
      'permitId', v_delivery.permit_id, 'permitDocumentId', v_delivery.permit_document_id,
      'cemeteryId', v_delivery.cemetery_id, 'permitContactId', v_delivery.permit_contact_id,
      'recipientEmailSnapshot', v_delivery.recipient_email_snapshot,
      'recipientValidationStatusSnapshot', v_delivery.recipient_validation_status_snapshot,
      'externalMessageRef', 'gmail:' || trim(p_provider_message_id),
      'sentAt', v_sent_at, 'stage', v_permit.permit_phase,
      'nextAction', v_permit.next_action, 'nextActionAt', v_permit.next_action_at,
      'reviewerSessionHash', left(p_reviewer_session_hash, 64)
    )
  );

  return jsonb_build_object(
    'deliveryId', v_delivery.id, 'status', v_delivery.status,
    'alreadyCompleted', false, 'formalStage', v_permit.permit_phase,
    'currentActionType', v_permit.next_action, 'waitingOn', v_permit.waiting_on,
    'nextActionAt', v_permit.next_action_at, 'stateVersion', v_permit.state_version
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_ghl_connections_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO '\$user', 'public', 'extensions'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.jsonb_diff_rows(old_row jsonb, new_row jsonb, ignore_keys text[] DEFAULT ARRAY['updated_at'::text])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  key text;
  result jsonb := '{}'::jsonb;
  old_val jsonb;
  new_val jsonb;
begin
  -- Iterate over union of keys from old and new
  for key in
    select distinct k from (
      select jsonb_object_keys(coalesce(old_row, '{}')) as k
      union
      select jsonb_object_keys(coalesce(new_row, '{}')) as k
    ) s
  loop
    if key = any(ignore_keys) then
      continue;
    end if;

    old_val := coalesce(old_row -> key, 'null'::jsonb);
    new_val := coalesce(new_row -> key, 'null'::jsonb);

    if old_val is distinct from new_val then
      result := result || jsonb_build_object(
        key,
        jsonb_build_object(
          'from', old_row -> key,
          'to',   new_row -> key
        )
      );
    end if;
  end loop;

  return coalesce(result, '{}'::jsonb);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.fail_permit_cemetery_send_v1(p_delivery_id uuid, p_uncertain boolean, p_error_code text, p_reviewer_session_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_delivery public.permit_cemetery_email_deliveries%rowtype;
begin
  if nullif(trim(p_reviewer_session_hash), '') is null or p_reviewer_session_hash !~ '^[0-9a-f]{16,64}$' then raise exception 'Reviewer session is required'; end if;
  select * into v_delivery from public.permit_cemetery_email_deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Cemetery delivery reservation not found'; end if;
  if v_delivery.status = 'sent' then raise exception 'A sent delivery cannot be failed'; end if;
  update public.permit_cemetery_email_deliveries
  set status = case when coalesce(p_uncertain, true) then 'uncertain' else 'failed' end,
      error_code = nullif(left(trim(coalesce(p_error_code, 'provider_error')), 160), ''),
      updated_at = now()
  where id = v_delivery.id returning * into v_delivery;
  return jsonb_build_object('deliveryId', v_delivery.id, 'status', v_delivery.status);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.user_has_organization()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.user_id = (select auth.uid())
  );
$function$
;
CREATE OR REPLACE FUNCTION public.prune_portal_security_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if pg_catalog.random() < 0.05 then
    delete from public.portal_rate_limits
    where ctid in (select ctid from public.portal_rate_limits where expires_at < pg_catalog.clock_timestamp() order by expires_at limit 500);
    delete from public.portal_security_events
    where ctid in (select ctid from public.portal_security_events where created_at < pg_catalog.clock_timestamp() - interval '90 days' order by created_at limit 500);
  end if;
  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.resolve_paid_customer_order_type(p_order_type text, p_renovation_description text, p_renovation_cost numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when lower(trim(coalesce(p_order_type, ''))) in ('renovation') then 'Renovation'
    when nullif(trim(coalesce(p_renovation_description, '')), '') is not null then 'Renovation'
    when coalesce(p_renovation_cost, 0) > 0 then 'Renovation'
    else 'New Memorial'
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.order_is_paid_or_converted(p_order orders)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$
begin
  if p_order.stage = 'deposit_paid' then
    return true;
  end if;

  if p_order.job_id is not null and exists (
    select 1 from public.jobs j
    where j.id = p_order.job_id
      and (
        j.paid_at is not null
        or j.stage in ('confirmed', 'in_production', 'fixed', 'complete')
      )
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.invoices i
    where i.order_id = p_order.id
      and i.deleted_at is null
      and (
        i.paid_at is not null
        or coalesce(i.amount_paid, 0) > 0
        or i.stripe_status = 'paid'
      )
  ) then
    return true;
  end if;

  return false;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_orders_flip_quote_type_on_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if lower(trim(coalesce(new.order_type, ''))) = 'quote'
     and public.order_is_paid_or_converted(new) then
    new.order_type := public.resolve_paid_customer_order_type(
      new.order_type,
      new.renovation_service_description,
      new.renovation_service_cost
    );
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_jobs_flip_linked_quote_order_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.paid_at is not null
     or new.stage in ('confirmed', 'in_production', 'fixed', 'complete') then
    update public.orders o
    set order_type = public.resolve_paid_customer_order_type(
      o.order_type,
      o.renovation_service_description,
      o.renovation_service_cost
    )
    where o.job_id = new.id
      and o.archived_at is null
      and lower(trim(coalesce(o.order_type, ''))) = 'quote';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_invoices_flip_linked_quote_order_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.order_id is not null
     and new.deleted_at is null
     and (
       new.paid_at is not null
       or coalesce(new.amount_paid, 0) > 0
       or new.stripe_status = 'paid'
     ) then
    update public.orders o
    set order_type = public.resolve_paid_customer_order_type(
      o.order_type,
      o.renovation_service_description,
      o.renovation_service_cost
    )
    where o.id = new.order_id
      and o.archived_at is null
      and lower(trim(coalesce(o.order_type, ''))) = 'quote';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.orders_correct_inverted_names()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_person_full_name text;
  v_swap text;
begin
  if new.person_id is null
     or nullif(trim(new.person_name), '') is null then
    return new;
  end if;

  select trim(p.first_name || ' ' || p.last_name)
    into v_person_full_name
  from public.people p
  where p.id = new.person_id
    and p.organization_id = new.organization_id;

  if v_person_full_name is not null
     and lower(trim(new.customer_name)) = lower(v_person_full_name)
     and lower(trim(new.person_name)) <> lower(trim(new.customer_name)) then
    v_swap := new.customer_name;
    new.customer_name := new.person_name;
    new.person_name := v_swap;
    raise notice 'orders_correct_inverted_names: swapped customer_name/person_name on order % (order_number %)',
      new.id, new.order_number;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid;
  v_name text;
  v_org_id uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Must be authenticated to create an organisation'
      using errcode = '28000';
  end if;

  v_name := trim(both from p_name);
  if v_name = '' then
    raise exception 'Organisation name is required'
      using errcode = 'P0001';
  end if;
  if length(v_name) > 200 then
    raise exception 'Organisation name is too long'
      using errcode = 'P0001';
  end if;

  insert into public.organizations (name)
  values (v_name)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_uid, 'admin');

  return v_org_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_active_organization_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select nullif(pg_catalog.current_setting('app.active_organization_id', true), '')::uuid;
$function$
;
CREATE OR REPLACE FUNCTION public.remove_organization_member(p_organization_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_deleted integer;
begin
  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to remove members'
      using errcode = '42501';
  end if;

  delete from public.organization_members m
  where m.organization_id = p_organization_id
    and m.user_id = p_user_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Membership not found for this organisation'
      using errcode = 'P0001';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_inbox_from_enquiry(p_enquiry_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e record;
  p record;
  v_handle text;
  v_intake_label text;
  v_subject text;
  v_body text;
  v_conversation_id uuid;
begin
  select * into e from public.enquiries where id = p_enquiry_id;
  if not found then
    return null;
  end if;

  select id into v_conversation_id
  from public.inbox_conversations
  where external_thread_id = 'enquiry:' || e.id::text
  limit 1;
  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  select first_name, last_name, email, phone into p
  from public.people where id = e.person_id;

  v_handle := coalesce(nullif(p.email, ''), nullif(p.phone, ''), 'web-form');

  v_intake_label := case e.channel
    when 'quote'         then 'Quote request'
    when 'contact'       then 'Contact form'
    when 'appointment'   then 'Appointment request'
    when 'call'          then 'Callback request'
    when 'shortlist'     then 'Shortlist enquiry'
    when 'partner_order' then 'Partner order'
    else 'Web enquiry'
  end;

  v_subject := v_intake_label || coalesce(' (' || e.sub_type || ')', '');

  v_body := v_intake_label;
  if coalesce(p.first_name, '') <> '' or coalesce(p.last_name, '') <> '' then
    v_body := v_body || E'\nFrom: ' || trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''));
  end if;
  if p.email is not null then
    v_body := v_body || E'\nEmail: ' || p.email;
  end if;
  if p.phone is not null then
    v_body := v_body || E'\nPhone: ' || p.phone;
  end if;
  if e.source_page is not null then
    v_body := v_body || E'\nPage: ' || e.source_page;
  end if;
  if e.location is not null then
    v_body := v_body || E'\nLocation: ' || e.location;
  end if;
  if e.appointment_at is not null then
    v_body := v_body || E'\nAppointment: ' || e.appointment_at::text || coalesce(' (' || e.appointment_kind || ')', '');
  end if;
  if e.contact_pref is not null then
    v_body := v_body || E'\nContact pref: ' || e.contact_pref;
  end if;
  if coalesce(e.message, '') <> '' then
    v_body := v_body || E'\n\n' || e.message;
  end if;

  insert into public.inbox_conversations (
    organization_id, channel, primary_handle, subject, status,
    external_thread_id, last_message_at, last_inbound_at,
    last_message_preview, person_id, link_state, link_meta, order_id, created_at
  ) values (
    e.organization_id, 'web', v_handle, v_subject, 'open',
    'enquiry:' || e.id::text, e.created_at, e.created_at,
    left(coalesce(nullif(e.message, ''), v_intake_label), 200),
    e.person_id,
    case when e.person_id is not null then 'linked' else 'unlinked' end,
    jsonb_build_object(
      'source', 'enquiry',
      'enquiry_id', e.id,
      'enquiry_channel', e.channel,
      'sub_type', e.sub_type,
      'source_page', e.source_page
    ),
    e.order_id, e.created_at
  )
  returning id into v_conversation_id;

  insert into public.inbox_messages (
    organization_id, conversation_id, channel, direction,
    sent_at, from_handle, to_handle, body_text,
    external_message_id, status, meta, created_at
  ) values (
    e.organization_id, v_conversation_id, 'web', 'inbound',
    e.created_at, v_handle, 'inbox', v_body,
    'enquiry:' || e.id::text, 'received',
    jsonb_build_object(
      'source', 'enquiry',
      'enquiry_id', e.id,
      'enquiry_channel', e.channel,
      'sub_type', e.sub_type,
      'source_page', e.source_page,
      'appointment_at', e.appointment_at,
      'appointment_kind', e.appointment_kind,
      'location', e.location,
      'contact_pref', e.contact_pref,
      'photo_urls', e.photo_urls,
      'details', e.details
    ),
    e.created_at
  );

  return v_conversation_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_stripe_secret_key(p_organization_id uuid, p_mode text, p_encryption_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  encrypted bytea;
begin
  if p_encryption_key is null or length(trim(p_encryption_key)) = 0 then
    raise exception 'encryption_key is required';
  end if;

  if p_mode not in ('test', 'live') then
    raise exception 'invalid mode';
  end if;

  if p_mode = 'test' then
    select c.test_secret_key_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  else
    select c.live_secret_key_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  end if;

  if encrypted is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(encrypted, p_encryption_key);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_stripe_webhook_secret(p_organization_id uuid, p_mode text, p_encryption_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  encrypted bytea;
begin
  if p_encryption_key is null or length(trim(p_encryption_key)) = 0 then
    raise exception 'encryption_key is required';
  end if;

  if p_mode not in ('test', 'live') then
    raise exception 'invalid mode';
  end if;

  if p_mode = 'test' then
    select c.test_webhook_secret_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  else
    select c.live_webhook_secret_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  end if;

  if encrypted is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(encrypted, p_encryption_key);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.order_stage(p_stone_status text, p_proof_status text, p_permit_status text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    -- No proof yet → sitting at design
    when p_proof_status in ('NA', 'Not_Received') then 'design'
    -- Proof work in progress (In_Progress is legacy, kept until Arin's remap)
    when p_proof_status in ('Received', 'Sent', 'Revision', 'In_Progress') then 'proof'  -- R2
    -- Proof approved, lettering still to do
    when p_proof_status = 'Approved' then 'lettering'  -- R2
    -- Proof lettered but permit not yet approved → lettering phase
    when p_proof_status = 'Lettered' and coalesce(p_permit_status, '') not in ('approved')
      then case
        when p_permit_status in ('form_sent', 'customer_completed', 'pending') then 'permit'
        else 'lettering'
      end
    -- Everything lined up but stone still to come → permit sweeping up loose ends
    when coalesce(p_stone_status, 'NA') <> 'In Stock' then 'lettering'
    else 'install_ready'
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.recompute_person_is_customer(p_person uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_derived boolean;
BEGIN
  IF p_person IS NULL THEN RETURN; END IF;

  -- Customer = has ≥1 real Stripe payment.
  -- Qualifying evidence: an org-stamped, non-test, non-deleted invoice
  -- linked to this person, with money received on it — either directly
  -- (amount_paid > 0 / paid_at set) or via a paid invoice_payments row.
  SELECT EXISTS (
    SELECT 1
    FROM invoices i
    WHERE i.person_id = p_person
      AND i.organization_id IS NOT NULL
      AND coalesce(i.is_test, false) = false
      AND i.deleted_at IS NULL
      AND (
        coalesce(i.amount_paid, 0) > 0
        OR i.paid_at IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM invoice_payments ip
          WHERE ip.invoice_id = i.id AND ip.status = 'paid'
        )
      )
  ) INTO v_derived;

  UPDATE people p
  SET is_customer = coalesce(p.is_customer_override, v_derived)
  WHERE p.id = p_person
    AND p.is_customer IS DISTINCT FROM coalesce(p.is_customer_override, v_derived);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.upsert_organization_stripe_credentials(p_organization_id uuid, p_encryption_key text, p_test_secret_key text, p_test_publishable_key text, p_test_webhook_secret text, p_live_secret_key text DEFAULT NULL::text, p_live_publishable_key text DEFAULT NULL::text, p_live_webhook_secret text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_encryption_key is null or length(trim(p_encryption_key)) = 0 then
    raise exception 'encryption_key is required';
  end if;

  if p_test_secret_key is null or p_test_publishable_key is null or p_test_webhook_secret is null then
    raise exception 'test credential triplet is required';
  end if;

  insert into public.organization_stripe_config (
    organization_id,
    test_secret_key_encrypted,
    test_publishable_key,
    test_webhook_secret_encrypted,
    live_secret_key_encrypted,
    live_publishable_key,
    live_webhook_secret_encrypted,
    test_round_trip_passed_at,
    updated_at
  )
  values (
    p_organization_id,
    extensions.pgp_sym_encrypt(p_test_secret_key, p_encryption_key),
    p_test_publishable_key,
    extensions.pgp_sym_encrypt(p_test_webhook_secret, p_encryption_key),
    case
      when p_live_secret_key is not null and length(trim(p_live_secret_key)) > 0
        then extensions.pgp_sym_encrypt(p_live_secret_key, p_encryption_key)
      else null
    end,
    nullif(trim(p_live_publishable_key), ''),
    case
      when p_live_webhook_secret is not null and length(trim(p_live_webhook_secret)) > 0
        then extensions.pgp_sym_encrypt(p_live_webhook_secret, p_encryption_key)
      else null
    end,
    null,
    now()
  )
  on conflict (organization_id) do update set
    test_secret_key_encrypted = extensions.pgp_sym_encrypt(p_test_secret_key, p_encryption_key),
    test_publishable_key = p_test_publishable_key,
    test_webhook_secret_encrypted = extensions.pgp_sym_encrypt(p_test_webhook_secret, p_encryption_key),
    live_secret_key_encrypted = case
      when p_live_secret_key is not null and length(trim(p_live_secret_key)) > 0
        then extensions.pgp_sym_encrypt(p_live_secret_key, p_encryption_key)
      else public.organization_stripe_config.live_secret_key_encrypted
    end,
    live_publishable_key = coalesce(nullif(trim(p_live_publishable_key), ''), public.organization_stripe_config.live_publishable_key),
    live_webhook_secret_encrypted = case
      when p_live_webhook_secret is not null and length(trim(p_live_webhook_secret)) > 0
        then extensions.pgp_sym_encrypt(p_live_webhook_secret, p_encryption_key)
      else public.organization_stripe_config.live_webhook_secret_encrypted
    end,
    test_round_trip_passed_at = null,
    updated_at = now();
end;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_invoice_payments_recompute_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM recompute_person_is_customer(
    (SELECT person_id FROM invoices WHERE id = NEW.invoice_id)
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_invoices_recompute_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM recompute_person_is_customer(NEW.person_id);
  IF TG_OP = 'UPDATE' AND OLD.person_id IS DISTINCT FROM NEW.person_id THEN
    PERFORM recompute_person_is_customer(OLD.person_id);  -- relink: old person may lose status
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_portal_rate_limit(p_key_hash text, p_max_attempts integer, p_window_seconds integer, p_block_seconds integer)
 RETURNS TABLE(allowed boolean, retry_after_seconds integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.portal_rate_limits%rowtype;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$'
     or p_max_attempts not between 1 and 10000
     or p_window_seconds not between 10 and 86400
     or p_block_seconds not between 10 and 604800 then
    raise exception 'invalid rate-limit parameters';
  end if;

  insert into public.portal_rate_limits as limits (
    key_hash, window_started_at, attempts, blocked_until, expires_at, updated_at
  ) values (
    p_key_hash,
    v_now,
    1,
    null,
    v_now + make_interval(secs => p_window_seconds + p_block_seconds),
    v_now
  )
  on conflict (key_hash) do update set
    window_started_at = case
      when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
      else limits.window_started_at
    end,
    attempts = case
      when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
      else limits.attempts + 1
    end,
    blocked_until = case
      when limits.blocked_until is not null and limits.blocked_until > v_now then limits.blocked_until
      when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then null
      when limits.attempts + 1 > p_max_attempts then v_now + make_interval(secs => p_block_seconds)
      else null
    end,
    expires_at = v_now + make_interval(secs => p_window_seconds + p_block_seconds),
    updated_at = v_now
  returning limits.* into v_row;

  allowed := (v_row.blocked_until is null or v_row.blocked_until <= v_now)
    and v_row.attempts <= p_max_attempts;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer)
  end;
  return next;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_quote(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org         public.people.organization_id%type := (payload->>'organization_id')::uuid;
  v_email       text  := lower(trim(payload->>'email'));
  v_first       text  := nullif(payload->>'first_name', '');
  v_last        text  := nullif(payload->>'last_name', '');
  v_phone       text  := nullif(payload->>'phone', '');
  v_name        text  := nullif(payload->>'name', '');
  v_message     text  := nullif(payload->>'message', '');
  v_source_page text  := nullif(payload->>'source_page', '');
  v_location    text  := nullif(payload->>'location', '');
  v_cem_in      text  := nullif(payload->>'cemetery_id', '');
  v_edit_token  text  := nullif(payload->>'edit_token', '');
  v_product     jsonb := payload->'product';
  v_person_id   public.people.id%type;
  v_job_id      public.jobs.id%type;
  v_enq_id      public.enquiries.id%type;
  v_cemetery_id public.cemeteries.id%type;
begin
  if v_email is null or v_email = '' then
    raise exception 'create_quote: email is required';
  end if;

  -- edit_token is echoed in the return for worker compatibility but is no
  -- longer persisted anywhere (no orders row; capture trigger starved).
  if v_edit_token is null then
    v_edit_token := encode(extensions.gen_random_bytes(24), 'hex');
  end if;

  -- 1. Person upsert (dedupe by org-scoped email — people_org_email_key).
  select id into v_person_id from public.people
  where email = v_email and organization_id = v_org limit 1;
  if v_person_id is null then
    begin
      insert into public.people (organization_id, email, first_name, last_name, phone)
      values (v_org, v_email, v_first, v_last, v_phone)
      returning id into v_person_id;
    exception when unique_violation then
      select id into v_person_id from public.people
      where email = v_email and organization_id = v_org limit 1;
    end;
  else
    update public.people set
      first_name = coalesce(v_first, first_name),
      last_name  = coalesce(nullif(v_last, '-'), last_name),
      phone      = coalesce(v_phone, phone)
    where id = v_person_id;
  end if;

  -- 2. Resolve cemetery: prefer the supplied id, else best-effort name match.
  if v_cem_in is not null then
    select c.id into v_cemetery_id
    from public.cemeteries c
    where c.id::text = v_cem_in
    limit 1;
  elsif v_location is not null and char_length(v_location) >= 3 then
    select c.id into v_cemetery_id
    from public.cemeteries c
    where c.is_active = true
      and (c.name ilike v_location
           or c.name ilike v_location || '%'
           or c.name ilike '%' || v_location || '%')
    order by (c.name ilike v_location) desc,
             (c.name ilike v_location || '%') desc
    limit 1;
  end if;

  -- 3. Forward dedupe (FR-004): reuse the person's active 'enquired' job, else
  --    create one. Later-stage jobs never match — a fresh quote from someone
  --    in production is a new memorial.
  select id into v_job_id from public.jobs
  where person_id = v_person_id
    and organization_id = v_org
    and stage = 'enquired'
    and exit_reason is null
  order by created_at desc
  limit 1;
  if v_job_id is null then
    insert into public.jobs (organization_id, person_id, source, stage, stage_status)
    values (v_org, v_person_id, 'website', 'enquired', 'uncontacted')
    returning id into v_job_id;
  end if;

  -- 4. Enquiry — CRM record; NO order_id (quotes no longer create orders).
  insert into public.enquiries (
    organization_id, person_id, channel, source_page, message,
    location, cemetery_id, details
  ) values (
    v_org, v_person_id, 'quote', v_source_page, v_message,
    v_location, v_cemetery_id, v_product
  )
  returning id into v_enq_id;

  -- 5. Attach: the latest enquiry is the job's config source; the conversation
  --    created by the trigger above is linked on first attach only.
  update public.jobs set
    enquiry_id = v_enq_id,
    conversation_id = coalesce(conversation_id, (
      select id from public.inbox_conversations
      where external_thread_id = 'enquiry:' || v_enq_id::text
        and organization_id = v_org
      limit 1))
  where id = v_job_id;

  return jsonb_build_object(
    'person_id',  v_person_id,
    'order_id',   null,
    'enquiry_id', v_enq_id,
    'edit_token', v_edit_token,
    'job_id',     v_job_id
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.add_organization_member_by_email(p_organization_id uuid, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_target_id uuid;
  v_lookup text;
begin
  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to add members'
      using errcode = '42501';
  end if;

  v_lookup := trim(both from p_email);
  if v_lookup = '' then
    raise exception 'Email is required'
      using errcode = 'P0001';
  end if;

  select u.id
    into v_target_id
    from auth.users u
    where u.email = v_lookup
    order by u.created_at asc
    limit 1;

  if v_target_id is null then
    raise exception 'No user found for that email address'
      using errcode = 'P0001';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (p_organization_id, v_target_id, 'member')
  on conflict (organization_id, user_id) do nothing;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_inquiries_pipeline(p_organization_id uuid, p_channels text[] DEFAULT NULL::text[], p_from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(enquiry_id uuid, stage text, channel text, sub_type text, created_at timestamp with time zone, source_page text, message text, location text, contact_pref text, appointment_at timestamp with time zone, appointment_kind text, details jsonb, photo_urls text[], order_id uuid, person_id uuid, person_first_name text, person_last_name text, person_email text, person_phone text, linked_quote_id uuid, linked_quote_status text, linked_quote_total numeric, linked_quote_created_at timestamp with time zone, linked_order_id uuid, linked_order_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_allowed constant text[] := array['contact', 'quote', 'appointment', 'call', 'shortlist'];
begin
  if not public.user_is_member_of_org(p_organization_id) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_channels is not null then
    if cardinality(p_channels) = 0 then
      raise exception 'invalid channel filter'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from unnest(p_channels) ch
      where not (ch = any (v_allowed))
    ) then
      raise exception 'invalid channel filter'
        using errcode = '22023';
    end if;
  end if;

  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'invalid date range'
      using errcode = '22023';
  end if;

  return query
  select
    e.id as enquiry_id,
    (
      case
        when e.order_id is not null then 'order_created'
        when lq.id is not null then 'quoted'
        else 'new'
      end
    )::text as stage,
    e.channel::text as channel,
    e.sub_type::text as sub_type,
    e.created_at as created_at,
    e.source_page::text as source_page,
    e.message::text as message,
    e.location::text as location,
    e.contact_pref::text as contact_pref,
    e.appointment_at as appointment_at,
    e.appointment_kind::text as appointment_kind,
    e.details as details,
    e.photo_urls as photo_urls,
    e.order_id as order_id,
    e.person_id as person_id,
    pe.first_name::text as person_first_name,
    pe.last_name::text as person_last_name,
    pe.email::text as person_email,
    pe.phone::text as person_phone,
    lq.id as linked_quote_id,
    lq.status::text as linked_quote_status,
    lq.total_value::numeric as linked_quote_total,
    lq.created_at as linked_quote_created_at,
    lo.id as linked_order_id,
    lo.status::text as linked_order_status
  from public.enquiries e
  left join public.people pe
    on pe.id = e.person_id
  left join lateral (
    select q.id, q.status, q.total_value, q.created_at
    from public.quotes q
    where q.customer_id = e.person_id
      and q.organization_id = e.organization_id
      and q.created_at >= e.created_at
      and q.status = 'accepted'
    order by q.created_at desc
    limit 1
  ) lq on true
  left join lateral (
    select o.id, o.status
    from public.orders o
    where o.id = e.order_id
      and o.organization_id = e.organization_id
    limit 1
  ) lo on true
  where e.organization_id = p_organization_id
    and (
      p_channels is null
      or e.channel = any (p_channels)
    )
    and (p_from_date is null or e.created_at >= p_from_date)
    and (p_to_date is null or e.created_at <= p_to_date)
  order by e.created_at desc;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_organization_members_with_identity(p_organization_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, user_id uuid, role text, created_at timestamp with time zone, email text, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.user_is_member_of_org(p_organization_id) then
    return;
  end if;

  return query
  select
    m.id,
    m.organization_id,
    m.user_id,
    m.role::text,
    m.created_at,
    u.email::text,
    (
      coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(u.raw_user_meta_data ->> 'name'), '')
      )
    )::text as display_name
  from public.organization_members m
  inner join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
  order by m.created_at asc;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.search_inbox_conversations(p_organization_id uuid, p_q text, p_status text DEFAULT 'open'::text, p_channel text DEFAULT NULL::text, p_unread_only boolean DEFAULT false, p_unlinked_only boolean DEFAULT false)
 RETURNS SETOF inbox_conversations
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select c.*
  from public.inbox_conversations as c
  left join public.people as p
    on p.id = c.person_id
  where c.organization_id = p_organization_id
    and c.status = coalesce(p_status, 'open')
    and (p_channel is null or c.channel = p_channel)
    and (p_unread_only is not true or c.unread_count > 0)
    and (p_unlinked_only is not true or c.person_id is null)
    and (
      c.primary_handle ilike '%' || trim(p_q) || '%'
      or c.subject ilike '%' || trim(p_q) || '%'
      or c.last_message_preview ilike '%' || trim(p_q) || '%'
      or (
        select bool_and(concat_ws(' ', p.first_name, p.last_name) ilike '%' || t.tok || '%')
        from unnest(array_remove(regexp_split_to_array(p_q, '[^[:alnum:]]+'), '')) as t(tok)
      ) is true
    )
  order by c.last_message_at desc nulls last, c.created_at desc;
$function$
;
alter table public.whatsapp_managed_connections add constraint whatsapp_managed_connections_pkey PRIMARY KEY (id);
alter table public.whatsapp_managed_connections add constraint whatsapp_managed_connections_state_check CHECK ((state = ANY (ARRAY['not_connected'::text, 'requested'::text, 'collecting_business_info'::text, 'provisioning'::text, 'pending_verification'::text, 'pending_provider_review'::text, 'connected'::text, 'action_required'::text, 'failed'::text, 'disconnected'::text, 'error'::text])));
alter table public.ghl_send_idempotency add constraint ghl_send_idempotency_pkey PRIMARY KEY (request_id);
alter table public.ghl_send_idempotency add constraint ghl_send_idempotency_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])));
alter table public.companies add constraint companies_pkey PRIMARY KEY (id);
alter table public.quote_access_tokens add constraint quote_access_tokens_pkey PRIMARY KEY (order_id);
alter table public.quote_access_tokens add constraint quote_access_tokens_token_hash_check CHECK ((token_hash ~ '^sha256:[0-9a-f]{64}$'::text));
alter table public.quote_access_tokens add constraint quote_access_tokens_token_hash_key UNIQUE (token_hash);
alter table public.inbox_channel_accounts add constraint inbox_channel_accounts_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text])));
alter table public.inbox_channel_accounts add constraint inbox_channel_accounts_pkey PRIMARY KEY (id);
alter table public.memorials add constraint memorials_pkey PRIMARY KEY (id);
alter table public.memorials add constraint memorials_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'installed'::text, 'removed'::text])));
alter table public.order_payments add constraint order_payments_external_id_key UNIQUE (external_id);
alter table public.order_payments add constraint order_payments_pkey PRIMARY KEY (id);
alter table public.order_events add constraint order_events_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_permit_status_check CHECK ((permit_status = ANY (ARRAY['not_started'::text, 'form_sent'::text, 'customer_completed'::text, 'pending'::text, 'approved'::text])));
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.orders add constraint orders_progress_check CHECK (((progress >= 0) AND (progress <= 100)));
alter table public.orders add constraint orders_proof_status_allowed CHECK ((proof_status = ANY (ARRAY['NA'::text, 'Not_Received'::text, 'Received'::text, 'Sent'::text, 'Revision'::text, 'Approved'::text, 'Lettered'::text, 'In_Progress'::text])));
alter table public.orders add constraint orders_stage_check CHECK ((stage = ANY (ARRAY['quote_received'::text, 'deposit_paid'::text, 'design_in_progress'::text, 'proof_ready'::text, 'inscription_approved'::text, 'in_production'::text, 'installation_scheduled'::text, 'completed'::text])));
alter table public.orders add constraint orders_stone_status_check CHECK ((stone_status = ANY (ARRAY['NA'::text, 'Ordered'::text, 'In Stock'::text])));
alter table public.table_view_presets add constraint table_view_presets_pkey PRIMARY KEY (id);
alter table public.table_view_presets add constraint unique_module_name UNIQUE (module, name);
alter table public.portal_rate_limits add constraint portal_rate_limits_attempts_check CHECK ((attempts > 0));
alter table public.portal_rate_limits add constraint portal_rate_limits_key_hash_check CHECK ((key_hash ~ '^[0-9a-f]{64}$'::text));
alter table public.portal_rate_limits add constraint portal_rate_limits_pkey PRIMARY KEY (key_hash);
alter table public.inbox_ai_suggestions add constraint inbox_ai_suggestions_pkey PRIMARY KEY (id);
alter table public.contact_handles add constraint contact_handles_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text])));
alter table public.contact_handles add constraint contact_handles_channel_handle_key UNIQUE (channel, handle);
alter table public.contact_handles add constraint contact_handles_owner_type_check CHECK ((owner_type = ANY (ARRAY['people'::text, 'companies'::text])));
alter table public.contact_handles add constraint contact_handles_pkey PRIMARY KEY (id);
alter table public.inscriptions add constraint inscriptions_color_check CHECK ((color = ANY (ARRAY['gold'::text, 'silver'::text, 'white'::text, 'black'::text, 'natural'::text, 'other'::text])));
alter table public.inscriptions add constraint inscriptions_pkey PRIMARY KEY (id);
alter table public.inscriptions add constraint inscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'proofing'::text, 'approved'::text, 'engraving'::text, 'completed'::text, 'installed'::text])));
alter table public.inscriptions add constraint inscriptions_type_check CHECK ((type = ANY (ARRAY['front'::text, 'back'::text, 'side'::text, 'plaque'::text, 'additional'::text])));
alter table public.order_people add constraint order_people_order_id_person_id_key UNIQUE (order_id, person_id);
alter table public.order_people add constraint order_people_pkey PRIMARY KEY (id);
alter table public.order_additional_options add constraint order_additional_options_pkey PRIMARY KEY (id);
alter table public.order_permits add constraint order_permits_approval_evidence_check CHECK (((permit_phase <> 'approved'::text) OR ((approved_at IS NOT NULL) AND (written_approval_evidence_ref ~ '^(gmail|ghl|drive):.+'::text))));
alter table public.order_permits add constraint order_permits_next_action_check CHECK ((next_action = ANY (ARRAY['match_form'::text, 'review_send_customer'::text, 'wait_customer_return'::text, 'chase_customer'::text, 'help_customer'::text, 'validate_return'::text, 'complete_form'::text, 'review_send_cemetery'::text, 'wait_cemetery_response'::text, 'chase_cemetery'::text, 'reply_cemetery'::text, 'provide_documents'::text, 'resolve_specification'::text, 'review_written_approval'::text, 'none'::text])));
alter table public.order_permits add constraint order_permits_permit_phase_check CHECK ((permit_phase = ANY (ARRAY['select_form'::text, 'with_customer'::text, 'check_return'::text, 'complete_form'::text, 'with_cemetery'::text, 'approved'::text])));
alter table public.order_permits add constraint order_permits_pkey PRIMARY KEY (id);
alter table public.order_permits add constraint order_permits_returned_via_check CHECK ((returned_via = ANY (ARRAY['scan'::text, 'photo'::text, 'post'::text, 'walked_in'::text])));
alter table public.order_permits add constraint order_permits_sent_via_check CHECK ((sent_via = ANY (ARRAY['email'::text, 'post'::text, 'whatsapp'::text, 'both'::text])));
alter table public.order_permits add constraint order_permits_state_version_check CHECK ((state_version > 0));
alter table public.order_permits add constraint order_permits_waiting_on_check CHECK ((waiting_on = ANY (ARRAY['sears_melvin'::text, 'customer'::text, 'cemetery'::text, 'none'::text])));
alter table public.people add constraint people_created_via_allowed CHECK (((created_via IS NULL) OR (created_via = ANY (ARRAY['inbox_ingest'::text, 'inbox_assisted'::text, 'manual'::text]))));
alter table public.people add constraint people_pkey PRIMARY KEY (id);
alter table public.people add constraint people_portal_token_key UNIQUE (portal_token);
alter table public.payments add constraint payments_method_check CHECK ((method = ANY (ARRAY['cash'::text, 'card'::text, 'bank_transfer'::text, 'check'::text, 'online'::text, 'other'::text])));
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.invoices add constraint invoices_billing_party_check CHECK (((billing_party IS NULL) OR (billing_party = ANY (ARRAY['family'::text, 'funeral_director'::text, 'other'::text]))));
alter table public.invoices add constraint invoices_currency_check CHECK (((currency IS NULL) OR (currency ~ '^[a-z]{3}$'::text)));
alter table public.invoices add constraint invoices_invoice_number_key UNIQUE (invoice_number);
alter table public.invoices add constraint invoices_invoice_type_check CHECK (((invoice_type IS NULL) OR (invoice_type = ANY (ARRAY['deposit'::text, 'balance'::text, 'full'::text, 'adjustment'::text, 'credit_note'::text]))));
alter table public.invoices add constraint invoices_pkey PRIMARY KEY (id);
alter table public.invoices add constraint invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])));
alter table public.invoices add constraint invoices_stripe_credential_mode_check CHECK (((stripe_credential_mode IS NULL) OR (stripe_credential_mode = ANY (ARRAY['test'::text, 'live'::text]))));
alter table public.product_categories add constraint product_categories_pkey PRIMARY KEY (id);
alter table public.product_categories add constraint product_categories_slug_key UNIQUE (slug);
alter table public.order_proof_versions add constraint order_proof_versions_event_check CHECK ((event = ANY (ARRAY['inscription_received'::text, 'draft_started'::text, 'first_proof_sent'::text, 'revisions_requested'::text, 'revised_proof_sent'::text, 'approved'::text, 'rejected'::text, 'note'::text])));
alter table public.order_proof_versions add constraint order_proof_versions_pkey PRIMARY KEY (id);
alter table public.order_proof_versions add constraint order_proof_versions_version_check CHECK ((version > 0));
alter table public.stone_colours add constraint stone_colours_pkey PRIMARY KEY (id);
alter table public.stone_colours add constraint stone_colours_slug_key UNIQUE (slug);
alter table public.whatsapp_connections add constraint whatsapp_connections_pkey PRIMARY KEY (id);
alter table public.whatsapp_connections add constraint whatsapp_connections_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text])));
alter table public.product_sizes add constraint product_sizes_pkey PRIMARY KEY (id);
alter table public.product_sizes add constraint product_sizes_product_id_size_code_key UNIQUE (product_id, size_code);
alter table public.product_addons add constraint product_addons_pkey PRIMARY KEY (id);
alter table public.product_addons add constraint product_addons_slug_key UNIQUE (slug);
alter table public.activity_logs add constraint activity_logs_pkey PRIMARY KEY (id);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.products add constraint products_sku_key UNIQUE (sku);
alter table public.products add constraint products_slug_key UNIQUE (slug);
alter table public.order_proof_ai_checks add constraint order_proof_ai_checks_level_check CHECK ((level = ANY (ARRAY['pass'::text, 'info'::text, 'warn'::text, 'fail'::text])));
alter table public.order_proof_ai_checks add constraint order_proof_ai_checks_pkey PRIMARY KEY (id);
alter table public.order_proof_ai_checks add constraint order_proof_ai_checks_version_check CHECK ((version > 0));
alter table public.order_proofs add constraint order_proofs_approved_by_check CHECK ((approved_by = ANY (ARRAY['staff_manual'::text, 'customer_email'::text, 'customer_whatsapp'::text])));
alter table public.order_proofs add constraint order_proofs_pkey PRIMARY KEY (id);
alter table public.order_proofs add constraint order_proofs_render_method_check CHECK ((render_method = ANY (ARRAY['ai_image'::text, 'canvas_composite'::text, 'manual_upload'::text])));
alter table public.order_proofs add constraint order_proofs_sent_via_check CHECK ((sent_via = ANY (ARRAY['email'::text, 'whatsapp'::text, 'both'::text])));
alter table public.order_proofs add constraint order_proofs_state_check CHECK ((state = ANY (ARRAY['not_started'::text, 'generating'::text, 'draft'::text, 'sent'::text, 'approved'::text, 'changes_requested'::text, 'failed'::text])));
alter table public.gmail_connections add constraint gmail_connections_pkey PRIMARY KEY (id);
alter table public.gmail_connections add constraint gmail_connections_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'error'::text])));
alter table public.ghl_connections add constraint ghl_connections_organization_id_unique UNIQUE (organization_id);
alter table public.ghl_connections add constraint ghl_connections_pkey PRIMARY KEY (id);
alter table public.ghl_connections add constraint ghl_connections_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disconnected'::text, 'error'::text])));
alter table public.whatsapp_connection_events add constraint whatsapp_connection_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['system'::text, 'user'::text, 'provider_webhook'::text, 'support'::text])));
alter table public.whatsapp_connection_events add constraint whatsapp_connection_events_pkey PRIMARY KEY (id);
alter table public.whatsapp_user_preferences add constraint whatsapp_user_preferences_pkey PRIMARY KEY (user_id);
alter table public.whatsapp_user_preferences add constraint whatsapp_user_preferences_preferred_whatsapp_mode_check CHECK ((preferred_whatsapp_mode = ANY (ARRAY['manual'::text, 'managed'::text])));
alter table public.inbox_ai_thread_summaries add constraint inbox_ai_thread_summaries_pkey PRIMARY KEY (id);
alter table public.inbox_ai_thread_summaries add constraint inbox_ai_thread_summaries_scope_allowed CHECK ((scope = ANY (ARRAY['conversation'::text, 'customer_timeline'::text, 'unlinked_timeline'::text])));
alter table public.inbox_ai_thread_summaries add constraint inbox_ai_thread_summaries_scope_shape CHECK ((((scope = 'conversation'::text) AND (conversation_id IS NOT NULL) AND (person_id IS NULL) AND (user_id IS NULL) AND (unlinked_channel IS NULL) AND (unlinked_handle IS NULL)) OR ((scope = 'customer_timeline'::text) AND (person_id IS NOT NULL) AND (conversation_id IS NULL) AND (user_id IS NULL) AND (unlinked_channel IS NULL) AND (unlinked_handle IS NULL)) OR ((scope = 'unlinked_timeline'::text) AND (user_id IS NOT NULL) AND (unlinked_channel IS NOT NULL) AND (unlinked_handle IS NOT NULL) AND (conversation_id IS NULL) AND (person_id IS NULL))));
alter table public.workflow_slas add constraint workflow_slas_check CHECK ((warn_days >= target_days));
alter table public.workflow_slas add constraint workflow_slas_check1 CHECK ((max_days >= warn_days));
alter table public.workflow_slas add constraint workflow_slas_pkey PRIMARY KEY (organization_id, workflow, stage);
alter table public.workflow_slas add constraint workflow_slas_target_days_check CHECK ((target_days >= 0));
alter table public.workflow_slas add constraint workflow_slas_workflow_check CHECK ((workflow = ANY (ARRAY['proof'::text, 'permit'::text, 'install'::text])));
alter table public.permit_email_deliveries add constraint permit_email_deliveries_idempotency_key_key UNIQUE (idempotency_key);
alter table public.permit_email_deliveries add constraint permit_email_deliveries_payload_fingerprint_check CHECK ((payload_fingerprint ~ '^[0-9a-f]{64}$'::text));
alter table public.permit_email_deliveries add constraint permit_email_deliveries_pkey PRIMARY KEY (id);
alter table public.permit_email_deliveries add constraint permit_email_deliveries_provider_check CHECK ((provider = ANY (ARRAY['ghl'::text, 'gmail'::text])));
alter table public.permit_email_deliveries add constraint permit_email_deliveries_provider_message_check CHECK (((status <> 'sent'::text) OR ((NULLIF(TRIM(BOTH FROM provider_message_id), ''::text) IS NOT NULL) AND (sent_at IS NOT NULL))));
alter table public.permit_email_deliveries add constraint permit_email_deliveries_recipient_fingerprint_check CHECK ((recipient_fingerprint ~ '^[0-9a-f]{64}$'::text));
alter table public.permit_email_deliveries add constraint permit_email_deliveries_state_version_check CHECK ((state_version > 0));
alter table public.permit_email_deliveries add constraint permit_email_deliveries_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'sent'::text, 'failed'::text, 'uncertain'::text])));
alter table public.inbox_conversations add constraint inbox_conversations_ai_category_check CHECK (((ai_category IS NULL) OR (ai_category = ANY (ARRAY['sales'::text, 'support'::text, 'admin'::text, 'other'::text]))));
alter table public.inbox_conversations add constraint inbox_conversations_ai_priority_range CHECK (((ai_priority IS NULL) OR ((ai_priority >= 0) AND (ai_priority <= 100))));
alter table public.inbox_conversations add constraint inbox_conversations_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'web'::text])));
alter table public.inbox_conversations add constraint inbox_conversations_enquiry_stage_check CHECK ((enquiry_stage = ANY (ARRAY['new'::text, 'in_progress'::text, 'order_created'::text])));
alter table public.inbox_conversations add constraint inbox_conversations_link_state_check CHECK ((link_state = ANY (ARRAY['linked'::text, 'unlinked'::text, 'ambiguous'::text])));
alter table public.inbox_conversations add constraint inbox_conversations_link_state_person_consistent CHECK (((link_state = 'linked'::text) = (person_id IS NOT NULL)));
alter table public.inbox_conversations add constraint inbox_conversations_pkey PRIMARY KEY (id);
alter table public.inbox_conversations add constraint inbox_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'archived'::text])));
alter table public.inbox_conversations add constraint inbox_conversations_whatsapp_connection_mode_check CHECK ((whatsapp_connection_mode = ANY (ARRAY['manual'::text, 'managed'::text])));
alter table public.partners add constraint partners_email_key UNIQUE (email);
alter table public.partners add constraint partners_pkey PRIMARY KEY (id);
alter table public.partner_sessions add constraint partner_sessions_pkey PRIMARY KEY (id);
alter table public.partner_sessions add constraint partner_sessions_staff_role_check CHECK (((staff_role IS NULL) OR (staff_role = ANY (ARRAY['admin'::text, 'operations'::text]))));
alter table public.partner_sessions add constraint partner_sessions_token_key UNIQUE (token);
alter table public.partner_comments add constraint partner_comments_pkey PRIMARY KEY (id);
alter table public.inscription_requests add constraint inscription_requests_pkey PRIMARY KEY (id);
alter table public.customer_activity add constraint customer_activity_pkey PRIMARY KEY (id);
alter table public.inbox_enquiry_extraction add constraint inbox_enquiry_extraction_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)));
alter table public.inbox_enquiry_extraction add constraint inbox_enquiry_extraction_order_type_check CHECK ((order_type = ANY (ARRAY['new_memorial'::text, 'additional_inscription'::text, 'trade'::text, 'status_query'::text, 'quote'::text])));
alter table public.inbox_enquiry_extraction add constraint inbox_enquiry_extraction_pkey PRIMARY KEY (conversation_id);
alter table public.cemetery_contacts add constraint cemetery_contacts_pkey PRIMARY KEY (id);
alter table public.cemetery_pricing add constraint cemetery_pricing_cemetery_id_memorial_type_key UNIQUE (cemetery_id, memorial_type);
alter table public.cemetery_pricing add constraint cemetery_pricing_memorial_type_check CHECK ((memorial_type = ANY (ARRAY['headstone'::text, 'kerb_set'::text, 'cremation_tablet'::text, 'lawn_memorial'::text, 'flat_tablet'::text, 'renovation'::text])));
alter table public.cemetery_pricing add constraint cemetery_pricing_pkey PRIMARY KEY (id);
alter table public.quotes add constraint quotes_pkey PRIMARY KEY (id);
alter table public.quotes add constraint quotes_quote_number_key UNIQUE (quote_number);
alter table public.password_reset_tokens add constraint password_reset_tokens_pkey PRIMARY KEY (id);
alter table public.password_reset_tokens add constraint password_reset_tokens_token_key UNIQUE (token);
alter table public.admin_sessions add constraint admin_sessions_pkey PRIMARY KEY (id);
alter table public.admin_sessions add constraint admin_sessions_token_key UNIQUE (token);
alter table public.organization_stripe_config add constraint organization_stripe_config_pkey PRIMARY KEY (organization_id);
alter table public.permit_contacts add constraint permit_contacts_category_check CHECK ((category = ANY (ARRAY['gov_uk'::text, 'church_parish'::text, 'other_official'::text])));
alter table public.permit_contacts add constraint permit_contacts_counts_check CHECK (((inbound_count >= 0) AND (outbound_count >= 0) AND (direct_header_count >= 0) AND (body_mention_count >= 0) AND (bounce_count >= 0)));
alter table public.permit_contacts add constraint permit_contacts_delivery_failed_check CHECK (((validation_status <> 'delivery_failed'::text) OR (active = false)));
alter table public.permit_contacts add constraint permit_contacts_email_shape_check CHECK (((email = btrim(email)) AND (POSITION(('@'::text) IN (email)) > 1) AND (POSITION(('.'::text) IN (split_part(email, '@'::text, 2))) > 1)));
alter table public.permit_contacts add constraint permit_contacts_observed_dates_check CHECK (((first_seen_at IS NULL) OR (last_seen_at IS NULL) OR (last_seen_at >= first_seen_at)));
alter table public.permit_contacts add constraint permit_contacts_pkey PRIMARY KEY (id);
alter table public.permit_contacts add constraint permit_contacts_source_metadata_check CHECK ((jsonb_typeof(source_metadata) = 'object'::text));
alter table public.permit_contacts add constraint permit_contacts_validated_date_check CHECK (((validation_status <> ALL (ARRAY['validated_inbound'::text, 'validated_two_way'::text])) OR (validated_at IS NOT NULL)));
alter table public.permit_contacts add constraint permit_contacts_validation_status_check CHECK ((validation_status = ANY (ARRAY['validated_inbound'::text, 'validated_two_way'::text, 'mentioned_only'::text, 'outbound_only'::text, 'delivery_failed'::text, 'legacy_assigned'::text, 'unverified'::text])));
alter table public.cemeteries add constraint cemeteries_governing_body_type_check CHECK ((governing_body_type = ANY (ARRAY['council'::text, 'parish'::text, 'diocese'::text, 'charity'::text, 'private'::text, 'ministry'::text, 'other'::text])));
alter table public.cemeteries add constraint cemeteries_pkey PRIMARY KEY (id);
alter table public.cemeteries add constraint cemeteries_slug_key UNIQUE (slug);
alter table public.enquiries add constraint enquiries_channel_check CHECK ((channel = ANY (ARRAY['quote'::text, 'contact'::text, 'appointment'::text, 'call'::text, 'shortlist'::text, 'partner_order'::text])));
alter table public.enquiries add constraint enquiries_pkey PRIMARY KEY (id);
alter table public.enquiries add constraint enquiries_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'resolved'::text, 'spam'::text])));
alter table public.oauth_state add constraint oauth_state_pkey PRIMARY KEY (nonce);
alter table public.portal_security_events add constraint portal_security_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['anonymous'::text, 'admin'::text, 'partner'::text])));
alter table public.portal_security_events add constraint portal_security_events_event_type_check CHECK (((length(event_type) >= 1) AND (length(event_type) <= 80)));
alter table public.portal_security_events add constraint portal_security_events_identifier_hash_check CHECK (((identifier_hash IS NULL) OR (identifier_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public.portal_security_events add constraint portal_security_events_ip_hash_check CHECK ((ip_hash ~ '^[0-9a-f]{64}$'::text));
alter table public.portal_security_events add constraint portal_security_events_pkey PRIMARY KEY (id);
alter table public.portal_security_events add constraint portal_security_events_user_agent_hash_check CHECK ((user_agent_hash ~ '^[0-9a-f]{64}$'::text));
alter table public.organization_members add constraint organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);
alter table public.organization_members add constraint organization_members_pkey PRIMARY KEY (id);
alter table public.organization_members add constraint organization_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'staff'::text])));
alter table public.organizations add constraint organizations_pkey PRIMARY KEY (id);
alter table public.inbox_messages add constraint inbox_messages_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'web'::text])));
alter table public.inbox_messages add constraint inbox_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
alter table public.inbox_messages add constraint inbox_messages_pkey PRIMARY KEY (id);
alter table public.inbox_messages add constraint inbox_messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'received'::text])));
alter table public.inbox_messages add constraint inbox_messages_whatsapp_connection_mode_check CHECK ((whatsapp_connection_mode = ANY (ARRAY['manual'::text, 'managed'::text])));
alter table public.quote_followups add constraint quote_followups_pkey PRIMARY KEY (id);
alter table public.quote_followups add constraint quote_followups_thread_id_key UNIQUE (thread_id);
alter table public.partner_magic_link_tokens add constraint partner_magic_link_tokens_check CHECK ((expires_at > created_at));
alter table public.partner_magic_link_tokens add constraint partner_magic_link_tokens_pkey PRIMARY KEY (id);
alter table public.partner_magic_link_tokens add constraint partner_magic_link_tokens_token_hash_check CHECK ((token_hash ~ '^sha256:[0-9a-f]{64}$'::text));
alter table public.partner_magic_link_tokens add constraint partner_magic_link_tokens_token_hash_key UNIQUE (token_hash);
alter table public.customer_portal_tokens add constraint customer_portal_tokens_organization_id_person_id_key UNIQUE (organization_id, person_id);
alter table public.customer_portal_tokens add constraint customer_portal_tokens_pkey PRIMARY KEY (id);
alter table public.customer_portal_tokens add constraint customer_portal_tokens_token_hash_check CHECK ((token_hash ~ '^sha256:[0-9a-f]{64}$'::text));
alter table public.customer_portal_tokens add constraint customer_portal_tokens_token_hash_key UNIQUE (token_hash);
alter table public.inbox_muted_senders add constraint inbox_muted_senders_organization_id_normalized_handle_key UNIQUE (organization_id, normalized_handle);
alter table public.inbox_muted_senders add constraint inbox_muted_senders_pkey PRIMARY KEY (id);
alter table public.inbox_muted_senders add constraint inbox_muted_senders_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'seed'::text, 'auto'::text])));
alter table public.permit_forms add constraint permit_forms_active_status_check CHECK ((active_status = ANY (ARRAY['candidate'::text, 'active'::text, 'inactive'::text, 'quarantined'::text, 'superseded'::text, 'source_missing'::text])));
alter table public.permit_forms add constraint permit_forms_ai_confidence_check CHECK (((ai_confidence IS NULL) OR ((ai_confidence >= (0)::numeric) AND (ai_confidence <= (100)::numeric))));
alter table public.permit_forms add constraint permit_forms_duplicate_status_check CHECK ((duplicate_status = ANY (ARRAY['not_checked'::text, 'none_detected'::text, 'exact_name_duplicate'::text, 'possible_same_size_type'::text, 'confirmed_duplicate'::text])));
alter table public.permit_forms add constraint permit_forms_matching_eligibility_check CHECK (((NOT matching_eligible) OR ((review_status = 'confirmed'::text) AND (active_status = 'active'::text) AND (google_drive_file_id IS NOT NULL))));
alter table public.permit_forms add constraint permit_forms_ocr_status_check CHECK ((ocr_status = ANY (ARRAY['not_processed'::text, 'legacy_metadata_available'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
alter table public.permit_forms add constraint permit_forms_pkey PRIMARY KEY (id);
alter table public.permit_forms add constraint permit_forms_reconciliation_status_check CHECK ((reconciliation_status = ANY (ARRAY['legacy_unreconciled'::text, 'canonical_matched'::text, 'canonical_inserted'::text, 'quarantined'::text, 'manual_review'::text])));
alter table public.permit_forms add constraint permit_forms_review_status_check CHECK ((review_status = ANY (ARRAY['needs_review'::text, 'needs_ocr'::text, 'needs_human_confirmation'::text, 'duplicate_review'::text, 'confirmed'::text, 'quarantined'::text])));
alter table public.permit_forms add constraint permit_forms_source_size_check CHECK (((source_size_bytes IS NULL) OR (source_size_bytes >= 0)));
alter table public.jobs add constraint jobs_dormant_needs_wake CHECK (((exit_reason IS DISTINCT FROM 'dormant'::text) OR (wake_at IS NOT NULL)));
alter table public.jobs add constraint jobs_exit_pairs CHECK (((exit_reason IS NULL) = (exited_at IS NULL)));
alter table public.jobs add constraint jobs_exit_reason_check CHECK ((exit_reason = ANY (ARRAY['lost'::text, 'closed'::text, 'dormant'::text, 'on_hold'::text, 'cancelled'::text])));
alter table public.jobs add constraint jobs_pkey PRIMARY KEY (id);
alter table public.jobs add constraint jobs_source_check CHECK ((source = ANY (ARRAY['website'::text, 'email'::text, 'whatsapp'::text, 'sms'::text, 'ghl'::text, 'manual'::text])));
alter table public.jobs add constraint jobs_stage_check CHECK ((stage = ANY (ARRAY['enquired'::text, 'quoted'::text, 'invoiced'::text, 'confirmed'::text, 'in_production'::text, 'fixed'::text, 'complete'::text])));
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_decision_check CHECK ((decision = 'confirmed'::text));
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_evidence_check CHECK ((jsonb_typeof(evidence) = 'object'::text));
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_pkey PRIMARY KEY (id);
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_reasons_check CHECK ((jsonb_typeof(reasons) = 'array'::text));
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_reviewer_check CHECK ((reviewer_session_hash ~ '^[0-9a-f]{16,64}$'::text));
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)));
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_selection_mode_check CHECK ((selection_mode = ANY (ARRAY['rules_shortlist'::text, 'manual_search'::text, 'create_from_address'::text])));
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_decision_check CHECK ((decision = ANY (ARRAY['confirmed'::text, 'rejected'::text])));
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_pkey PRIMARY KEY (id);
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)));
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_selection_mode_check CHECK ((selection_mode = ANY (ARRAY['rules_shortlist'::text, 'manual_search'::text])));
alter table public.permit_documents add constraint permit_documents_drive_id_check CHECK ((google_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'::text));
alter table public.permit_documents add constraint permit_documents_extracted_fields_check CHECK ((jsonb_typeof(extracted_fields) = 'object'::text));
alter table public.permit_documents add constraint permit_documents_mime_check CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text, 'application/vnd.google-apps.document'::text, 'image/jpeg'::text, 'image/png'::text])));
alter table public.permit_documents add constraint permit_documents_ocr_status_check CHECK ((ocr_status = ANY (ARRAY['pending'::text, 'processing'::text, 'complete'::text, 'failed'::text, 'not_required'::text])));
alter table public.permit_documents add constraint permit_documents_order_id_document_role_google_drive_file_i_key UNIQUE (order_id, document_role, google_drive_file_id);
alter table public.permit_documents add constraint permit_documents_pkey PRIMARY KEY (id);
alter table public.permit_documents add constraint permit_documents_review_status_check CHECK ((review_status = ANY (ARRAY['needs_review'::text, 'confirmed'::text, 'rejected'::text])));
alter table public.permit_documents add constraint permit_documents_reviewer_check CHECK (((reviewer_session_hash IS NULL) OR (reviewer_session_hash ~ '^[0-9a-f]{16,64}$'::text)));
alter table public.permit_documents add constraint permit_documents_role_check CHECK ((document_role = ANY (ARRAY['customer_return'::text, 'completed_application'::text, 'cemetery_submission'::text, 'authority_response'::text, 'written_approval'::text, 'supporting_evidence'::text])));
alter table public.permit_documents add constraint permit_documents_url_check CHECK ((document_url ~ '^https://drive[.]google[.]com/'::text));
alter table public.order_tracking_tokens add constraint order_tracking_tokens_pkey PRIMARY KEY (order_id);
alter table public.order_tracking_tokens add constraint order_tracking_tokens_token_hash_check CHECK ((token_hash ~ '^sha256:[0-9a-f]{64}$'::text));
alter table public.order_tracking_tokens add constraint order_tracking_tokens_token_hash_key UNIQUE (token_hash);
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_deliveries_fingerprints_check CHECK (((recipient_fingerprint ~ '^[0-9a-f]{64}$'::text) AND (payload_fingerprint ~ '^[0-9a-f]{64}$'::text)));
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_deliveries_provider_check CHECK ((provider = 'gmail'::text));
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_deliveries_sent_check CHECK ((((status = 'sent'::text) AND (sent_at IS NOT NULL) AND (provider_message_id IS NOT NULL)) OR (status <> 'sent'::text)));
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_deliveries_state_version_check CHECK ((state_version > 0));
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_deliveries_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'sent'::text, 'failed'::text, 'uncertain'::text])));
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_idempotency_key_key UNIQUE (idempotency_key);
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_pkey PRIMARY KEY (id);
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_burial_ground_name_check CHECK (((char_length(btrim(burial_ground_name)) >= 2) AND (char_length(btrim(burial_ground_name)) <= 200)));
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)));
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_email_category_check CHECK ((email_category = ANY (ARRAY['gov_uk'::text, 'church_parish'::text, 'other_official'::text])));
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_governing_body_type_check CHECK (((governing_body_type IS NULL) OR (governing_body_type = ANY (ARRAY['council'::text, 'parish'::text, 'church'::text, 'diocese'::text, 'private'::text, 'charity'::text, 'other'::text]))));
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_normalized_email_check CHECK ((normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text));
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_pkey PRIMARY KEY (id);
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_source_url_check CHECK ((source_url ~ '^https://'::text));
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'verified'::text, 'rejected'::text, 'promoted'::text, 'stale'::text])));
alter table public.invoice_line_items add constraint invoice_line_items_currency_check CHECK ((currency ~ '^[a-z]{3}$'::text));
alter table public.invoice_line_items add constraint invoice_line_items_invoice_position_key UNIQUE (invoice_id, line_position);
alter table public.invoice_line_items add constraint invoice_line_items_line_type_check CHECK ((line_type = ANY (ARRAY['memorial'::text, 'renovation'::text, 'addon'::text, 'permit'::text, 'discount'::text, 'adjustment'::text, 'other'::text])));
alter table public.invoice_line_items add constraint invoice_line_items_permit_gate_check CHECK (((line_type <> 'permit'::text) OR (counts_toward_order_value = false)));
alter table public.invoice_line_items add constraint invoice_line_items_pkey PRIMARY KEY (id);
alter table public.invoice_line_items add constraint invoice_line_items_quantity_check CHECK ((quantity > (0)::numeric));
alter table public.invoice_line_items add constraint invoice_line_items_source_check CHECK ((source = ANY (ARRAY['order'::text, 'stripe'::text, 'manual'::text, 'migration'::text])));
alter table public.invoice_line_items add constraint invoice_line_items_tax_components_check CHECK (((net_amount_pence IS NULL) OR (vat_amount_pence IS NULL) OR ((net_amount_pence + vat_amount_pence) = gross_amount_pence)));
alter table public.invoice_line_items add constraint invoice_line_items_tax_rate_check CHECK (((tax_rate_basis_points IS NULL) OR ((tax_rate_basis_points >= 0) AND (tax_rate_basis_points <= 10000))));
alter table public.invoice_line_items add constraint invoice_line_items_tax_treatment_check CHECK ((tax_treatment = ANY (ARRAY['unconfirmed'::text, 'standard'::text, 'reduced'::text, 'zero'::text, 'exempt'::text, 'outside_scope'::text, 'disbursement'::text])));
alter table public.invoice_payments add constraint invoice_payments_allocation_not_over_amount_check CHECK (((COALESCE(qualifying_amount_pence, (0)::bigint) + COALESCE(permit_amount_pence, (0)::bigint)) <= amount));
alter table public.invoice_payments add constraint invoice_payments_manual_recorder_check CHECK (((source <> 'manual'::text) OR (user_id IS NOT NULL)));
alter table public.invoice_payments add constraint invoice_payments_manual_verifier_check CHECK (((source <> 'manual'::text) OR (verified_at IS NULL) OR (verified_by_user_id IS NOT NULL)));
alter table public.invoice_payments add constraint invoice_payments_permit_amount_check CHECK (((permit_amount_pence IS NULL) OR (permit_amount_pence >= 0)));
alter table public.invoice_payments add constraint invoice_payments_pkey PRIMARY KEY (id);
alter table public.invoice_payments add constraint invoice_payments_qualifying_amount_check CHECK (((qualifying_amount_pence IS NULL) OR (qualifying_amount_pence >= 0)));
alter table public.invoice_payments add constraint invoice_payments_reversal_pair_check CHECK (((reversed_at IS NULL) = (reversal_reason IS NULL)));
alter table public.invoice_payments add constraint invoice_payments_source_check CHECK ((source = ANY (ARRAY['unknown'::text, 'stripe'::text, 'manual'::text, 'migration'::text])));
alter table public.invoice_payments add constraint invoice_payments_stripe_evidence_check CHECK (((source <> 'stripe'::text) OR (stripe_invoice_payment_id IS NOT NULL)));
alter table public.invoice_payments add constraint invoice_payments_verification_actor_check CHECK (((verified_by_user_id IS NULL) OR (verified_at IS NOT NULL)));
alter table public.whatsapp_managed_connections add constraint whatsapp_managed_connections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.whatsapp_managed_connections add constraint whatsapp_managed_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.ghl_send_idempotency add constraint ghl_send_idempotency_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.companies add constraint companies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.quote_access_tokens add constraint quote_access_tokens_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.quote_access_tokens add constraint quote_access_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.memorials add constraint memorials_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_payments add constraint order_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.order_payments add constraint order_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.order_events add constraint order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.orders add constraint orders_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id);
alter table public.orders add constraint orders_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
alter table public.orders add constraint orders_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id);
alter table public.orders add constraint orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.orders add constraint orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
alter table public.orders add constraint orders_permit_form_id_fkey FOREIGN KEY (permit_form_id) REFERENCES permit_forms(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.table_view_presets add constraint table_view_presets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.inbox_ai_suggestions add constraint inbox_ai_suggestions_message_id_fkey FOREIGN KEY (message_id) REFERENCES inbox_messages(id) ON DELETE CASCADE;
alter table public.inbox_ai_suggestions add constraint inbox_ai_suggestions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.inscriptions add constraint inscriptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.inscriptions add constraint inscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.order_people add constraint order_people_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_people add constraint order_people_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.order_people add constraint order_people_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT;
alter table public.order_additional_options add constraint order_additional_options_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_additional_options add constraint order_additional_options_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.order_permits add constraint order_permits_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id);
alter table public.order_permits add constraint order_permits_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_permits add constraint order_permits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.order_permits add constraint order_permits_permit_form_id_fkey FOREIGN KEY (permit_form_id) REFERENCES permit_forms(id);
alter table public.people add constraint customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.invoices add constraint invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id);
alter table public.invoices add constraint invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.invoices add constraint invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.invoices add constraint invoices_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT;
alter table public.invoices add constraint invoices_revised_from_invoice_id_fkey FOREIGN KEY (revised_from_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
alter table public.invoices add constraint invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.order_proof_versions add constraint order_proof_versions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.order_proof_versions add constraint order_proof_versions_proof_id_fkey FOREIGN KEY (proof_id) REFERENCES order_proofs(id) ON DELETE CASCADE;
alter table public.whatsapp_connections add constraint whatsapp_connections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.whatsapp_connections add constraint whatsapp_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.product_sizes add constraint product_sizes_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.activity_logs add constraint activity_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.products add constraint products_category_id_fkey FOREIGN KEY (category_id) REFERENCES product_categories(id);
alter table public.products add constraint products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.order_proof_ai_checks add constraint order_proof_ai_checks_dismissed_by_fkey FOREIGN KEY (dismissed_by) REFERENCES auth.users(id);
alter table public.order_proof_ai_checks add constraint order_proof_ai_checks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.order_proof_ai_checks add constraint order_proof_ai_checks_proof_id_fkey FOREIGN KEY (proof_id) REFERENCES order_proofs(id) ON DELETE CASCADE;
alter table public.order_proofs add constraint order_proofs_inbox_conversation_id_fkey FOREIGN KEY (inbox_conversation_id) REFERENCES inbox_conversations(id) ON DELETE SET NULL;
alter table public.order_proofs add constraint order_proofs_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_proofs add constraint order_proofs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.order_proofs add constraint order_proofs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.gmail_connections add constraint gmail_connections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.gmail_connections add constraint gmail_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.ghl_connections add constraint ghl_connections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.whatsapp_connection_events add constraint whatsapp_connection_events_managed_connection_id_fkey FOREIGN KEY (managed_connection_id) REFERENCES whatsapp_managed_connections(id) ON DELETE CASCADE;
alter table public.whatsapp_connection_events add constraint whatsapp_connection_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.whatsapp_connection_events add constraint whatsapp_connection_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.whatsapp_user_preferences add constraint whatsapp_user_preferences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.whatsapp_user_preferences add constraint whatsapp_user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.inbox_ai_thread_summaries add constraint inbox_ai_thread_summaries_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id) ON DELETE CASCADE;
alter table public.inbox_ai_thread_summaries add constraint inbox_ai_thread_summaries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.inbox_ai_thread_summaries add constraint inbox_ai_thread_summaries_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;
alter table public.inbox_ai_thread_summaries add constraint inbox_ai_thread_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workflow_slas add constraint workflow_slas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.permit_email_deliveries add constraint permit_email_deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
alter table public.permit_email_deliveries add constraint permit_email_deliveries_permit_id_fkey FOREIGN KEY (permit_id) REFERENCES order_permits(id) ON DELETE RESTRICT;
alter table public.inbox_conversations add constraint inbox_conversations_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.inbox_conversations add constraint inbox_conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.inbox_conversations add constraint inbox_conversations_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
alter table public.inbox_conversations add constraint inbox_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.inbox_conversations add constraint inbox_conversations_whatsapp_managed_connection_id_fkey FOREIGN KEY (whatsapp_managed_connection_id) REFERENCES whatsapp_managed_connections(id) ON DELETE SET NULL;
alter table public.partner_sessions add constraint partner_sessions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
alter table public.partner_comments add constraint partner_comments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
alter table public.partner_comments add constraint partner_comments_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
alter table public.inscription_requests add constraint inscription_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
alter table public.customer_activity add constraint customer_activity_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES people(id);
alter table public.customer_activity add constraint customer_activity_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
alter table public.inbox_enquiry_extraction add constraint inbox_enquiry_extraction_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id) ON DELETE CASCADE;
alter table public.inbox_enquiry_extraction add constraint inbox_enquiry_extraction_linked_order_id_fkey FOREIGN KEY (linked_order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.inbox_enquiry_extraction add constraint inbox_enquiry_extraction_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.cemetery_contacts add constraint cemetery_contacts_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id) ON DELETE CASCADE;
alter table public.cemetery_pricing add constraint cemetery_pricing_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id) ON DELETE CASCADE;
alter table public.quotes add constraint quotes_converted_to_order_id_fkey FOREIGN KEY (converted_to_order_id) REFERENCES orders(id);
alter table public.quotes add constraint quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES people(id);
alter table public.quotes add constraint quotes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.quotes add constraint quotes_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
alter table public.password_reset_tokens add constraint password_reset_tokens_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
alter table public.organization_stripe_config add constraint organization_stripe_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.cemeteries add constraint cemeteries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.cemeteries add constraint cemeteries_permit_contact_id_fkey FOREIGN KEY (permit_contact_id) REFERENCES permit_contacts(id) ON DELETE SET NULL;
alter table public.cemeteries add constraint cemeteries_permit_form_id_fkey FOREIGN KEY (permit_form_id) REFERENCES permit_forms(id) ON DELETE SET NULL;
alter table public.enquiries add constraint enquiries_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id) ON DELETE SET NULL;
alter table public.enquiries add constraint enquiries_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.enquiries add constraint enquiries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.enquiries add constraint enquiries_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id);
alter table public.oauth_state add constraint oauth_state_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.oauth_state add constraint oauth_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.organization_members add constraint organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.organization_members add constraint organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.inbox_messages add constraint inbox_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id) ON DELETE CASCADE;
alter table public.inbox_messages add constraint inbox_messages_gmail_connection_id_fkey FOREIGN KEY (gmail_connection_id) REFERENCES gmail_connections(id) ON DELETE SET NULL;
alter table public.inbox_messages add constraint inbox_messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.inbox_messages add constraint inbox_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.inbox_messages add constraint inbox_messages_whatsapp_connection_id_fkey FOREIGN KEY (whatsapp_connection_id) REFERENCES whatsapp_connections(id) ON DELETE SET NULL;
alter table public.inbox_messages add constraint inbox_messages_whatsapp_managed_connection_id_fkey FOREIGN KEY (whatsapp_managed_connection_id) REFERENCES whatsapp_managed_connections(id) ON DELETE SET NULL;
alter table public.partner_magic_link_tokens add constraint partner_magic_link_tokens_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
alter table public.customer_portal_tokens add constraint customer_portal_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.customer_portal_tokens add constraint customer_portal_tokens_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE;
alter table public.inbox_muted_senders add constraint inbox_muted_senders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.permit_forms add constraint permit_forms_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id);
alter table public.permit_forms add constraint permit_forms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.jobs add constraint jobs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id);
alter table public.jobs add constraint jobs_enquiry_id_fkey FOREIGN KEY (enquiry_id) REFERENCES enquiries(id);
alter table public.jobs add constraint jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.jobs add constraint jobs_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id);
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_resolved_cemetery_id_fkey FOREIGN KEY (resolved_cemetery_id) REFERENCES cemeteries(id);
alter table public.cemetery_match_reviews add constraint cemetery_match_reviews_source_cemetery_id_fkey FOREIGN KEY (source_cemetery_id) REFERENCES cemeteries(id) ON DELETE SET NULL;
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_permit_form_id_fkey FOREIGN KEY (permit_form_id) REFERENCES permit_forms(id);
alter table public.permit_form_match_reviews add constraint permit_form_match_reviews_previous_permit_form_id_fkey FOREIGN KEY (previous_permit_form_id) REFERENCES permit_forms(id);
alter table public.permit_documents add constraint permit_documents_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.permit_documents add constraint permit_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.permit_documents add constraint permit_documents_parent_document_id_fkey FOREIGN KEY (parent_document_id) REFERENCES permit_documents(id) ON DELETE SET NULL;
alter table public.permit_documents add constraint permit_documents_permit_id_fkey FOREIGN KEY (permit_id) REFERENCES order_permits(id) ON DELETE CASCADE;
alter table public.order_tracking_tokens add constraint order_tracking_tokens_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_tracking_tokens add constraint order_tracking_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id);
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_permit_contact_id_fkey FOREIGN KEY (permit_contact_id) REFERENCES permit_contacts(id);
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_permit_document_id_fkey FOREIGN KEY (permit_document_id) REFERENCES permit_documents(id);
alter table public.permit_cemetery_email_deliveries add constraint permit_cemetery_email_deliveries_permit_id_fkey FOREIGN KEY (permit_id) REFERENCES order_permits(id) ON DELETE CASCADE;
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_cemetery_id_fkey FOREIGN KEY (cemetery_id) REFERENCES cemeteries(id) ON DELETE SET NULL;
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.burial_ground_contact_candidates add constraint burial_ground_contact_candidates_promoted_contact_id_fkey FOREIGN KEY (promoted_contact_id) REFERENCES cemetery_contacts(id) ON DELETE SET NULL;
alter table public.invoice_line_items add constraint invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
alter table public.invoice_line_items add constraint invoice_line_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
alter table public.invoice_line_items add constraint invoice_line_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.invoice_line_items add constraint invoice_line_items_source_order_additional_option_id_fkey FOREIGN KEY (source_order_additional_option_id) REFERENCES order_additional_options(id);
alter table public.invoice_payments add constraint invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
alter table public.invoice_payments add constraint invoice_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.invoice_payments add constraint invoice_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX idx_invoice_payments_stripe_invoice_id ON public.invoice_payments USING btree (stripe_invoice_id);
CREATE INDEX order_payments_received_at_idx ON public.order_payments USING btree (received_at DESC);
CREATE INDEX idx_inbox_messages_user_id ON public.inbox_messages USING btree (user_id);
CREATE INDEX idx_permit_forms_name ON public.permit_forms USING btree (name);
CREATE INDEX idx_order_permits_cemetery_id ON public.order_permits USING btree (cemetery_id);
CREATE INDEX orders_job_idx ON public.orders USING btree (job_id) WHERE (job_id IS NOT NULL);
CREATE INDEX idx_inbox_conversations_user_id ON public.inbox_conversations USING btree (user_id);
CREATE INDEX idx_order_proofs_organization_id ON public.order_proofs USING btree (organization_id);
CREATE INDEX idx_orders_invoice_id ON public.orders USING btree (invoice_id);
CREATE INDEX cemeteries_permit_form_id_idx ON public.cemeteries USING btree (permit_form_id) WHERE (permit_form_id IS NOT NULL);
CREATE UNIQUE INDEX order_permits_org_order_uidx ON public.order_permits USING btree (organization_id, order_id);
CREATE INDEX idx_orders_partner ON public.orders USING btree (partner_id) WHERE (partner_id IS NOT NULL);
CREATE INDEX idx_whatsapp_connections_twilio_lookup ON public.whatsapp_connections USING btree (twilio_account_sid, whatsapp_from) WHERE (status = 'connected'::text);
CREATE UNIQUE INDEX idx_whatsapp_managed_one_active_per_user ON public.whatsapp_managed_connections USING btree (user_id) WHERE (state <> ALL (ARRAY['failed'::text, 'disconnected'::text]));
CREATE INDEX idx_orders_permit_form_id ON public.orders USING btree (permit_form_id);
CREATE INDEX idx_whatsapp_managed_user_state ON public.whatsapp_managed_connections USING btree (user_id, state);
CREATE UNIQUE INDEX idx_inbox_messages_channel_external_message_id ON public.inbox_messages USING btree (channel, external_message_id) WHERE (external_message_id IS NOT NULL);
CREATE INDEX idx_quotes_customer ON public.quotes USING btree (customer_id);
CREATE INDEX cemeteries_permit_contact_id_idx ON public.cemeteries USING btree (permit_contact_id) WHERE (permit_contact_id IS NOT NULL);
CREATE INDEX order_tracking_tokens_org_expiry_idx ON public.order_tracking_tokens USING btree (organization_id, expires_at);
CREATE INDEX jobs_org_stage_idx ON public.jobs USING btree (organization_id, stage) WHERE (exit_reason IS NULL);
CREATE INDEX password_reset_tokens_expires_at_idx ON public.password_reset_tokens USING btree (expires_at);
CREATE INDEX invoice_payments_received_idx ON public.invoice_payments USING btree (organization_id, received_at DESC) WHERE (received_at IS NOT NULL);
CREATE INDEX permit_form_match_reviews_order_created_idx ON public.permit_form_match_reviews USING btree (order_id, created_at DESC);
CREATE INDEX idx_orders_organization_id ON public.orders USING btree (organization_id);
CREATE INDEX idx_oauth_state_expires_at ON public.oauth_state USING btree (expires_at);
CREATE INDEX idx_order_permits_permit_phase ON public.order_permits USING btree (permit_phase);
CREATE INDEX order_people_order_id_idx ON public.order_people USING btree (order_id);
CREATE INDEX idx_whatsapp_managed_platform_sender ON public.whatsapp_managed_connections USING btree (platform_twilio_account_sid, twilio_sender);
CREATE INDEX portal_rate_limits_expires_at_idx ON public.portal_rate_limits USING btree (expires_at);
CREATE INDEX idx_enquiries_person ON public.enquiries USING btree (person_id);
CREATE INDEX inbox_messages_conversation_id_sent_at_idx ON public.inbox_messages USING btree (conversation_id, sent_at);
CREATE INDEX idx_enquiries_org_created ON public.enquiries USING btree (organization_id, created_at DESC);
CREATE INDEX idx_order_additional_options_organization_id ON public.order_additional_options USING btree (organization_id);
CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);
CREATE INDEX idx_whatsapp_managed_from_lookup ON public.whatsapp_managed_connections USING btree (platform_twilio_account_sid, display_number) WHERE (state = 'connected'::text);
CREATE INDEX idx_inscription_requests_order ON public.inscription_requests USING btree (order_id);
CREATE INDEX invoices_finance_type_idx ON public.invoices USING btree (organization_id, invoice_type, status) WHERE (deleted_at IS NULL);
CREATE INDEX partner_magic_link_tokens_partner_id_idx ON public.partner_magic_link_tokens USING btree (partner_id);
CREATE INDEX idx_enquiries_created ON public.enquiries USING btree (created_at DESC);
CREATE INDEX idx_order_proofs_state ON public.order_proofs USING btree (state);
CREATE INDEX idx_order_proofs_order_id ON public.order_proofs USING btree (order_id);
CREATE UNIQUE INDEX orders_order_number_uidx ON public.orders USING btree (order_number) WHERE (order_number IS NOT NULL);
CREATE INDEX admin_sessions_expires_at_idx ON public.admin_sessions USING btree (expires_at);
CREATE INDEX idx_people_organization_id ON public.people USING btree (organization_id);
CREATE INDEX ghl_send_idempotency_org_created_idx ON public.ghl_send_idempotency USING btree (organization_id, created_at DESC);
CREATE INDEX jobs_org_exited_idx ON public.jobs USING btree (organization_id, exit_reason) WHERE (exit_reason IS NOT NULL);
CREATE INDEX idx_inbox_conversations_link_state_last_message_at ON public.inbox_conversations USING btree (link_state, last_message_at DESC NULLS LAST);
CREATE INDEX idx_product_sizes_product ON public.product_sizes USING btree (product_id);
CREATE INDEX idx_quotes_status ON public.quotes USING btree (status);
CREATE INDEX idx_cemeteries_active ON public.cemeteries USING btree (is_active);
CREATE INDEX inbox_conversations_status_last_message_at_idx ON public.inbox_conversations USING btree (status, last_message_at DESC);
CREATE INDEX idx_orders_edit_token ON public.orders USING btree (edit_token) WHERE (edit_token IS NOT NULL);
CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments USING btree (invoice_id);
CREATE UNIQUE INDEX burial_contact_candidates_cemetery_email_uidx ON public.burial_ground_contact_candidates USING btree (organization_id, cemetery_id, normalized_email) WHERE (cemetery_id IS NOT NULL);
CREATE INDEX invoice_line_items_order_id_idx ON public.invoice_line_items USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX idx_admin_sessions_token ON public.admin_sessions USING btree (token);
CREATE INDEX idx_order_events_order ON public.order_events USING btree (order_id, created_at DESC);
CREATE INDEX inbox_conversations_channel_primary_handle_idx ON public.inbox_conversations USING btree (channel, primary_handle);
CREATE INDEX idx_table_view_presets_module ON public.table_view_presets USING btree (module);
CREATE INDEX idx_order_people_order_id ON public.order_people USING btree (order_id);
CREATE UNIQUE INDEX idx_invoice_payments_unique_payment_intent ON public.invoice_payments USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);
CREATE INDEX order_permits_work_queue_idx ON public.order_permits USING btree (organization_id, waiting_on, next_action_at, permit_phase, order_id) WHERE (permit_phase <> 'approved'::text);
CREATE INDEX idx_inbox_conversations_enquiry_pipeline ON public.inbox_conversations USING btree (organization_id, enquiry_stage, last_message_at DESC NULLS LAST) WHERE ((status = 'open'::text) AND (order_id IS NULL));
CREATE INDEX idx_permit_forms_cemetery_id ON public.permit_forms USING btree (cemetery_id);
CREATE INDEX idx_people_phone ON public.people USING btree (phone);
CREATE INDEX invoice_line_items_invoice_idx ON public.invoice_line_items USING btree (organization_id, invoice_id, line_position);
CREATE INDEX invoices_job_idx ON public.invoices USING btree (job_id) WHERE (job_id IS NOT NULL);
CREATE UNIQUE INDEX invoice_payments_stripe_payment_record_uidx ON public.invoice_payments USING btree (stripe_payment_record_id) WHERE (stripe_payment_record_id IS NOT NULL);
CREATE INDEX portal_security_events_created_at_idx ON public.portal_security_events USING btree (created_at DESC);
CREATE INDEX idx_enquiries_channel ON public.enquiries USING btree (channel);
CREATE UNIQUE INDEX payments_stripe_reference_unique_idx ON public.payments USING btree (reference) WHERE (reference IS NOT NULL);
CREATE UNIQUE INDEX idx_table_view_presets_one_default_per_module ON public.table_view_presets USING btree (module) WHERE (is_default = true);
CREATE INDEX invoice_payments_user_id_idx ON public.invoice_payments USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX idx_gmail_connections_one_active_per_org ON public.gmail_connections USING btree (organization_id) WHERE (status = 'active'::text);
CREATE INDEX idx_activity_logs_organization_id ON public.activity_logs USING btree (organization_id);
CREATE INDEX idx_orders_product_id ON public.orders USING btree (product_id);
CREATE INDEX invoice_line_items_order_idx ON public.invoice_line_items USING btree (organization_id, order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX idx_customer_activity_customer ON public.customer_activity USING btree (customer_id);
CREATE INDEX quote_access_tokens_org_expiry_idx ON public.quote_access_tokens USING btree (organization_id, expires_at);
CREATE INDEX idx_whatsapp_managed_user_status ON public.whatsapp_managed_connections USING btree (user_id, state, updated_at DESC);
CREATE INDEX idx_products_active ON public.products USING btree (is_active);
CREATE UNIQUE INDEX burial_contact_candidates_name_email_uidx ON public.burial_ground_contact_candidates USING btree (organization_id, lower(btrim(burial_ground_name)), normalized_email) WHERE (cemetery_id IS NULL);
CREATE UNIQUE INDEX idx_inbox_ai_thread_summaries_person ON public.inbox_ai_thread_summaries USING btree (person_id) WHERE (scope = 'customer_timeline'::text);
CREATE INDEX idx_inbox_conversations_organization_id ON public.inbox_conversations USING btree (organization_id);
CREATE UNIQUE INDEX idx_order_people_one_primary_per_order ON public.order_people USING btree (order_id) WHERE (is_primary = true);
CREATE INDEX idx_inbox_messages_conversation_id ON public.inbox_messages USING btree (conversation_id);
CREATE UNIQUE INDEX inbox_messages_channel_external_message_id_idx ON public.inbox_messages USING btree (channel, external_message_id) WHERE (external_message_id IS NOT NULL);
CREATE INDEX idx_order_proof_ai_checks_proof ON public.order_proof_ai_checks USING btree (proof_id, version DESC);
CREATE INDEX idx_inbox_messages_whatsapp_connection_id ON public.inbox_messages USING btree (whatsapp_connection_id);
CREATE INDEX idx_partner_comments_order ON public.partner_comments USING btree (order_id);
CREATE UNIQUE INDEX idx_inbox_ai_suggestions_message_id ON public.inbox_ai_suggestions USING btree (message_id);
CREATE INDEX idx_inbox_conversations_whatsapp_managed_connection_id ON public.inbox_conversations USING btree (whatsapp_managed_connection_id);
CREATE INDEX idx_inbox_messages_whatsapp_managed_connection_id ON public.inbox_messages USING btree (whatsapp_managed_connection_id);
CREATE INDEX idx_cemeteries_organization_id ON public.cemeteries USING btree (organization_id);
CREATE INDEX idx_invoice_payments_organization_id ON public.invoice_payments USING btree (organization_id);
CREATE UNIQUE INDEX invoice_line_items_stripe_invoice_item_uidx ON public.invoice_line_items USING btree (stripe_invoice_item_id) WHERE (stripe_invoice_item_id IS NOT NULL);
CREATE UNIQUE INDEX idx_inbox_ai_thread_summaries_unlinked_user ON public.inbox_ai_thread_summaries USING btree (user_id, unlinked_channel, unlinked_handle) WHERE (scope = 'unlinked_timeline'::text);
CREATE UNIQUE INDEX permit_email_deliveries_active_send_idx ON public.permit_email_deliveries USING btree (organization_id, order_id, state_version) WHERE (status = ANY (ARRAY['reserved'::text, 'sent'::text, 'uncertain'::text]));
CREATE INDEX idx_products_featured ON public.products USING btree (is_featured);
CREATE INDEX partner_sessions_actor_email_idx ON public.partner_sessions USING btree (actor_email) WHERE (actor_email IS NOT NULL);
CREATE INDEX idx_enquiries_order ON public.enquiries USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE UNIQUE INDEX permit_cemetery_deliveries_active_state_uidx ON public.permit_cemetery_email_deliveries USING btree (organization_id, order_id, state_version) WHERE (status = ANY (ARRAY['reserved'::text, 'sent'::text, 'uncertain'::text]));
CREATE INDEX idx_quotes_partner ON public.quotes USING btree (partner_id);
CREATE INDEX invoices_deleted_at_idx ON public.invoices USING btree (deleted_at);
CREATE INDEX idx_inbox_enquiry_extraction_org ON public.inbox_enquiry_extraction USING btree (organization_id);
CREATE INDEX idx_order_proof_ai_checks_organization_id ON public.order_proof_ai_checks USING btree (organization_id);
CREATE INDEX partner_magic_link_tokens_expires_at_idx ON public.partner_magic_link_tokens USING btree (expires_at);
CREATE INDEX idx_inbox_conversations_person_id_last_message_at ON public.inbox_conversations USING btree (person_id, last_message_at DESC NULLS LAST) WHERE (person_id IS NOT NULL);
CREATE INDEX idx_quote_followups_status ON public.quote_followups USING btree (status);
CREATE INDEX idx_customer_activity_order ON public.customer_activity USING btree (order_id);
CREATE INDEX order_people_person_id_idx ON public.order_people USING btree (person_id);
CREATE INDEX idx_order_people_person_id ON public.order_people USING btree (person_id);
CREATE INDEX idx_enquiries_status ON public.enquiries USING btree (status);
CREATE INDEX idx_inscriptions_organization_id ON public.inscriptions USING btree (organization_id);
CREATE INDEX idx_order_permits_organization_id ON public.order_permits USING btree (organization_id);
CREATE UNIQUE INDEX invoice_payments_stripe_invoice_payment_uidx ON public.invoice_payments USING btree (stripe_invoice_payment_id) WHERE (stripe_invoice_payment_id IS NOT NULL);
CREATE INDEX permit_email_deliveries_order_id_idx ON public.permit_email_deliveries USING btree (order_id);
CREATE UNIQUE INDEX invoice_line_items_stripe_line_uidx ON public.invoice_line_items USING btree (stripe_invoice_line_item_id) WHERE (stripe_invoice_line_item_id IS NOT NULL);
CREATE INDEX idx_orders_email_type ON public.orders USING btree (customer_email, order_type);
CREATE INDEX idx_inbox_conversations_last_inbound_at ON public.inbox_conversations USING btree (last_inbound_at DESC NULLS LAST);
CREATE INDEX idx_invoices_order_id ON public.invoices USING btree (order_id);
CREATE INDEX idx_whatsapp_connection_events_managed_connection_id ON public.whatsapp_connection_events USING btree (managed_connection_id, occurred_at DESC);
CREATE INDEX idx_inbox_conversations_order_id ON public.inbox_conversations USING btree (order_id);
CREATE INDEX cemetery_match_reviews_order_idx ON public.cemetery_match_reviews USING btree (organization_id, order_id, created_at DESC);
CREATE UNIQUE INDEX order_people_one_primary_per_order ON public.order_people USING btree (order_id) WHERE (is_primary = true);
CREATE INDEX idx_inbox_conversations_person_id ON public.inbox_conversations USING btree (person_id);
CREATE INDEX idx_people_name ON public.people USING btree (last_name, first_name);
CREATE INDEX idx_inbox_messages_gmail_connection_id ON public.inbox_messages USING btree (gmail_connection_id);
CREATE INDEX idx_inbox_enquiry_extraction_linked_order ON public.inbox_enquiry_extraction USING btree (linked_order_id) WHERE (linked_order_id IS NOT NULL);
CREATE INDEX idx_password_reset_partner ON public.password_reset_tokens USING btree (partner_id);
CREATE UNIQUE INDEX permit_contacts_normalized_email_uidx ON public.permit_contacts USING btree (normalized_email);
CREATE INDEX cemetery_contacts_cemetery_id_idx ON public.cemetery_contacts USING btree (cemetery_id);
CREATE UNIQUE INDEX idx_inbox_ai_thread_summaries_conversation ON public.inbox_ai_thread_summaries USING btree (conversation_id) WHERE (scope = 'conversation'::text);
CREATE INDEX idx_order_proof_versions_proof ON public.order_proof_versions USING btree (proof_id, version DESC);
CREATE INDEX idx_products_category ON public.products USING btree (category_id);
CREATE INDEX idx_inbox_messages_organization_id ON public.inbox_messages USING btree (organization_id);
CREATE INDEX idx_invoices_user_id ON public.invoices USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_invoices_organization_id ON public.invoices USING btree (organization_id);
CREATE INDEX idx_table_view_presets_organization_id ON public.table_view_presets USING btree (organization_id);
CREATE INDEX idx_whatsapp_connections_user_id ON public.whatsapp_connections USING btree (user_id);
CREATE INDEX invoice_line_items_source_option_id_idx ON public.invoice_line_items USING btree (source_order_additional_option_id) WHERE (source_order_additional_option_id IS NOT NULL);
CREATE INDEX burial_contact_candidates_review_idx ON public.burial_ground_contact_candidates USING btree (organization_id, status, confidence DESC, discovered_at DESC);
CREATE INDEX idx_gmail_connections_user_id ON public.gmail_connections USING btree (user_id);
CREATE INDEX idx_gmail_connections_organization_id ON public.gmail_connections USING btree (organization_id);
CREATE UNIQUE INDEX permit_forms_organization_drive_file_uidx ON public.permit_forms USING btree (organization_id, google_drive_file_id) WHERE (google_drive_file_id IS NOT NULL);
CREATE INDEX idx_cemeteries_region ON public.cemeteries USING btree (region);
CREATE INDEX idx_payments_organization_id ON public.payments USING btree (organization_id);
CREATE INDEX idx_order_proofs_user_id ON public.order_proofs USING btree (user_id);
CREATE INDEX idx_partner_sessions_token ON public.partner_sessions USING btree (token);
CREATE INDEX people_email_lower_idx ON public.people USING btree (lower(email));
CREATE INDEX activity_logs_entity_idx ON public.activity_logs USING btree (entity_type, entity_id, created_at DESC);
CREATE INDEX order_payments_org_idx ON public.order_payments USING btree (organization_id);
CREATE UNIQUE INDEX partner_magic_link_tokens_one_per_partner_idx ON public.partner_magic_link_tokens USING btree (partner_id);
CREATE INDEX idx_order_additional_options_order_id ON public.order_additional_options USING btree (order_id);
CREATE INDEX permit_documents_order_role_idx ON public.permit_documents USING btree (organization_id, order_id, document_role, created_at DESC);
CREATE UNIQUE INDEX idx_whatsapp_managed_unique_from_address ON public.whatsapp_managed_connections USING btree (platform_twilio_account_sid, display_number) WHERE (display_number IS NOT NULL);
CREATE UNIQUE INDEX idx_orders_tracking_token ON public.orders USING btree (tracking_token) WHERE (tracking_token IS NOT NULL);
CREATE INDEX idx_order_proof_versions_organization_id ON public.order_proof_versions USING btree (organization_id);
CREATE INDEX permit_email_deliveries_permit_id_idx ON public.permit_email_deliveries USING btree (permit_id);
CREATE INDEX idx_inbox_conversations_external_thread_id ON public.inbox_conversations USING btree (channel, external_thread_id) WHERE (external_thread_id IS NOT NULL);
CREATE INDEX orders_person_id_idx ON public.orders USING btree (person_id);
CREATE INDEX order_payments_order_id_idx ON public.order_payments USING btree (order_id);
CREATE INDEX idx_order_people_organization_id ON public.order_people USING btree (organization_id);
CREATE INDEX idx_organization_members_organization_id ON public.organization_members USING btree (organization_id);
CREATE INDEX idx_permit_forms_organization_id ON public.permit_forms USING btree (organization_id);
CREATE INDEX idx_whatsapp_connection_events_user_id ON public.whatsapp_connection_events USING btree (user_id, occurred_at DESC);
CREATE INDEX partner_sessions_expires_at_idx ON public.partner_sessions USING btree (expires_at);
CREATE INDEX idx_people_email ON public.people USING btree (email);
CREATE INDEX portal_security_events_type_created_at_idx ON public.portal_security_events USING btree (event_type, created_at DESC);
CREATE INDEX idx_whatsapp_managed_sender_lookup ON public.whatsapp_managed_connections USING btree (platform_twilio_account_sid, twilio_sender) WHERE (state = 'connected'::text);
CREATE INDEX permit_forms_google_drive_file_id_idx ON public.permit_forms USING btree (google_drive_file_id);
CREATE INDEX activity_logs_user_id_created_at_idx ON public.activity_logs USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX idx_inbox_messages_email_gmail_connection_meta_message_id ON public.inbox_messages USING btree (gmail_connection_id, (((meta -> 'gmail'::text) ->> 'messageId'::text))) WHERE ((channel = 'email'::text) AND (gmail_connection_id IS NOT NULL) AND (((meta -> 'gmail'::text) ->> 'messageId'::text) IS NOT NULL));
CREATE INDEX idx_quotes_order ON public.quotes USING btree (converted_to_order_id) WHERE (converted_to_order_id IS NOT NULL);
CREATE INDEX permit_form_match_reviews_org_created_idx ON public.permit_form_match_reviews USING btree (organization_id, created_at DESC);
CREATE INDEX idx_password_reset_token ON public.password_reset_tokens USING btree (token);
CREATE UNIQUE INDEX idx_whatsapp_managed_unique_sender_sid ON public.whatsapp_managed_connections USING btree (platform_twilio_account_sid, twilio_sender) WHERE (twilio_sender IS NOT NULL);
CREATE UNIQUE INDEX idx_invoice_payments_unique_charge ON public.invoice_payments USING btree (stripe_invoice_id, stripe_charge_id) WHERE (stripe_charge_id IS NOT NULL);
CREATE INDEX idx_order_permits_order_id ON public.order_permits USING btree (order_id);
CREATE INDEX ghl_connections_ghl_location_id_idx ON public.ghl_connections USING btree (ghl_location_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members USING btree (user_id);
CREATE INDEX idx_invoices_stripe_invoice_id ON public.invoices USING btree (stripe_invoice_id) WHERE (stripe_invoice_id IS NOT NULL);
CREATE INDEX permit_contacts_review_idx ON public.permit_contacts USING btree (active, validation_status, is_generic_inbox, last_seen_at DESC, id);
CREATE UNIQUE INDEX people_org_email_key ON public.people USING btree (organization_id, lower(email)) WHERE (email IS NOT NULL);
CREATE INDEX idx_quote_followups_quote_sent_at ON public.quote_followups USING btree (quote_sent_at);
CREATE INDEX idx_order_permits_permit_form_id ON public.order_permits USING btree (permit_form_id);
CREATE INDEX cemetery_pricing_cemetery_id_idx ON public.cemetery_pricing USING btree (cemetery_id);
CREATE INDEX idx_inscriptions_order_id ON public.inscriptions USING btree (order_id);
CREATE UNIQUE INDEX idx_whatsapp_managed_unique_active_sender ON public.whatsapp_managed_connections USING btree (platform_twilio_account_sid, twilio_sender) WHERE (state = ANY (ARRAY['setup_required'::text, 'pending_verification'::text, 'connected'::text, 'action_required'::text]));
CREATE UNIQUE INDEX idx_whatsapp_connections_one_connected_per_user ON public.whatsapp_connections USING btree (user_id) WHERE (status = 'connected'::text);
CREATE INDEX cemeteries_permit_contact_idx ON public.cemeteries USING btree (organization_id, permit_contact_id) WHERE (permit_contact_id IS NOT NULL);
CREATE INDEX customer_portal_tokens_expires_at_idx ON public.customer_portal_tokens USING btree (expires_at);
CREATE INDEX idx_orders_cemetery_id ON public.orders USING btree (cemetery_id);
CREATE INDEX idx_orders_quote ON public.orders USING btree (quote_id) WHERE (quote_id IS NOT NULL);
CREATE INDEX idx_inbox_conversations_last_outbound_at ON public.inbox_conversations USING btree (last_outbound_at DESC NULLS LAST);
create view public.customer_scores with (security_invoker=on) as  WITH base AS (
         SELECT p.id,
            p.organization_id,
            p.first_name,
            p.last_name,
            count(o.id) AS order_count,
            COALESCE(sum(o.value), (0)::numeric) AS total_value,
            max(o.created_at) AS last_order_at
           FROM (people p
             JOIN orders o ON (((o.person_id = p.id) AND (o.is_test = false))))
          GROUP BY p.id, p.organization_id, p.first_name, p.last_name
        ), c AS (
         SELECT base.id,
            base.organization_id,
            base.first_name,
            base.last_name,
            base.order_count,
            base.total_value,
            base.last_order_at,
                CASE
                    WHEN (base.total_value >= (8000)::numeric) THEN 40
                    WHEN (base.total_value >= (5000)::numeric) THEN 30
                    WHEN (base.total_value >= (3500)::numeric) THEN 20
                    WHEN (base.total_value >= (2000)::numeric) THEN 10
                    WHEN (base.total_value > (0)::numeric) THEN 5
                    ELSE 0
                END AS pts_monetary,
                CASE
                    WHEN (base.order_count >= 3) THEN 30
                    WHEN (base.order_count = 2) THEN 20
                    WHEN (base.order_count = 1) THEN 10
                    ELSE 0
                END AS pts_frequency,
                CASE
                    WHEN (base.last_order_at > (now() - '90 days'::interval)) THEN 30
                    WHEN (base.last_order_at > (now() - '180 days'::interval)) THEN 20
                    WHEN (base.last_order_at > (now() - '365 days'::interval)) THEN 10
                    ELSE 0
                END AS pts_recency
           FROM base
        )
 SELECT id,
    organization_id,
    first_name,
    last_name,
    order_count,
    total_value,
    last_order_at,
    ((pts_monetary + pts_frequency) + pts_recency) AS score,
        CASE
            WHEN (((pts_monetary + pts_frequency) + pts_recency) >= 70) THEN 'Priority'::text
            WHEN (((pts_monetary + pts_frequency) + pts_recency) >= 40) THEN 'Established'::text
            ELSE 'Standard'::text
        END AS band,
    jsonb_build_object('monetary', pts_monetary, 'frequency', pts_frequency, 'recency', pts_recency, 'total_value', total_value, 'order_count', order_count) AS breakdown
   FROM c;
create view public.enquiry_scores with (security_invoker=on) as  WITH comp AS (
         SELECT e.id,
            e.organization_id,
            e.person_id,
            e.order_id,
            e.created_at,
                CASE
                    WHEN (e.channel = ANY (ARRAY['appointment'::text, 'quote'::text])) THEN 30
                    WHEN (e.channel = 'call'::text) THEN 18
                    WHEN (e.channel = 'contact'::text) THEN 10
                    WHEN (e.channel = 'shortlist'::text) THEN 6
                    ELSE 10
                END AS pts_channel,
                CASE
                    WHEN (e.created_at > (now() - '7 days'::interval)) THEN 30
                    WHEN (e.created_at > (now() - '30 days'::interval)) THEN 22
                    WHEN (e.created_at > (now() - '90 days'::interval)) THEN 12
                    ELSE 0
                END AS pts_recency,
                CASE
                    WHEN (char_length(COALESCE(e.message, ''::text)) > 120) THEN 15
                    WHEN (char_length(COALESCE(e.message, ''::text)) > 0) THEN 7
                    ELSE 0
                END AS pts_message,
                CASE
                    WHEN (e.appointment_at IS NOT NULL) THEN 10
                    ELSE 0
                END AS pts_appointment,
                CASE
                    WHEN ((e.photo_urls IS NOT NULL) AND (array_length(e.photo_urls, 1) > 0)) THEN 8
                    ELSE 0
                END AS pts_photos,
                CASE
                    WHEN (e.cemetery_id IS NOT NULL) THEN 7
                    ELSE 0
                END AS pts_cemetery
           FROM enquiries e
        )
 SELECT id,
    organization_id,
    person_id,
    order_id,
    (((((pts_channel + pts_recency) + pts_message) + pts_appointment) + pts_photos) + pts_cemetery) AS score,
        CASE
            WHEN (order_id IS NOT NULL) THEN 'Converted'::text
            WHEN ((((((pts_channel + pts_recency) + pts_message) + pts_appointment) + pts_photos) + pts_cemetery) >= 60) THEN 'Hot'::text
            WHEN ((((((pts_channel + pts_recency) + pts_message) + pts_appointment) + pts_photos) + pts_cemetery) >= 35) THEN 'Warm'::text
            ELSE 'Cool'::text
        END AS band,
    jsonb_build_object('channel', pts_channel, 'recency', pts_recency, 'message', pts_message, 'appointment', pts_appointment, 'photos', pts_photos, 'cemetery', pts_cemetery) AS breakdown
   FROM comp;
create view public.invoices_with_breakdown with (security_invoker=true) as  SELECT i.id,
    i.order_id,
    i.invoice_number,
    i.customer_name,
    i.amount,
    i.status,
    i.due_date,
    i.issue_date,
    i.payment_method,
    i.payment_date,
    i.notes,
    i.created_at,
    i.updated_at,
    i.stripe_checkout_session_id,
    i.stripe_payment_intent_id,
    i.stripe_status,
    i.paid_at,
    i.stripe_invoice_id,
    i.stripe_invoice_status,
    i.user_id,
    i.hosted_invoice_url,
    i.amount_paid,
    i.amount_remaining,
    i.revised_from_invoice_id,
    i.locked_at,
    i.deleted_at,
    i.organization_id,
    i.is_test,
    COALESCE(o.value, (0)::numeric) AS main_product_total,
    COALESCE(opt.additional_options_total, (0)::numeric) AS additional_options_total,
    COALESCE(o.permit_cost, (0)::numeric) AS permit_total_cost,
    i.intended_deposit_pence,
    i.person_id
   FROM ((invoices i
     LEFT JOIN orders o ON ((o.id = i.order_id)))
     LEFT JOIN ( SELECT order_additional_options.order_id,
            sum(order_additional_options.cost) AS additional_options_total
           FROM order_additional_options
          GROUP BY order_additional_options.order_id) opt ON ((opt.order_id = i.order_id)));
create view public.orders_with_balance with (security_invoker=true) as  SELECT o.id,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.order_type,
    o.sku,
    o.material,
    o.color,
    o.stone_status,
    o.permit_status,
    o.proof_status,
    o.deposit_date,
    o.second_payment_date,
    o.due_date,
    o.installation_date,
    o.location,
    o.value,
    o.progress,
    o.assigned_to,
    o.priority,
    o.timeline_weeks,
    o.notes,
    o.created_at,
    o.updated_at,
    o.invoice_id,
    o.latitude,
    o.longitude,
    o.permit_cost,
    o.renovation_service_description,
    o.renovation_service_cost,
    o.geocode_status,
    o.geocode_error,
    o.geocoded_at,
    o.geocode_place_id,
    o.order_number,
    o.person_id,
    o.person_name,
    o.product_photo_url,
    o.permit_form_id,
    o.partner_id,
    o.edit_token,
    o.product_config,
    o.status,
    o.quote_id,
    o.tracking_token,
    o.inscription_text,
    o.inscription_status,
    o.proof_url,
    o.proof_uploaded_at,
    o.proof_notes,
    o.estimated_completion,
    o.permit_transferred_at,
    o.permit_fee,
    o.inscription_font,
    o.inscription_font_other,
    o.inscription_layout,
    o.inscription_additional,
    o.product_id,
    o.organization_id,
    o.cemetery_id,
    o.admin_notes,
    o.is_test,
    ((COALESCE(o.value, (0)::numeric) + COALESCE(o.renovation_service_cost, (0)::numeric)) + COALESCE(opt.additional_options_total, (0)::numeric)) AS total_order_value,
    COALESCE(pay.amount_paid, (0)::numeric) AS amount_paid,
    GREATEST((((COALESCE(o.value, (0)::numeric) + COALESCE(o.renovation_service_cost, (0)::numeric)) + COALESCE(opt.additional_options_total, (0)::numeric)) - COALESCE(pay.amount_paid, (0)::numeric)), (0)::numeric) AS balance_due,
    fin.final_invoice_id,
    fin.final_invoice_sent_at
   FROM (((orders o
     LEFT JOIN ( SELECT order_additional_options.order_id,
            sum(order_additional_options.cost) AS additional_options_total
           FROM order_additional_options
          GROUP BY order_additional_options.order_id) opt ON ((opt.order_id = o.id)))
     LEFT JOIN ( SELECT invoices.order_id,
            sum(invoices.amount) AS amount_paid
           FROM invoices
          WHERE ((invoices.status = 'paid'::text) AND (invoices.order_id IS NOT NULL))
          GROUP BY invoices.order_id) pay ON ((pay.order_id = o.id)))
     LEFT JOIN LATERAL ( SELECT i.id AS final_invoice_id,
            i.issue_date AS final_invoice_sent_at
           FROM invoices i
          WHERE (i.order_id = o.id)
          ORDER BY i.issue_date DESC NULLS LAST, i.created_at DESC
         LIMIT 1) fin ON (true));
create view public.v_order_status_summary with (security_invoker=on) as  SELECT count(*) AS total_orders,
    count(*) FILTER (WHERE ((stone_status = 'In Stock'::text) AND (permit_status = 'approved'::text) AND (proof_status = 'Lettered'::text))) AS ready_for_install,
    count(*) FILTER (WHERE ((due_date < CURRENT_DATE) AND (progress < 100))) AS overdue,
    count(*) FILTER (WHERE ((permit_status = ANY (ARRAY['pending'::text, 'form_sent'::text])) OR (proof_status = 'Not_Received'::text))) AS pending_approval,
    avg(progress) AS avg_progress
   FROM orders;
create view public.v_monthly_revenue with (security_invoker=on) as  SELECT date_trunc('month'::text, (issue_date)::timestamp with time zone) AS month,
    count(*) AS invoice_count,
    sum(
        CASE
            WHEN (status = 'paid'::text) THEN amount
            ELSE (0)::numeric
        END) AS paid_amount,
    sum(
        CASE
            WHEN (status = ANY (ARRAY['pending'::text, 'overdue'::text])) THEN amount
            ELSE (0)::numeric
        END) AS outstanding_amount,
    sum(amount) AS total_amount
   FROM invoices i
  GROUP BY (date_trunc('month'::text, (issue_date)::timestamp with time zone))
  ORDER BY (date_trunc('month'::text, (issue_date)::timestamp with time zone)) DESC;
create view public.v_top_products with (security_invoker=true) as  SELECT order_type AS product_name,
    count(*) AS order_count,
    sum((COALESCE(value, (0)::numeric) + COALESCE(renovation_service_cost, (0)::numeric))) AS net_revenue
   FROM orders
  WHERE (value IS NOT NULL)
  GROUP BY order_type
  ORDER BY (sum((COALESCE(value, (0)::numeric) + COALESCE(renovation_service_cost, (0)::numeric)))) DESC
 LIMIT 10;
create view public.v_permit_reconciliation with (security_invoker=true) as  SELECT id AS order_id,
    order_number,
    customer_name,
    location,
    permit_cost,
    deposit_date AS collected_date,
    permit_transferred_at,
        CASE
            WHEN (permit_transferred_at IS NOT NULL) THEN 'transferred'::text
            WHEN (permit_cost > (0)::numeric) THEN 'held'::text
            ELSE 'none'::text
        END AS permit_status,
        CASE
            WHEN ((permit_transferred_at IS NULL) AND (permit_cost > (0)::numeric)) THEN permit_cost
            ELSE (0)::numeric
        END AS amount_still_held
   FROM orders o
  WHERE (permit_cost > (0)::numeric)
  ORDER BY deposit_date DESC NULLS LAST;
create view public.v_orders_with_stage with (security_invoker=on) as  SELECT id,
    customer_name,
    customer_email,
    customer_phone,
    order_type,
    sku,
    material,
    color,
    stone_status,
    permit_status,
    proof_status,
    deposit_date,
    second_payment_date,
    due_date,
    installation_date,
    location,
    value,
    progress,
    assigned_to,
    priority,
    timeline_weeks,
    notes,
    created_at,
    updated_at,
    invoice_id,
    latitude,
    longitude,
    permit_cost,
    renovation_service_description,
    renovation_service_cost,
    geocode_status,
    geocode_error,
    geocoded_at,
    geocode_place_id,
    order_number,
    person_id,
    person_name,
    product_photo_url,
    permit_form_id,
    partner_id,
    edit_token,
    product_config,
    status,
    quote_id,
    tracking_token,
    inscription_text,
    inscription_status,
    proof_url,
    proof_uploaded_at,
    proof_notes,
    estimated_completion,
    permit_transferred_at,
    permit_fee,
    inscription_font,
    inscription_font_other,
    inscription_layout,
    inscription_additional,
    product_id,
    organization_id,
    order_stage(stone_status, proof_status, permit_status) AS stage
   FROM orders;
create view public.v_order_line_items with (security_invoker=true) as  SELECT o.id AS order_id,
    o.order_number,
    o.customer_name,
    o.partner_id,
    o.person_id,
    'memorial'::text AS line_type,
    o.sku AS item_ref,
    COALESCE(o.order_type, 'Memorial'::text) AS item_name,
    NULL::text AS item_description,
    o.value AS line_cost,
    o.created_at
   FROM orders o
  WHERE ((o.value IS NOT NULL) AND (o.value > (0)::numeric))
UNION ALL
 SELECT o.id AS order_id,
    o.order_number,
    o.customer_name,
    o.partner_id,
    o.person_id,
    'renovation'::text AS line_type,
    NULL::text AS item_ref,
    'Renovation Service'::text AS item_name,
    o.renovation_service_description AS item_description,
    o.renovation_service_cost AS line_cost,
    o.created_at
   FROM orders o
  WHERE ((o.renovation_service_cost IS NOT NULL) AND (o.renovation_service_cost > (0)::numeric))
UNION ALL
 SELECT o.id AS order_id,
    o.order_number,
    o.customer_name,
    o.partner_id,
    o.person_id,
    'addon'::text AS line_type,
    (ao.id)::text AS item_ref,
    ao.name AS item_name,
    ao.description AS item_description,
    ao.cost AS line_cost,
    ao.created_at
   FROM (orders o
     JOIN order_additional_options ao ON ((ao.order_id = o.id)))
  ORDER BY 2, 6;
create view public.customers with (security_invoker=true,check_option=cascaded) as  SELECT id,
    first_name,
    last_name,
    email,
    phone,
    address,
    city,
    country,
    company_id,
    organization_id,
    is_customer,
    portal_token,
    portal_token_expires_at,
    created_at,
    updated_at
   FROM people
  WHERE (is_customer = true);
create view public.orders_with_options_total with (security_invoker=on) as  SELECT o.id,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.order_type,
    o.sku,
    o.material,
    o.color,
    o.stone_status,
    o.permit_status,
    o.proof_status,
    o.deposit_date,
    o.second_payment_date,
    o.due_date,
    o.installation_date,
    o.location,
    o.value,
    o.progress,
    o.assigned_to,
    o.priority,
    o.timeline_weeks,
    o.notes,
    o.created_at,
    o.updated_at,
    o.invoice_id,
    o.latitude,
    o.longitude,
    o.permit_cost,
    o.renovation_service_description,
    o.renovation_service_cost,
    o.geocode_status,
    o.geocode_error,
    o.geocoded_at,
    o.geocode_place_id,
    o.order_number,
    o.person_id,
    o.person_name,
    o.product_photo_url,
    o.permit_form_id,
    o.partner_id,
    o.edit_token,
    o.product_config,
    o.status,
    o.quote_id,
    o.tracking_token,
    o.inscription_text,
    o.inscription_status,
    o.proof_url,
    o.proof_uploaded_at,
    o.proof_notes,
    o.estimated_completion,
    o.permit_transferred_at,
    o.permit_fee,
    o.inscription_font,
    o.inscription_font_other,
    o.inscription_layout,
    o.inscription_additional,
    o.product_id,
    o.organization_id,
    COALESCE(sum(ao.cost), (0)::numeric) AS additional_options_total,
    o.custom_product_name
   FROM (orders o
     LEFT JOIN order_additional_options ao ON ((ao.order_id = o.id)))
  GROUP BY o.id;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER prune_expired_quote_access_tokens_after_insert AFTER INSERT ON public.quote_access_tokens FOR EACH STATEMENT EXECUTE FUNCTION prune_expired_quote_access_tokens();
CREATE TRIGGER update_memorials_updated_at BEFORE UPDATE ON public.memorials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER capture_quote_access_token_after_write AFTER INSERT OR UPDATE OF edit_token ON public.orders FOR EACH ROW WHEN (((new.order_type = 'quote'::text) AND (new.edit_token IS NOT NULL))) EXECUTE FUNCTION capture_quote_access_token();
CREATE TRIGGER orders_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION log_activity_generic('order');
CREATE TRIGGER trg_orders_correct_inverted_names BEFORE INSERT OR UPDATE OF customer_name, person_name, person_id ON public.orders FOR EACH ROW EXECUTE FUNCTION orders_correct_inverted_names();
CREATE TRIGGER trg_orders_flip_quote_type_on_paid BEFORE INSERT OR UPDATE OF order_type, stage, job_id, renovation_service_description, renovation_service_cost ON public.orders FOR EACH ROW EXECUTE FUNCTION trg_orders_flip_quote_type_on_paid();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_table_view_presets_updated_at BEFORE UPDATE ON public.table_view_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inscriptions_updated_at BEFORE UPDATE ON public.inscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_additional_options_updated_at BEFORE UPDATE ON public.order_additional_options FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_permits_updated_at BEFORE UPDATE ON public.order_permits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER people_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION log_activity_generic('customer');
CREATE TRIGGER trg_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER invoices_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION log_activity_generic('invoice');
CREATE TRIGGER trg_invoices_flip_linked_quote_order_type AFTER INSERT OR UPDATE OF order_id, paid_at, amount_paid, stripe_status, deleted_at ON public.invoices FOR EACH ROW EXECUTE FUNCTION trg_invoices_flip_linked_quote_order_type();
CREATE TRIGGER trg_invoices_set_person_is_customer AFTER INSERT OR UPDATE OF person_id, amount_paid, paid_at, stripe_status, is_test, deleted_at ON public.invoices FOR EACH ROW EXECUTE FUNCTION trg_invoices_recompute_customer();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_proofs_updated_at BEFORE UPDATE ON public.order_proofs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER ghl_connections_set_updated_at BEFORE UPDATE ON public.ghl_connections FOR EACH ROW EXECUTE FUNCTION set_ghl_connections_updated_at();
CREATE TRIGGER update_workflow_slas_updated_at BEFORE UPDATE ON public.workflow_slas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER inbox_conversations_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.inbox_conversations FOR EACH ROW EXECUTE FUNCTION log_activity_generic('inbox_conversation');
CREATE TRIGGER trg_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER prune_expired_portal_auth_partner AFTER INSERT ON public.partner_sessions FOR EACH STATEMENT EXECUTE FUNCTION prune_expired_portal_auth();
CREATE TRIGGER update_inbox_enquiry_extraction_updated_at BEFORE UPDATE ON public.inbox_enquiry_extraction FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER prune_expired_portal_auth_reset AFTER INSERT ON public.password_reset_tokens FOR EACH STATEMENT EXECUTE FUNCTION prune_expired_portal_auth();
CREATE TRIGGER prune_expired_portal_auth_admin AFTER INSERT ON public.admin_sessions FOR EACH STATEMENT EXECUTE FUNCTION prune_expired_portal_auth();
CREATE TRIGGER guard_cemetery_permit_contact_assignment_v1 BEFORE INSERT OR UPDATE OF permit_contact_id, permit_contact_assigned_at, permit_contact_assigned_by ON public.cemeteries FOR EACH ROW EXECUTE FUNCTION guard_cemetery_permit_contact_assignment_v1();
CREATE TRIGGER guard_cemetery_permit_form_assignment_v1 BEFORE INSERT OR UPDATE OF permit_form_id, permit_form_assigned_at, permit_form_assigned_by ON public.cemeteries FOR EACH ROW EXECUTE FUNCTION guard_cemetery_permit_form_assignment_v1();
CREATE TRIGGER trg_enquiries_updated_at BEFORE UPDATE ON public.enquiries FOR EACH ROW EXECUTE FUNCTION enquiries_set_updated_at();
CREATE TRIGGER trg_sync_enquiry_to_inbox AFTER INSERT ON public.enquiries FOR EACH ROW EXECUTE FUNCTION trg_sync_enquiry_to_inbox();
CREATE TRIGGER prune_portal_security_data_after_insert AFTER INSERT ON public.portal_security_events FOR EACH STATEMENT EXECUTE FUNCTION prune_portal_security_data();
CREATE TRIGGER organization_members_last_admin_guard_delete BEFORE DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION organization_members_last_admin_guard();
CREATE TRIGGER organization_members_last_admin_guard_update_role BEFORE UPDATE OF role ON public.organization_members FOR EACH ROW EXECUTE FUNCTION organization_members_last_admin_guard();
CREATE TRIGGER inbox_messages_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.inbox_messages FOR EACH ROW EXECUTE FUNCTION log_activity_generic('inbox_message');
CREATE TRIGGER trg_inbox_messages_directional_timestamps AFTER INSERT ON public.inbox_messages FOR EACH ROW EXECUTE FUNCTION update_conversation_directional_timestamps();
CREATE TRIGGER quote_followups_updated_at BEFORE UPDATE ON public.quote_followups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER prune_partner_magic_links_after_insert AFTER INSERT ON public.partner_magic_link_tokens FOR EACH STATEMENT EXECUTE FUNCTION prune_partner_magic_links();
CREATE TRIGGER prune_expired_portal_auth_customer AFTER INSERT ON public.customer_portal_tokens FOR EACH STATEMENT EXECUTE FUNCTION prune_expired_portal_auth();
CREATE TRIGGER update_permit_forms_updated_at BEFORE UPDATE ON public.permit_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_jobs_flip_linked_quote_order_type AFTER INSERT OR UPDATE OF stage, paid_at ON public.jobs FOR EACH ROW EXECUTE FUNCTION trg_jobs_flip_linked_quote_order_type();
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION enquiries_set_updated_at();
CREATE TRIGGER prune_expired_order_tracking_tokens_after_insert AFTER INSERT ON public.order_tracking_tokens FOR EACH STATEMENT EXECUTE FUNCTION prune_expired_order_tracking_tokens();
CREATE TRIGGER set_burial_ground_contact_candidates_updated_at BEFORE UPDATE ON public.burial_ground_contact_candidates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER invoice_payments_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION log_activity_generic('invoice_payment');
CREATE TRIGGER trg_invoice_payments_set_person_is_customer AFTER INSERT OR UPDATE OF status ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION trg_invoice_payments_recompute_customer();
alter table public.whatsapp_managed_connections enable row level security;
alter table public.ghl_send_idempotency enable row level security;
alter table public.companies enable row level security;
alter table public.quote_access_tokens enable row level security;
alter table public.inbox_channel_accounts enable row level security;
alter table public.memorials enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_events enable row level security;
alter table public.orders enable row level security;
alter table public.table_view_presets enable row level security;
alter table public.portal_rate_limits enable row level security;
alter table public.inbox_ai_suggestions enable row level security;
alter table public.contact_handles enable row level security;
alter table public.inscriptions enable row level security;
alter table public.order_people enable row level security;
alter table public.order_additional_options enable row level security;
alter table public.order_permits enable row level security;
alter table public.people enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.product_categories enable row level security;
alter table public.order_proof_versions enable row level security;
alter table public.stone_colours enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.product_sizes enable row level security;
alter table public.product_addons enable row level security;
alter table public.activity_logs enable row level security;
alter table public.products enable row level security;
alter table public.order_proof_ai_checks enable row level security;
alter table public.order_proofs enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.ghl_connections enable row level security;
alter table public.whatsapp_connection_events enable row level security;
alter table public.whatsapp_user_preferences enable row level security;
alter table public.inbox_ai_thread_summaries enable row level security;
alter table public.workflow_slas enable row level security;
alter table public.permit_email_deliveries enable row level security;
alter table public.inbox_conversations enable row level security;
alter table public.partners enable row level security;
alter table public.partner_sessions enable row level security;
alter table public.partner_comments enable row level security;
alter table public.inscription_requests enable row level security;
alter table public.customer_activity enable row level security;
alter table public.inbox_enquiry_extraction enable row level security;
alter table public.cemetery_contacts enable row level security;
alter table public.cemetery_pricing enable row level security;
alter table public.quotes enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.organization_stripe_config enable row level security;
alter table public.permit_contacts enable row level security;
alter table public.cemeteries enable row level security;
alter table public.enquiries enable row level security;
alter table public.oauth_state enable row level security;
alter table public.portal_security_events enable row level security;
alter table public.organization_members enable row level security;
alter table public.organizations enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.quote_followups enable row level security;
alter table public.partner_magic_link_tokens enable row level security;
alter table public.customer_portal_tokens enable row level security;
alter table public.inbox_muted_senders enable row level security;
alter table public.permit_forms enable row level security;
alter table public.jobs enable row level security;
alter table public.cemetery_match_reviews enable row level security;
alter table public.permit_form_match_reviews enable row level security;
alter table public.permit_documents enable row level security;
alter table public.order_tracking_tokens enable row level security;
alter table public.permit_cemetery_email_deliveries enable row level security;
alter table public.burial_ground_contact_candidates enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_payments enable row level security;
create policy activity_logs_org_select on public.activity_logs as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy "Allow read access to order_proof_versions in same org" on public.order_proof_versions as permissive for select to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Allow write access to order_proof_versions in same org" on public.order_proof_versions as permissive for all to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid))))) with check ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Allow read access to order_proof_ai_checks in same org" on public.order_proof_ai_checks as permissive for select to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Allow write access to order_proof_ai_checks in same org" on public.order_proof_ai_checks as permissive for all to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid))))) with check ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy inbox_muted_senders_org_delete on public.inbox_muted_senders as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy activity_logs_org_insert on public.activity_logs as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy activity_logs_org_update on public.activity_logs as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy activity_logs_org_delete on public.activity_logs as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy cemeteries_org_select on public.cemeteries as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy cemeteries_org_insert on public.cemeteries as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy cemeteries_org_update on public.cemeteries as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy inbox_conversations_org_select on public.inbox_conversations as permissive for select to public using (user_is_member_of_org(organization_id));
create policy jobs_org_select on public.jobs as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy jobs_org_insert on public.jobs as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy jobs_org_update on public.jobs as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy cemeteries_org_delete on public.cemeteries as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy companies_org_select on public.companies as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy companies_org_insert on public.companies as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy companies_org_update on public.companies as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy companies_org_delete on public.companies as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy no_public_access on public.inscription_requests as permissive for all to anon using (false);
create policy no_public_access on public.customer_activity as permissive for all to anon using (false);
create policy inbox_messages_org_select on public.inbox_messages as permissive for select to public using (user_is_member_of_org(organization_id));
create policy no_public_access on public.password_reset_tokens as permissive for all to anon using (false);
create policy people_org_select on public.people as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy service_role_all_admin_sessions on public.admin_sessions as permissive for all to service_role using (true) with check (true);
create policy service_role_all_partners on public.partners as permissive for all to service_role using (true) with check (true);
create policy service_role_all_partner_sessions on public.partner_sessions as permissive for all to service_role using (true) with check (true);
create policy invoices_org_insert on public.invoices as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy people_org_insert on public.people as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy inbox_conversations_org_update on public.inbox_conversations as permissive for update to public using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy inbox_messages_org_update on public.inbox_messages as permissive for update to public using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy permit_form_match_reviews_org_select on public.permit_form_match_reviews as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy service_role_all_password_reset_tokens on public.password_reset_tokens as permissive for all to service_role using (true) with check (true);
create policy gmail_connections_org_select on public.gmail_connections as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy people_org_update on public.people as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy people_org_delete on public.people as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy cemeteries_public_read on public.cemeteries as permissive for select to authenticated using (true);
create policy invoice_line_items_org_select on public.invoice_line_items as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy "Public can view active categories" on public.product_categories as permissive for select to public using ((is_active = true));
create policy "Public can view active colours" on public.stone_colours as permissive for select to public using ((is_active = true));
create policy "Public can view product sizes" on public.product_sizes as permissive for select to public using (true);
create policy "Public can view active addons" on public.product_addons as permissive for select to public using ((is_active = true));
create policy gmail_connections_org_insert on public.gmail_connections as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy no_public_access on public.partners as permissive for all to anon using (false);
create policy no_public_access on public.partner_sessions as permissive for all to anon using (false);
create policy no_public_access on public.partner_comments as permissive for all to anon using (false);
create policy no_public_access on public.admin_sessions as permissive for all to anon using (false);
create policy gmail_connections_org_update on public.gmail_connections as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy gmail_connections_org_delete on public.gmail_connections as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy permit_email_deliveries_deny_browser_roles on public.permit_email_deliveries as restrictive for all to authenticated,anon using (false) with check (false);
create policy inbox_ai_suggestions_org_select on public.inbox_ai_suggestions as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy inbox_ai_suggestions_org_insert on public.inbox_ai_suggestions as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy inbox_ai_suggestions_org_update on public.inbox_ai_suggestions as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy inbox_ai_suggestions_org_delete on public.inbox_ai_suggestions as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy inbox_ai_thread_summaries_org_select on public.inbox_ai_thread_summaries as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy inbox_ai_thread_summaries_org_insert on public.inbox_ai_thread_summaries as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy inbox_ai_thread_summaries_org_update on public.inbox_ai_thread_summaries as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy inbox_ai_thread_summaries_org_delete on public.inbox_ai_thread_summaries as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy inbox_conversations_org_insert on public.inbox_conversations as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy inbox_conversations_org_delete on public.inbox_conversations as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy inbox_messages_org_insert on public.inbox_messages as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy inbox_messages_org_delete on public.inbox_messages as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy inscriptions_org_select on public.inscriptions as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy inscriptions_org_insert on public.inscriptions as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy inscriptions_org_update on public.inscriptions as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy enquiries_select_by_org on public.enquiries as permissive for select to public using ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = auth.uid()))));
create policy enquiries_modify_by_org on public.enquiries as permissive for all to public using ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = auth.uid())))) with check ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = auth.uid()))));
create policy order_payments_org_members_all on public.order_payments as permissive for all to public using (((organization_id IS NOT NULL) AND user_is_member_of_org(organization_id))) with check (((organization_id IS NOT NULL) AND user_is_member_of_org(organization_id)));
create policy inscriptions_org_delete on public.inscriptions as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy ghl_connections_select_member on public.ghl_connections as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy ghl_connections_insert_admin on public.ghl_connections as permissive for insert to authenticated with check (user_is_admin_of_org(organization_id));
create policy ghl_connections_update_admin on public.ghl_connections as permissive for update to authenticated using (user_is_admin_of_org(organization_id)) with check (user_is_admin_of_org(organization_id));
create policy ghl_connections_delete_admin on public.ghl_connections as permissive for delete to authenticated using (user_is_admin_of_org(organization_id));
create policy organization_stripe_config_select_member on public.organization_stripe_config as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy "Authenticated users can read cemetery_contacts" on public.cemetery_contacts as permissive for select to authenticated using (true);
create policy "Authenticated users can read cemetery_pricing" on public.cemetery_pricing as permissive for select to authenticated using (true);
create policy organizations_select_member on public.organizations as permissive for select to authenticated using ((id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = ( SELECT auth.uid() AS uid)))));
create policy invoice_payments_org_select on public.invoice_payments as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy invoice_payments_org_insert on public.invoice_payments as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy invoice_payments_org_update on public.invoice_payments as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy invoice_payments_org_delete on public.invoice_payments as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy invoices_org_select on public.invoices as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy invoices_org_update on public.invoices as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy invoices_org_delete on public.invoices as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy whatsapp_connections_org_select on public.whatsapp_connections as permissive for select to public using (user_is_member_of_org(organization_id));
create policy whatsapp_connections_org_insert on public.whatsapp_connections as permissive for insert to public with check (user_is_admin_of_org(organization_id));
create policy whatsapp_connections_org_update on public.whatsapp_connections as permissive for update to public using (user_is_admin_of_org(organization_id)) with check (user_is_admin_of_org(organization_id));
create policy whatsapp_connections_org_delete on public.whatsapp_connections as permissive for delete to public using (user_is_admin_of_org(organization_id));
create policy order_additional_options_org_select on public.order_additional_options as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy order_additional_options_org_insert on public.order_additional_options as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy order_additional_options_org_update on public.order_additional_options as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy order_additional_options_org_delete on public.order_additional_options as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy order_people_org_select on public.order_people as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy order_people_org_insert on public.order_people as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy order_people_org_update on public.order_people as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy order_people_org_delete on public.order_people as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy order_proofs_org_select on public.order_proofs as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy order_proofs_org_insert on public.order_proofs as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy order_proofs_org_update on public.order_proofs as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy order_proofs_org_delete on public.order_proofs as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy orders_org_select on public.orders as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy orders_org_insert on public.orders as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy orders_org_update on public.orders as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy orders_org_delete on public.orders as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy payments_org_select on public.payments as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy payments_org_insert on public.payments as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy payments_org_update on public.payments as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy payments_org_delete on public.payments as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy permit_forms_org_select on public.permit_forms as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy permit_forms_org_insert on public.permit_forms as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy permit_forms_org_update on public.permit_forms as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy permit_forms_org_delete on public.permit_forms as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy products_org_select on public.products as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy products_org_insert on public.products as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy products_org_update on public.products as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy products_org_delete on public.products as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy quotes_org_select on public.quotes as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy quotes_org_insert on public.quotes as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy quotes_org_update on public.quotes as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy quotes_org_delete on public.quotes as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy table_view_presets_org_select on public.table_view_presets as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy table_view_presets_org_insert on public.table_view_presets as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy table_view_presets_org_update on public.table_view_presets as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy table_view_presets_org_delete on public.table_view_presets as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy whatsapp_connection_events_org_select on public.whatsapp_connection_events as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy whatsapp_connection_events_org_insert on public.whatsapp_connection_events as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy whatsapp_connection_events_org_update on public.whatsapp_connection_events as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy whatsapp_connection_events_org_delete on public.whatsapp_connection_events as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy whatsapp_managed_connections_org_select on public.whatsapp_managed_connections as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy whatsapp_managed_connections_org_insert on public.whatsapp_managed_connections as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy whatsapp_managed_connections_org_update on public.whatsapp_managed_connections as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy whatsapp_managed_connections_org_delete on public.whatsapp_managed_connections as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy whatsapp_user_preferences_org_select on public.whatsapp_user_preferences as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy whatsapp_user_preferences_org_insert on public.whatsapp_user_preferences as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy whatsapp_user_preferences_org_update on public.whatsapp_user_preferences as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
create policy whatsapp_user_preferences_org_delete on public.whatsapp_user_preferences as permissive for delete to authenticated using (user_is_member_of_org(organization_id));
create policy inbox_muted_senders_org_select on public.inbox_muted_senders as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy organization_members_select_org on public.organization_members as permissive for select to authenticated using (user_is_member_of_org(organization_id));
create policy organization_members_insert_admin on public.organization_members as permissive for insert to authenticated with check (user_is_admin_of_org(organization_id));
create policy organization_members_update_admin on public.organization_members as permissive for update to authenticated using (user_is_admin_of_org(organization_id)) with check (user_is_admin_of_org(organization_id));
create policy organization_members_delete_admin on public.organization_members as permissive for delete to authenticated using (user_is_admin_of_org(organization_id));
create policy "Public can view active products" on public.products as permissive for select to anon using ((is_active = true));
create policy "Allow read access to workflow_slas in same org" on public.workflow_slas as permissive for select to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy inbox_muted_senders_org_insert on public.inbox_muted_senders as permissive for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy "Allow write access to workflow_slas in same org" on public.workflow_slas as permissive for all to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid))))) with check ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Allow read access to inbox_enquiry_extraction in same org" on public.inbox_enquiry_extraction as permissive for select to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Allow write access to inbox_enquiry_extraction in same org" on public.inbox_enquiry_extraction as permissive for all to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid))))) with check ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Allow read access to order_permits in same org" on public.order_permits as permissive for select to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Allow write access to order_permits in same org" on public.order_permits as permissive for all to public using ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid))))) with check ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = ( SELECT auth.uid() AS uid)))));
create policy inbox_muted_senders_org_update on public.inbox_muted_senders as permissive for update to authenticated using (user_is_member_of_org(organization_id)) with check (user_is_member_of_org(organization_id));
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
