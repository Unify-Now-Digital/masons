# API Contract — Managed WhatsApp Onboarding

## 1) `POST /functions/v1/whatsapp-managed-start`

Creates or resumes managed onboarding for tenant.

Auth:
- Required authenticated user JWT.
- User must belong to tenant/workspace.

Request:
```json
{
  "company_id": "uuid"
}
```

Response 200:
```json
{
  "connection_id": "uuid",
  "status": "collecting_business_info"
}
```

Failure modes:
- `401 unauthorized`
- `403 forbidden_tenant_access`
- `409 onboarding_already_connected`

## 2) `POST /functions/v1/whatsapp-managed-submit-business`

Stores business inputs and triggers provider onboarding calls where supported.

Auth:
- Required authenticated user JWT.

Request:
```json
{
  "connection_id": "uuid",
  "business_name": "string",
  "business_email": "string",
  "business_phone": "+44...",
  "meta_business_id": "optional-string"
}
```

Response 200:
```json
{
  "connection_id": "uuid",
  "status": "provisioning",
  "next_check_after_seconds": 10
}
```

Failure modes:
- `400 validation_error`
- `401 unauthorized`
- `403 forbidden`
- `409 invalid_status_transition`
- `502 provider_api_error`

## 3) `GET /functions/v1/whatsapp-managed-status?connection_id=...`

Returns authoritative managed status and action hints.

Auth:
- Required authenticated user JWT.

Response 200:
```json
{
  "connection_id": "uuid",
  "mode": "managed",
  "status": "pending_provider_review",
  "status_reason_code": "provider_review_pending",
  "status_reason_message": "Provider review is in progress.",
  "action_required": false,
  "connected_requirements": {
    "has_sender_sid": false,
    "has_from_address": false,
    "provider_ready": false
  },
  "last_synced_at": "iso-datetime"
}
```

## 4) `POST /functions/v1/whatsapp-managed-sync`

Pulls provider state and updates local status. Callable by scheduler/admin backend.

Auth:
- Service role only (or signed internal token).

Request:
```json
{
  "connection_id": "uuid"
}
```

Response 200:
```json
{
  "connection_id": "uuid",
  "old_status": "provisioning",
  "new_status": "pending_provider_review"
}
```

## 5) `POST /functions/v1/whatsapp-managed-provider-webhook`

Provider webhook endpoint to process asynchronous Twilio/Meta state updates.

Auth:
- Provider signature validation required.
- No user JWT expected.

Request:
- Provider payload (raw form/json), validated then mapped.

Response:
- Always 200 on processed/ignored events (idempotent).

## 6) Existing outbound API behavior update

`POST /functions/v1/inbox-twilio-send` (modified)

Request:
```json
{
  "conversation_id": "uuid",
  "body_text": "hello"
}
```

Managed mode not-ready response (example):
- HTTP `409`
```json
{
  "error": "managed_whatsapp_not_ready",
  "status": "pending_provider_review",
  "status_reason_code": "provider_review_pending",
  "action_required": false
}
```

Manual mode missing credentials response:
- HTTP `403`
```json
{
  "error": "manual_whatsapp_not_connected"
}
```

Rules:
- Resolver selects one mode explicitly from tenant preference.
- No managed->manual silent fallback on send failure.

## 7) Existing inbound webhook behavior update

`POST /functions/v1/twilio-sms-webhook` (modified)

Routing:
- Resolve ownership by actual provisioned sender identity:
  - managed: provider sender SID / from address mapping
  - manual: existing account sid + from mapping
- Persist source fields (`whatsapp_connection_mode`, connection ids, sender sid).
- Ignore unmatched inbound with 200 and no inbox writes.
