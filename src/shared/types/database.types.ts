export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          changes: Json
          context: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json
          context?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json
          context?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: number
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: number
          token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: number
          token?: string
        }
        Relationships: []
      }
      cemeteries: {
        Row: {
          address: string | null
          allowed_typefaces: string[] | null
          area: string
          avg_approval_days: number | null
          country: string
          created_at: string | null
          cremation_section: boolean | null
          display_order: number | null
          governing_body: string | null
          governing_body_type: string | null
          id: string
          installed_count: string | null
          is_active: boolean | null
          is_test: boolean
          kerb_allowed: boolean | null
          latitude: number | null
          lawn_section: boolean | null
          longitude: number | null
          max_height_mm: number | null
          max_width_mm: number | null
          name: string
          note: string | null
          notes: string | null
          organization_id: string
          permit_fee: number | null
          phone: string | null
          postcode: string | null
          primary_email: string | null
          processing_weeks: string | null
          region: string
          regulation_notes: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allowed_typefaces?: string[] | null
          area: string
          avg_approval_days?: number | null
          country?: string
          created_at?: string | null
          cremation_section?: boolean | null
          display_order?: number | null
          governing_body?: string | null
          governing_body_type?: string | null
          id?: string
          installed_count?: string | null
          is_active?: boolean | null
          is_test?: boolean
          kerb_allowed?: boolean | null
          latitude?: number | null
          lawn_section?: boolean | null
          longitude?: number | null
          max_height_mm?: number | null
          max_width_mm?: number | null
          name: string
          note?: string | null
          notes?: string | null
          organization_id: string
          permit_fee?: number | null
          phone?: string | null
          postcode?: string | null
          primary_email?: string | null
          processing_weeks?: string | null
          region?: string
          regulation_notes?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allowed_typefaces?: string[] | null
          area?: string
          avg_approval_days?: number | null
          country?: string
          created_at?: string | null
          cremation_section?: boolean | null
          display_order?: number | null
          governing_body?: string | null
          governing_body_type?: string | null
          id?: string
          installed_count?: string | null
          is_active?: boolean | null
          is_test?: boolean
          kerb_allowed?: boolean | null
          latitude?: number | null
          lawn_section?: boolean | null
          longitude?: number | null
          max_height_mm?: number | null
          max_width_mm?: number | null
          name?: string
          note?: string | null
          notes?: string | null
          organization_id?: string
          permit_fee?: number | null
          phone?: string | null
          postcode?: string | null
          primary_email?: string | null
          processing_weeks?: string | null
          region?: string
          regulation_notes?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cemeteries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cemetery_contacts: {
        Row: {
          address: string | null
          cemetery_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string | null
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cemetery_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cemetery_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cemetery_contacts_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
        ]
      }
      cemetery_pricing: {
        Row: {
          cemetery_id: string
          created_at: string
          id: string
          is_available: boolean
          memorial_type: string
          notes: string | null
          permit_fee: number | null
          updated_at: string
        }
        Insert: {
          cemetery_id: string
          created_at?: string
          id?: string
          is_available?: boolean
          memorial_type: string
          notes?: string | null
          permit_fee?: number | null
          updated_at?: string
        }
        Update: {
          cemetery_id?: string
          created_at?: string
          id?: string
          is_available?: boolean
          memorial_type?: string
          notes?: string | null
          permit_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cemetery_pricing_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          team_members: string[] | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          team_members?: string[] | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          team_members?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_handles: {
        Row: {
          channel: string
          created_at: string
          handle: string
          id: string
          is_primary: boolean
          owner_id: string
          owner_type: string
        }
        Insert: {
          channel: string
          created_at?: string
          handle: string
          id?: string
          is_primary?: boolean
          owner_id: string
          owner_type: string
        }
        Update: {
          channel?: string
          created_at?: string
          handle?: string
          id?: string
          is_primary?: boolean
          owner_id?: string
          owner_type?: string
        }
        Relationships: []
      }
      customer_activity: {
        Row: {
          action: string
          created_at: string | null
          customer_id: string | null
          detail: string | null
          id: number
          order_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          customer_id?: string | null
          detail?: string | null
          id?: number
          order_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          customer_id?: string | null
          detail?: string | null
          id?: number
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activity_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
        ]
      }
      enquiries: {
        Row: {
          appointment_at: string | null
          appointment_kind: string | null
          cemetery_id: string | null
          channel: string
          contact_pref: string | null
          created_at: string
          details: Json | null
          id: string
          location: string | null
          message: string | null
          order_id: string | null
          organization_id: string
          person_id: string
          photo_urls: string[] | null
          source_page: string | null
          status: string
          sub_type: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_at?: string | null
          appointment_kind?: string | null
          cemetery_id?: string | null
          channel: string
          contact_pref?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          location?: string | null
          message?: string | null
          order_id?: string | null
          organization_id: string
          person_id: string
          photo_urls?: string[] | null
          source_page?: string | null
          status?: string
          sub_type?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_at?: string | null
          appointment_kind?: string | null
          cemetery_id?: string | null
          channel?: string
          contact_pref?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          location?: string | null
          message?: string | null
          order_id?: string | null
          organization_id?: string
          person_id?: string
          photo_urls?: string[] | null
          source_page?: string | null
          status?: string
          sub_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "enquiries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_connections: {
        Row: {
          created_at: string
          ghl_api_key: string | null
          ghl_location_id: string
          id: string
          last_verified_at: string | null
          organization_id: string
          outbound_enabled: boolean
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ghl_api_key?: string | null
          ghl_location_id: string
          id?: string
          last_verified_at?: string | null
          organization_id: string
          outbound_enabled?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ghl_api_key?: string | null
          ghl_location_id?: string
          id?: string
          last_verified_at?: string | null
          organization_id?: string
          outbound_enabled?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_send_idempotency: {
        Row: {
          channel_type: string
          completed_at: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          error_message: string | null
          ghl_conversation_id: string | null
          ghl_message_id: string | null
          organization_id: string
          request_id: string
          status: string
        }
        Insert: {
          channel_type: string
          completed_at?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          error_message?: string | null
          ghl_conversation_id?: string | null
          ghl_message_id?: string | null
          organization_id: string
          request_id: string
          status: string
        }
        Update: {
          channel_type?: string
          completed_at?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          ghl_conversation_id?: string | null
          ghl_message_id?: string | null
          organization_id?: string
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_send_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token: string | null
          created_at: string
          email_address: string | null
          id: string
          last_synced_at: string | null
          organization_id: string
          provider: string
          refresh_token: string
          scope: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email_address?: string | null
          id?: string
          last_synced_at?: string | null
          organization_id: string
          provider?: string
          refresh_token: string
          scope?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email_address?: string | null
          id?: string
          last_synced_at?: string | null
          organization_id?: string
          provider?: string
          refresh_token?: string
          scope?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_ai_suggestions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          organization_id: string
          suggestion_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          organization_id: string
          suggestion_text: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          organization_id?: string
          suggestion_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_ai_suggestions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "inbox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_ai_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_ai_thread_summaries: {
        Row: {
          conversation_id: string | null
          id: string
          messages_fingerprint: string
          organization_id: string
          person_id: string | null
          scope: string
          summary_text: string
          unlinked_channel: string | null
          unlinked_handle: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          id?: string
          messages_fingerprint: string
          organization_id: string
          person_id?: string | null
          scope: string
          summary_text: string
          unlinked_channel?: string | null
          unlinked_handle?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          id?: string
          messages_fingerprint?: string
          organization_id?: string
          person_id?: string | null
          scope?: string
          summary_text?: string
          unlinked_channel?: string | null
          unlinked_handle?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_ai_thread_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_ai_thread_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_ai_thread_summaries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_ai_thread_summaries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_ai_thread_summaries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_channel_accounts: {
        Row: {
          channel: string
          created_at: string
          display_name: string | null
          id: string
          is_connected: boolean
          meta: Json
        }
        Insert: {
          channel: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_connected?: boolean
          meta?: Json
        }
        Update: {
          channel?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_connected?: boolean
          meta?: Json
        }
        Relationships: []
      }
      inbox_conversations: {
        Row: {
          channel: string
          created_at: string
          enquiry_stage: string
          external_thread_id: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_outbound_at: string | null
          link_meta: Json
          link_state: string
          order_id: string | null
          organization_id: string
          person_id: string | null
          primary_handle: string
          status: string
          subject: string | null
          unread_count: number
          user_id: string | null
          whatsapp_connection_mode: string | null
          whatsapp_managed_connection_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          enquiry_stage?: string
          external_thread_id?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          link_meta?: Json
          link_state?: string
          order_id?: string | null
          organization_id: string
          person_id?: string | null
          primary_handle: string
          status?: string
          subject?: string | null
          unread_count?: number
          user_id?: string | null
          whatsapp_connection_mode?: string | null
          whatsapp_managed_connection_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          enquiry_stage?: string
          external_thread_id?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          link_meta?: Json
          link_state?: string
          order_id?: string | null
          organization_id?: string
          person_id?: string | null
          primary_handle?: string
          status?: string
          subject?: string | null
          unread_count?: number
          user_id?: string | null
          whatsapp_connection_mode?: string | null
          whatsapp_managed_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "inbox_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_conversations_whatsapp_managed_connection_id_fkey"
            columns: ["whatsapp_managed_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_managed_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_enquiry_extraction: {
        Row: {
          cemetery_text: string | null
          confidence: number | null
          conversation_id: string
          customer_name: string | null
          customer_phone: string | null
          extracted_at: string
          flags: string[]
          inscription_text: string | null
          linked_order_id: string | null
          model: string | null
          model_meta: Json | null
          order_type: string | null
          organization_id: string
          product_text: string | null
          updated_at: string
        }
        Insert: {
          cemetery_text?: string | null
          confidence?: number | null
          conversation_id: string
          customer_name?: string | null
          customer_phone?: string | null
          extracted_at?: string
          flags?: string[]
          inscription_text?: string | null
          linked_order_id?: string | null
          model?: string | null
          model_meta?: Json | null
          order_type?: string | null
          organization_id: string
          product_text?: string | null
          updated_at?: string
        }
        Update: {
          cemetery_text?: string | null
          confidence?: number | null
          conversation_id?: string
          customer_name?: string | null
          customer_phone?: string | null
          extracted_at?: string
          flags?: string[]
          inscription_text?: string | null
          linked_order_id?: string | null
          model?: string | null
          model_meta?: Json | null
          order_type?: string | null
          organization_id?: string
          product_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_enquiry_extraction_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_enquiry_extraction_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_enquiry_extraction_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_enquiry_extraction_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_enquiry_extraction_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_enquiry_extraction_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "inbox_enquiry_extraction_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          body_html: string | null
          body_text: string
          channel: string
          conversation_id: string
          created_at: string
          direction: string
          external_message_id: string | null
          from_handle: string
          gmail_connection_id: string | null
          id: string
          meta: Json
          organization_id: string
          sent_at: string
          status: string | null
          subject: string | null
          to_handle: string
          user_id: string | null
          whatsapp_connection_id: string | null
          whatsapp_connection_mode: string | null
          whatsapp_managed_connection_id: string | null
          whatsapp_sender_sid: string | null
        }
        Insert: {
          body_html?: string | null
          body_text: string
          channel: string
          conversation_id: string
          created_at?: string
          direction: string
          external_message_id?: string | null
          from_handle: string
          gmail_connection_id?: string | null
          id?: string
          meta?: Json
          organization_id: string
          sent_at: string
          status?: string | null
          subject?: string | null
          to_handle: string
          user_id?: string | null
          whatsapp_connection_id?: string | null
          whatsapp_connection_mode?: string | null
          whatsapp_managed_connection_id?: string | null
          whatsapp_sender_sid?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string
          channel?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          external_message_id?: string | null
          from_handle?: string
          gmail_connection_id?: string | null
          id?: string
          meta?: Json
          organization_id?: string
          sent_at?: string
          status?: string | null
          subject?: string | null
          to_handle?: string
          user_id?: string | null
          whatsapp_connection_id?: string | null
          whatsapp_connection_mode?: string | null
          whatsapp_managed_connection_id?: string | null
          whatsapp_sender_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_whatsapp_managed_connection_id_fkey"
            columns: ["whatsapp_managed_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_managed_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_muted_senders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          normalized_handle: string
          organization_id: string
          source: string
          unmuted_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_handle: string
          organization_id: string
          source?: string
          unmuted_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_handle?: string
          organization_id?: string
          source?: string
          unmuted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_muted_senders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inscription_requests: {
        Row: {
          created_at: string | null
          id: number
          order_id: string
          reason: string | null
          requested_text: string
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          order_id: string
          reason?: string | null
          requested_text: string
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          order_id?: string
          reason?: string | null
          requested_text?: string
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscription_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscription_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscription_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscription_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscription_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
        ]
      }
      inscriptions: {
        Row: {
          color: string | null
          created_at: string | null
          engraved_by: string | null
          engraved_date: string | null
          id: string
          inscription_text: string
          notes: string | null
          order_id: string | null
          organization_id: string
          proof_url: string | null
          status: string
          style: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          engraved_by?: string | null
          engraved_date?: string | null
          id?: string
          inscription_text: string
          notes?: string | null
          order_id?: string | null
          organization_id: string
          proof_url?: string | null
          status?: string
          style?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          engraved_by?: string | null
          engraved_date?: string | null
          id?: string
          inscription_text?: string
          notes?: string | null
          order_id?: string | null
          organization_id?: string
          proof_url?: string | null
          status?: string
          style?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "inscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          organization_id: string
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string
          stripe_payment_intent_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          organization_id: string
          status: string
          stripe_charge_id?: string | null
          stripe_invoice_id: string
          stripe_payment_intent_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          organization_id?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string
          stripe_payment_intent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
          {
            foreignKeyName: "invoice_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          amount_paid: number | null
          amount_remaining: number | null
          created_at: string | null
          customer_name: string
          deleted_at: string | null
          due_date: string
          hosted_invoice_url: string | null
          id: string
          intended_deposit_pence: number | null
          invoice_number: string
          is_test: boolean
          issue_date: string | null
          job_id: string | null
          locked_at: string | null
          notes: string | null
          order_id: string | null
          organization_id: string | null
          paid_at: string | null
          payment_date: string | null
          payment_method: string | null
          person_id: string | null
          revised_from_invoice_id: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_credential_mode: string | null
          stripe_invoice_id: string | null
          stripe_invoice_status: string | null
          stripe_payment_intent_id: string | null
          stripe_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          amount_remaining?: number | null
          created_at?: string | null
          customer_name: string
          deleted_at?: string | null
          due_date: string
          hosted_invoice_url?: string | null
          id?: string
          intended_deposit_pence?: number | null
          invoice_number: string
          is_test?: boolean
          issue_date?: string | null
          job_id?: string | null
          locked_at?: string | null
          notes?: string | null
          order_id?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_date?: string | null
          payment_method?: string | null
          person_id?: string | null
          revised_from_invoice_id?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_credential_mode?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          amount_remaining?: number | null
          created_at?: string | null
          customer_name?: string
          deleted_at?: string | null
          due_date?: string
          hosted_invoice_url?: string | null
          id?: string
          intended_deposit_pence?: number | null
          invoice_number?: string
          is_test?: boolean
          issue_date?: string | null
          job_id?: string | null
          locked_at?: string | null
          notes?: string | null
          order_id?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_date?: string | null
          payment_method?: string | null
          person_id?: string | null
          revised_from_invoice_id?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_credential_mode?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_revised_from_invoice_id_fkey"
            columns: ["revised_from_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_revised_from_invoice_id_fkey"
            columns: ["revised_from_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_revised_from_invoice_id_fkey"
            columns: ["revised_from_invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
        ]
      }
      jobs: {
        Row: {
          conversation_id: string | null
          created_at: string
          enquiry_id: string | null
          exit_reason: string | null
          exited_at: string | null
          id: string
          organization_id: string
          paid_at: string | null
          person_id: string | null
          source: string
          stage: string
          stage_status: string | null
          updated_at: string
          wake_at: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          enquiry_id?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          id?: string
          organization_id: string
          paid_at?: string | null
          person_id?: string | null
          source: string
          stage?: string
          stage_status?: string | null
          updated_at?: string
          wake_at?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          enquiry_id?: string | null
          exit_reason?: string | null
          exited_at?: string | null
          id?: string
          organization_id?: string
          paid_at?: string | null
          person_id?: string | null
          source?: string
          stage?: string
          stage_status?: string | null
          updated_at?: string
          wake_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      memorials: {
        Row: {
          cemetery_name: string | null
          cemetery_plot: string | null
          cemetery_section: string | null
          color: string | null
          condition: string | null
          created_at: string | null
          date_of_birth: string | null
          date_of_death: string | null
          deceased_name: string | null
          dimensions: string | null
          id: string
          inscription_language: string | null
          inscription_text: string | null
          installation_date: string | null
          material: string | null
          memorial_type: string | null
          name: string | null
          notes: string | null
          order_id: string | null
          photo_url: string | null
          price: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cemetery_name?: string | null
          cemetery_plot?: string | null
          cemetery_section?: string | null
          color?: string | null
          condition?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          deceased_name?: string | null
          dimensions?: string | null
          id?: string
          inscription_language?: string | null
          inscription_text?: string | null
          installation_date?: string | null
          material?: string | null
          memorial_type?: string | null
          name?: string | null
          notes?: string | null
          order_id?: string | null
          photo_url?: string | null
          price?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cemetery_name?: string | null
          cemetery_plot?: string | null
          cemetery_section?: string | null
          color?: string | null
          condition?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          deceased_name?: string | null
          dimensions?: string | null
          id?: string
          inscription_language?: string | null
          inscription_text?: string | null
          installation_date?: string | null
          material?: string | null
          memorial_type?: string | null
          name?: string | null
          notes?: string | null
          order_id?: string | null
          photo_url?: string | null
          price?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memorials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
        ]
      }
      oauth_state: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          nonce: string
          organization_id: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          nonce: string
          organization_id: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          nonce?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_additional_options: {
        Row: {
          cost: number
          created_at: string
          description: string | null
          id: string
          name: string
          order_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_additional_options_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_additional_options_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_additional_options_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_additional_options_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_additional_options_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_additional_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string | null
          detail: Json | null
          event_type: string
          id: string
          order_id: string
          summary: string
        }
        Insert: {
          created_at?: string | null
          detail?: Json | null
          event_type: string
          id?: string
          order_id: string
          summary: string
        }
        Update: {
          created_at?: string | null
          detail?: Json | null
          event_type?: string
          id?: string
          order_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          external_id: string
          id: string
          match_candidates: Json | null
          match_reason: string | null
          matched_at: string | null
          matched_by: string | null
          order_id: string | null
          organization_id: string | null
          payment_type: string | null
          received_at: string | null
          reference: string | null
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          external_id: string
          id?: string
          match_candidates?: Json | null
          match_reason?: string | null
          matched_at?: string | null
          matched_by?: string | null
          order_id?: string | null
          organization_id?: string | null
          payment_type?: string | null
          received_at?: string | null
          reference?: string | null
          source: string
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          external_id?: string
          id?: string
          match_candidates?: Json | null
          match_reason?: string | null
          matched_at?: string | null
          matched_by?: string | null
          order_id?: string | null
          organization_id?: string | null
          payment_type?: string | null
          received_at?: string | null
          reference?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_people: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          order_id: string
          organization_id: string
          person_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          order_id: string
          organization_id: string
          person_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          order_id?: string
          organization_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_people_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_people_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_people_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_people_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_people_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_people_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      order_permits: {
        Row: {
          approved_at: string | null
          cemetery_id: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          organization_id: string
          permit_form_id: string | null
          permit_phase: string
          returned_at: string | null
          returned_via: string | null
          sent_at: string | null
          sent_via: string | null
          spec_fixings: string | null
          spec_plot_ref: string | null
          specs_completed_at: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          cemetery_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          organization_id: string
          permit_form_id?: string | null
          permit_phase?: string
          returned_at?: string | null
          returned_via?: string | null
          sent_at?: string | null
          sent_via?: string | null
          spec_fixings?: string | null
          spec_plot_ref?: string | null
          specs_completed_at?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          cemetery_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string
          permit_form_id?: string | null
          permit_phase?: string
          returned_at?: string | null
          returned_via?: string | null
          sent_at?: string | null
          sent_via?: string | null
          spec_fixings?: string | null
          spec_plot_ref?: string | null
          specs_completed_at?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_permits_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_permits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_permits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_permits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_permits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_permits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_permits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_permits_permit_form_id_fkey"
            columns: ["permit_form_id"]
            isOneToOne: false
            referencedRelation: "permit_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      order_proof_ai_checks: {
        Row: {
          created_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          label: string
          level: string
          organization_id: string
          proof_id: string
          suggest: string | null
          version: number
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          label: string
          level: string
          organization_id: string
          proof_id: string
          suggest?: string | null
          version: number
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          label?: string
          level?: string
          organization_id?: string
          proof_id?: string
          suggest?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_proof_ai_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proof_ai_checks_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "order_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      order_proof_versions: {
        Row: {
          actor: string
          created_at: string
          days_from_inscription: number | null
          event: string
          id: string
          note: string | null
          organization_id: string
          proof_id: string
          render_url: string | null
          version: number
        }
        Insert: {
          actor: string
          created_at?: string
          days_from_inscription?: number | null
          event: string
          id?: string
          note?: string | null
          organization_id: string
          proof_id: string
          render_url?: string | null
          version: number
        }
        Update: {
          actor?: string
          created_at?: string
          days_from_inscription?: number | null
          event?: string
          id?: string
          note?: string | null
          organization_id?: string
          proof_id?: string
          render_url?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_proof_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proof_versions_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "order_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      order_proofs: {
        Row: {
          additional_instructions: string | null
          approved_at: string | null
          approved_by: string | null
          changes_note: string | null
          changes_requested_at: string | null
          created_at: string
          font_style: string | null
          id: string
          inbox_conversation_id: string | null
          inscription_received_at: string | null
          inscription_text: string
          last_error: string | null
          order_id: string
          organization_id: string
          render_meta: Json | null
          render_method: string
          render_provider: string | null
          render_url: string | null
          sent_at: string | null
          sent_via: string | null
          state: string
          stone_photo_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_instructions?: string | null
          approved_at?: string | null
          approved_by?: string | null
          changes_note?: string | null
          changes_requested_at?: string | null
          created_at?: string
          font_style?: string | null
          id?: string
          inbox_conversation_id?: string | null
          inscription_received_at?: string | null
          inscription_text: string
          last_error?: string | null
          order_id: string
          organization_id: string
          render_meta?: Json | null
          render_method?: string
          render_provider?: string | null
          render_url?: string | null
          sent_at?: string | null
          sent_via?: string | null
          state?: string
          stone_photo_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_instructions?: string | null
          approved_at?: string | null
          approved_by?: string | null
          changes_note?: string | null
          changes_requested_at?: string | null
          created_at?: string
          font_style?: string | null
          id?: string
          inbox_conversation_id?: string | null
          inscription_received_at?: string | null
          inscription_text?: string
          last_error?: string | null
          order_id?: string
          organization_id?: string
          render_meta?: Json | null
          render_method?: string
          render_provider?: string | null
          render_url?: string | null
          sent_at?: string | null
          sent_via?: string | null
          state?: string
          stone_photo_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_proofs_inbox_conversation_id_fkey"
            columns: ["inbox_conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_proofs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          cemetery_id: string | null
          color: string | null
          created_at: string | null
          custom_product_name: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deposit_date: string | null
          due_date: string | null
          edit_token: string | null
          estimated_completion: string | null
          geocode_error: string | null
          geocode_place_id: string | null
          geocode_status: string | null
          geocoded_at: string | null
          id: string
          inscription_additional: string | null
          inscription_font: string | null
          inscription_font_other: string | null
          inscription_layout: string | null
          inscription_status: string | null
          inscription_text: string | null
          installation_date: string | null
          invoice_id: string | null
          is_test: boolean
          job_id: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          material: string | null
          notes: string | null
          order_number: number | null
          order_type: string
          organization_id: string
          partner_id: number | null
          permit_cost: number
          permit_fee: number | null
          permit_form_id: string | null
          permit_status: string | null
          permit_transferred_at: string | null
          person_id: string | null
          person_name: string | null
          priority: string | null
          product_config: string | null
          product_id: string | null
          product_photo_url: string | null
          progress: number | null
          proof_notes: string | null
          proof_status: string | null
          proof_uploaded_at: string | null
          proof_url: string | null
          quote_id: string | null
          renovation_service_cost: number
          renovation_service_description: string | null
          second_payment_date: string | null
          sku: string | null
          status: string | null
          stone_status: string | null
          timeline_weeks: number | null
          tracking_token: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          cemetery_id?: string | null
          color?: string | null
          created_at?: string | null
          custom_product_name?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deposit_date?: string | null
          due_date?: string | null
          edit_token?: string | null
          estimated_completion?: string | null
          geocode_error?: string | null
          geocode_place_id?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          inscription_additional?: string | null
          inscription_font?: string | null
          inscription_font_other?: string | null
          inscription_layout?: string | null
          inscription_status?: string | null
          inscription_text?: string | null
          installation_date?: string | null
          invoice_id?: string | null
          is_test?: boolean
          job_id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          material?: string | null
          notes?: string | null
          order_number?: number | null
          order_type: string
          organization_id: string
          partner_id?: number | null
          permit_cost?: number
          permit_fee?: number | null
          permit_form_id?: string | null
          permit_status?: string | null
          permit_transferred_at?: string | null
          person_id?: string | null
          person_name?: string | null
          priority?: string | null
          product_config?: string | null
          product_id?: string | null
          product_photo_url?: string | null
          progress?: number | null
          proof_notes?: string | null
          proof_status?: string | null
          proof_uploaded_at?: string | null
          proof_url?: string | null
          quote_id?: string | null
          renovation_service_cost?: number
          renovation_service_description?: string | null
          second_payment_date?: string | null
          sku?: string | null
          status?: string | null
          stone_status?: string | null
          timeline_weeks?: number | null
          tracking_token?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          cemetery_id?: string | null
          color?: string | null
          created_at?: string | null
          custom_product_name?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deposit_date?: string | null
          due_date?: string | null
          edit_token?: string | null
          estimated_completion?: string | null
          geocode_error?: string | null
          geocode_place_id?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string
          inscription_additional?: string | null
          inscription_font?: string | null
          inscription_font_other?: string | null
          inscription_layout?: string | null
          inscription_status?: string | null
          inscription_text?: string | null
          installation_date?: string | null
          invoice_id?: string | null
          is_test?: boolean
          job_id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          material?: string | null
          notes?: string | null
          order_number?: number | null
          order_type?: string
          organization_id?: string
          partner_id?: number | null
          permit_cost?: number
          permit_fee?: number | null
          permit_form_id?: string | null
          permit_status?: string | null
          permit_transferred_at?: string | null
          person_id?: string | null
          person_name?: string | null
          priority?: string | null
          product_config?: string | null
          product_id?: string | null
          product_photo_url?: string | null
          progress?: number | null
          proof_notes?: string | null
          proof_status?: string | null
          proof_uploaded_at?: string | null
          proof_url?: string | null
          quote_id?: string | null
          renovation_service_cost?: number
          renovation_service_description?: string | null
          second_payment_date?: string | null
          sku?: string | null
          status?: string | null
          stone_status?: string | null
          timeline_weeks?: number | null
          tracking_token?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
          {
            foreignKeyName: "orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_permit_form_id_fkey"
            columns: ["permit_form_id"]
            isOneToOne: false
            referencedRelation: "permit_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_stripe_config: {
        Row: {
          created_at: string
          live_payments_enabled: boolean
          live_publishable_key: string | null
          live_secret_key_encrypted: string | null
          live_webhook_secret_encrypted: string | null
          organization_id: string
          test_publishable_key: string | null
          test_round_trip_passed_at: string | null
          test_secret_key_encrypted: string | null
          test_webhook_secret_encrypted: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          live_payments_enabled?: boolean
          live_publishable_key?: string | null
          live_secret_key_encrypted?: string | null
          live_webhook_secret_encrypted?: string | null
          organization_id: string
          test_publishable_key?: string | null
          test_round_trip_passed_at?: string | null
          test_secret_key_encrypted?: string | null
          test_webhook_secret_encrypted?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          live_payments_enabled?: boolean
          live_publishable_key?: string | null
          live_secret_key_encrypted?: string | null
          live_webhook_secret_encrypted?: string | null
          organization_id?: string
          test_publishable_key?: string | null
          test_round_trip_passed_at?: string | null
          test_secret_key_encrypted?: string | null
          test_webhook_secret_encrypted?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_stripe_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: number
          order_id: string
          partner_id: number
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: number
          order_id: string
          partner_id: number
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: number
          order_id?: string
          partner_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "partner_comments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: number
          partner_id: number
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: number
          partner_id: number
          token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: number
          partner_id?: number
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean | null
          approved_at: string | null
          company: string | null
          created_at: string | null
          declined_at: string | null
          email: string
          id: number
          name: string
          notes: string | null
          password_hash: string
          phone: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          approved_at?: string | null
          company?: string | null
          created_at?: string | null
          declined_at?: string | null
          email: string
          id?: number
          name: string
          notes?: string | null
          password_hash: string
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          approved_at?: string | null
          company?: string | null
          created_at?: string | null
          declined_at?: string | null
          email?: string
          id?: number
          name?: string
          notes?: string | null
          password_hash?: string
          phone?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: number
          partner_id: number
          token: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: number
          partner_id: number
          token: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: number
          partner_id?: number
          token?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          organization_id: string
          reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date?: string
          id?: string
          invoice_id: string
          method: string
          notes?: string | null
          organization_id: string
          reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          organization_id?: string
          reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          customer_override_at: string | null
          email: string | null
          first_name: string
          id: string
          is_customer: boolean
          is_customer_override: boolean | null
          is_test: boolean
          last_name: string
          organization_id: string
          phone: string | null
          portal_token: string | null
          portal_token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          customer_override_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_customer?: boolean
          is_customer_override?: boolean | null
          is_test?: boolean
          last_name: string
          organization_id: string
          phone?: string | null
          portal_token?: string | null
          portal_token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          customer_override_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_customer?: boolean
          is_customer_override?: boolean | null
          is_test?: boolean
          last_name?: string
          organization_id?: string
          phone?: string | null
          portal_token?: string | null
          portal_token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permit_forms: {
        Row: {
          cemetery_id: string | null
          created_at: string
          google_drive_file_id: string | null
          google_drive_folder_id: string | null
          id: string
          last_synced_at: string | null
          link: string | null
          match_reason: string | null
          mime_type: string | null
          name: string
          note: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          cemetery_id?: string | null
          created_at?: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          last_synced_at?: string | null
          link?: string | null
          match_reason?: string | null
          mime_type?: string | null
          name: string
          note?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          cemetery_id?: string | null
          created_at?: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          last_synced_at?: string | null
          link?: string | null
          match_reason?: string | null
          mime_type?: string | null
          name?: string
          note?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permit_forms_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addons: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          slug?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_sizes: {
        Row: {
          created_at: string | null
          dimensions: string | null
          display_order: number | null
          id: string
          is_default: boolean | null
          price_adjustment: number | null
          product_id: string | null
          size_code: string
          size_name: string
        }
        Insert: {
          created_at?: string | null
          dimensions?: string | null
          display_order?: number | null
          id?: string
          is_default?: boolean | null
          price_adjustment?: number | null
          product_id?: string | null
          size_code: string
          size_name: string
        }
        Update: {
          created_at?: string | null
          dimensions?: string | null
          display_order?: number | null
          id?: string
          is_default?: boolean | null
          price_adjustment?: number | null
          product_id?: string | null
          size_code?: string
          size_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          gallery_images: Json | null
          id: string
          image_url: string | null
          included_features: Json | null
          inscription_chars_included: number | null
          inscription_price_per_char: number | null
          is_active: boolean | null
          is_featured: boolean | null
          is_listed: boolean
          name: string
          organization_id: string
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string | null
          slug: string
          supplier_sku: string | null
          updated_at: string | null
        }
        Insert: {
          base_price: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          included_features?: Json | null
          inscription_chars_included?: number | null
          inscription_price_per_char?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_listed?: boolean
          name: string
          organization_id: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug: string
          supplier_sku?: string | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          included_features?: Json | null
          inscription_chars_included?: number | null
          inscription_price_per_char?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_listed?: boolean
          name?: string
          organization_id?: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          supplier_sku?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_followups: {
        Row: {
          cemetery: string | null
          created_at: string | null
          customer_email: string
          customer_name: string | null
          followup_1_sent_at: string | null
          followup_2_sent_at: string | null
          followup_3_sent_at: string | null
          ghl_contact_id: string | null
          id: string
          order_ref: string | null
          quote_sent_at: string
          reply_detected_at: string | null
          status: string
          thread_id: string
          thread_message_count: number | null
          updated_at: string | null
        }
        Insert: {
          cemetery?: string | null
          created_at?: string | null
          customer_email: string
          customer_name?: string | null
          followup_1_sent_at?: string | null
          followup_2_sent_at?: string | null
          followup_3_sent_at?: string | null
          ghl_contact_id?: string | null
          id?: string
          order_ref?: string | null
          quote_sent_at: string
          reply_detected_at?: string | null
          status?: string
          thread_id: string
          thread_message_count?: number | null
          updated_at?: string | null
        }
        Update: {
          cemetery?: string | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string | null
          followup_1_sent_at?: string | null
          followup_2_sent_at?: string | null
          followup_3_sent_at?: string | null
          ghl_contact_id?: string | null
          id?: string
          order_ref?: string | null
          quote_sent_at?: string
          reply_detected_at?: string | null
          status?: string
          thread_id?: string
          thread_message_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          accepted_at: string | null
          color: string | null
          converted_at: string | null
          converted_to_order_id: string | null
          created_at: string | null
          customer_id: string | null
          deceased_name: string | null
          enquiry_id: string | null
          expires_at: string | null
          id: string
          inscription: string | null
          location: string | null
          material: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          partner_id: number | null
          permit_cost: number | null
          product_config: string | null
          product_name: string
          product_sku: string | null
          quote_number: number
          sent_at: string | null
          status: string
          total_value: number | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          accepted_at?: string | null
          color?: string | null
          converted_at?: string | null
          converted_to_order_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          deceased_name?: string | null
          enquiry_id?: string | null
          expires_at?: string | null
          id?: string
          inscription?: string | null
          location?: string | null
          material?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          partner_id?: number | null
          permit_cost?: number | null
          product_config?: string | null
          product_name: string
          product_sku?: string | null
          quote_number?: number
          sent_at?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          accepted_at?: string | null
          color?: string | null
          converted_at?: string | null
          converted_to_order_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          deceased_name?: string | null
          enquiry_id?: string | null
          expires_at?: string | null
          id?: string
          inscription?: string | null
          location?: string | null
          material?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          partner_id?: number | null
          permit_cost?: number | null
          product_config?: string | null
          product_name?: string
          product_sku?: string | null
          quote_number?: number
          sent_at?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_to_order_id_fkey"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      stone_colours: {
        Row: {
          created_at: string | null
          display_order: number | null
          hex_primary: string
          hex_secondary: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_premium: boolean
          name: string
          slug: string
          tier: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          hex_primary: string
          hex_secondary?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_premium?: boolean
          name: string
          slug: string
          tier?: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          hex_primary?: string
          hex_secondary?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_premium?: boolean
          name?: string
          slug?: string
          tier?: string
        }
        Relationships: []
      }
      table_view_presets: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          module: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          is_default?: boolean
          module: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          module?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_view_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connection_events: {
        Row: {
          actor_type: string
          correlation_id: string | null
          event_type: string
          id: string
          managed_connection_id: string
          new_status: string | null
          occurred_at: string
          organization_id: string
          payload: Json
          previous_status: string | null
          request_id: string | null
          user_id: string
        }
        Insert: {
          actor_type: string
          correlation_id?: string | null
          event_type: string
          id?: string
          managed_connection_id: string
          new_status?: string | null
          occurred_at?: string
          organization_id: string
          payload?: Json
          previous_status?: string | null
          request_id?: string | null
          user_id: string
        }
        Update: {
          actor_type?: string
          correlation_id?: string | null
          event_type?: string
          id?: string
          managed_connection_id?: string
          new_status?: string | null
          occurred_at?: string
          organization_id?: string
          payload?: Json
          previous_status?: string | null
          request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connection_events_managed_connection_id_fkey"
            columns: ["managed_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_managed_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connection_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          company_id: string | null
          created_at: string
          disconnected_at: string | null
          id: string
          last_error: string | null
          last_validated_at: string | null
          organization_id: string
          provider: string
          status: string
          twilio_account_sid: string
          twilio_api_key_secret_encrypted: string
          twilio_api_key_sid: string
          updated_at: string
          user_id: string
          whatsapp_from: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          organization_id: string
          provider?: string
          status?: string
          twilio_account_sid: string
          twilio_api_key_secret_encrypted: string
          twilio_api_key_sid: string
          updated_at?: string
          user_id: string
          whatsapp_from: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          organization_id?: string
          provider?: string
          status?: string
          twilio_account_sid?: string
          twilio_api_key_secret_encrypted?: string
          twilio_api_key_sid?: string
          updated_at?: string
          user_id?: string
          whatsapp_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_managed_connections: {
        Row: {
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          display_number: string | null
          id: string
          label: string | null
          last_error: string | null
          last_state_change_at: string | null
          meta: Json
          organization_id: string
          platform_twilio_account_sid: string | null
          provider: string
          provider_ready: boolean
          state: string
          twilio_sender: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          display_number?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_state_change_at?: string | null
          meta?: Json
          organization_id: string
          platform_twilio_account_sid?: string | null
          provider?: string
          provider_ready?: boolean
          state: string
          twilio_sender?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          display_number?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_state_change_at?: string | null
          meta?: Json
          organization_id?: string
          platform_twilio_account_sid?: string | null
          provider?: string
          provider_ready?: boolean
          state?: string
          twilio_sender?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_managed_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_user_preferences: {
        Row: {
          created_at: string
          organization_id: string
          preferred_whatsapp_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          preferred_whatsapp_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          preferred_whatsapp_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_user_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_slas: {
        Row: {
          max_days: number
          organization_id: string
          stage: string
          target_days: number
          updated_at: string
          warn_days: number
          workflow: string
        }
        Insert: {
          max_days: number
          organization_id: string
          stage: string
          target_days: number
          updated_at?: string
          warn_days: number
          workflow: string
        }
        Update: {
          max_days?: number
          organization_id?: string
          stage?: string
          target_days?: number
          updated_at?: string
          warn_days?: number
          workflow?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_slas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_scores: {
        Row: {
          band: string | null
          breakdown: Json | null
          first_name: string | null
          id: string | null
          last_name: string | null
          last_order_at: string | null
          order_count: number | null
          organization_id: string | null
          score: number | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          is_customer: boolean | null
          last_name: string | null
          organization_id: string | null
          phone: string | null
          portal_token: string | null
          portal_token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_customer?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          portal_token?: string | null
          portal_token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_customer?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          portal_token?: string | null
          portal_token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiry_scores: {
        Row: {
          band: string | null
          breakdown: Json | null
          id: string | null
          order_id: string | null
          organization_id: string | null
          person_id: string | null
          score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "enquiries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices_with_breakdown: {
        Row: {
          additional_options_total: number | null
          amount: number | null
          amount_paid: number | null
          amount_remaining: number | null
          created_at: string | null
          customer_name: string | null
          deleted_at: string | null
          due_date: string | null
          hosted_invoice_url: string | null
          id: string | null
          intended_deposit_pence: number | null
          invoice_number: string | null
          is_test: boolean | null
          issue_date: string | null
          locked_at: string | null
          main_product_total: number | null
          notes: string | null
          order_id: string | null
          organization_id: string | null
          paid_at: string | null
          payment_date: string | null
          payment_method: string | null
          permit_total_cost: number | null
          person_id: string | null
          revised_from_invoice_id: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_invoice_id: string | null
          stripe_invoice_status: string | null
          stripe_payment_intent_id: string | null
          stripe_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_options_total"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_permit_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_revised_from_invoice_id_fkey"
            columns: ["revised_from_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_revised_from_invoice_id_fkey"
            columns: ["revised_from_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_revised_from_invoice_id_fkey"
            columns: ["revised_from_invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
        ]
      }
      orders_with_balance: {
        Row: {
          admin_notes: string | null
          amount_paid: number | null
          assigned_to: string | null
          balance_due: number | null
          cemetery_id: string | null
          color: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          deposit_date: string | null
          due_date: string | null
          edit_token: string | null
          estimated_completion: string | null
          final_invoice_id: string | null
          final_invoice_sent_at: string | null
          geocode_error: string | null
          geocode_place_id: string | null
          geocode_status: string | null
          geocoded_at: string | null
          id: string | null
          inscription_additional: string | null
          inscription_font: string | null
          inscription_font_other: string | null
          inscription_layout: string | null
          inscription_status: string | null
          inscription_text: string | null
          installation_date: string | null
          invoice_id: string | null
          is_test: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          material: string | null
          notes: string | null
          order_number: number | null
          order_type: string | null
          organization_id: string | null
          partner_id: number | null
          permit_cost: number | null
          permit_fee: number | null
          permit_form_id: string | null
          permit_status: string | null
          permit_transferred_at: string | null
          person_id: string | null
          person_name: string | null
          priority: string | null
          product_config: string | null
          product_id: string | null
          product_photo_url: string | null
          progress: number | null
          proof_notes: string | null
          proof_status: string | null
          proof_uploaded_at: string | null
          proof_url: string | null
          quote_id: string | null
          renovation_service_cost: number | null
          renovation_service_description: string | null
          second_payment_date: string | null
          sku: string | null
          status: string | null
          stone_status: string | null
          timeline_weeks: number | null
          total_order_value: number | null
          tracking_token: string | null
          updated_at: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_permit_form_id_fkey"
            columns: ["permit_form_id"]
            isOneToOne: false
            referencedRelation: "permit_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_with_options_total: {
        Row: {
          additional_options_total: number | null
          assigned_to: string | null
          color: string | null
          created_at: string | null
          custom_product_name: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          deposit_date: string | null
          due_date: string | null
          edit_token: string | null
          estimated_completion: string | null
          geocode_error: string | null
          geocode_place_id: string | null
          geocode_status: string | null
          geocoded_at: string | null
          id: string | null
          inscription_additional: string | null
          inscription_font: string | null
          inscription_font_other: string | null
          inscription_layout: string | null
          inscription_status: string | null
          inscription_text: string | null
          installation_date: string | null
          invoice_id: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          material: string | null
          notes: string | null
          order_number: number | null
          order_type: string | null
          organization_id: string | null
          partner_id: number | null
          permit_cost: number | null
          permit_fee: number | null
          permit_form_id: string | null
          permit_status: string | null
          permit_transferred_at: string | null
          person_id: string | null
          person_name: string | null
          priority: string | null
          product_config: string | null
          product_id: string | null
          product_photo_url: string | null
          progress: number | null
          proof_notes: string | null
          proof_status: string | null
          proof_uploaded_at: string | null
          proof_url: string | null
          quote_id: string | null
          renovation_service_cost: number | null
          renovation_service_description: string | null
          second_payment_date: string | null
          sku: string | null
          status: string | null
          stone_status: string | null
          timeline_weeks: number | null
          tracking_token: string | null
          updated_at: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_permit_form_id_fkey"
            columns: ["permit_form_id"]
            isOneToOne: false
            referencedRelation: "permit_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_monthly_revenue: {
        Row: {
          invoice_count: number | null
          month: string | null
          outstanding_amount: number | null
          paid_amount: number | null
          total_amount: number | null
        }
        Relationships: []
      }
      v_order_line_items: {
        Row: {
          created_at: string | null
          customer_name: string | null
          item_description: string | null
          item_name: string | null
          item_ref: string | null
          line_cost: number | null
          line_type: string | null
          order_id: string | null
          order_number: number | null
          partner_id: number | null
          person_id: string | null
        }
        Relationships: []
      }
      v_order_status_summary: {
        Row: {
          avg_progress: number | null
          overdue: number | null
          pending_approval: number | null
          ready_for_install: number | null
          total_orders: number | null
        }
        Relationships: []
      }
      v_orders_with_stage: {
        Row: {
          assigned_to: string | null
          color: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          deposit_date: string | null
          due_date: string | null
          edit_token: string | null
          estimated_completion: string | null
          geocode_error: string | null
          geocode_place_id: string | null
          geocode_status: string | null
          geocoded_at: string | null
          id: string | null
          inscription_additional: string | null
          inscription_font: string | null
          inscription_font_other: string | null
          inscription_layout: string | null
          inscription_status: string | null
          inscription_text: string | null
          installation_date: string | null
          invoice_id: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          material: string | null
          notes: string | null
          order_number: number | null
          order_type: string | null
          organization_id: string | null
          partner_id: number | null
          permit_cost: number | null
          permit_fee: number | null
          permit_form_id: string | null
          permit_status: string | null
          permit_transferred_at: string | null
          person_id: string | null
          person_name: string | null
          priority: string | null
          product_config: string | null
          product_id: string | null
          product_photo_url: string | null
          progress: number | null
          proof_notes: string | null
          proof_status: string | null
          proof_uploaded_at: string | null
          proof_url: string | null
          quote_id: string | null
          renovation_service_cost: number | null
          renovation_service_description: string | null
          second_payment_date: string | null
          sku: string | null
          stage: string | null
          status: string | null
          stone_status: string | null
          timeline_weeks: number | null
          tracking_token: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          color?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_date?: string | null
          due_date?: string | null
          edit_token?: string | null
          estimated_completion?: string | null
          geocode_error?: string | null
          geocode_place_id?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string | null
          inscription_additional?: string | null
          inscription_font?: string | null
          inscription_font_other?: string | null
          inscription_layout?: string | null
          inscription_status?: string | null
          inscription_text?: string | null
          installation_date?: string | null
          invoice_id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          material?: string | null
          notes?: string | null
          order_number?: number | null
          order_type?: string | null
          organization_id?: string | null
          partner_id?: number | null
          permit_cost?: number | null
          permit_fee?: number | null
          permit_form_id?: string | null
          permit_status?: string | null
          permit_transferred_at?: string | null
          person_id?: string | null
          person_name?: string | null
          priority?: string | null
          product_config?: string | null
          product_id?: string | null
          product_photo_url?: string | null
          progress?: number | null
          proof_notes?: string | null
          proof_status?: string | null
          proof_uploaded_at?: string | null
          proof_url?: string | null
          quote_id?: string | null
          renovation_service_cost?: number | null
          renovation_service_description?: string | null
          second_payment_date?: string | null
          sku?: string | null
          stage?: never
          status?: string | null
          stone_status?: string | null
          timeline_weeks?: number | null
          tracking_token?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          color?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_date?: string | null
          due_date?: string | null
          edit_token?: string | null
          estimated_completion?: string | null
          geocode_error?: string | null
          geocode_place_id?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          id?: string | null
          inscription_additional?: string | null
          inscription_font?: string | null
          inscription_font_other?: string | null
          inscription_layout?: string | null
          inscription_status?: string | null
          inscription_text?: string | null
          installation_date?: string | null
          invoice_id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          material?: string | null
          notes?: string | null
          order_number?: number | null
          order_type?: string | null
          organization_id?: string | null
          partner_id?: number | null
          permit_cost?: number | null
          permit_fee?: number | null
          permit_form_id?: string | null
          permit_status?: string | null
          permit_transferred_at?: string | null
          person_id?: string | null
          person_name?: string | null
          priority?: string | null
          product_config?: string | null
          product_id?: string | null
          product_photo_url?: string | null
          progress?: number | null
          proof_notes?: string | null
          proof_status?: string | null
          proof_uploaded_at?: string | null
          proof_url?: string | null
          quote_id?: string | null
          renovation_service_cost?: number | null
          renovation_service_description?: string | null
          second_payment_date?: string | null
          sku?: string | null
          stage?: never
          status?: string | null
          stone_status?: string | null
          timeline_weeks?: number | null
          tracking_token?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_with_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "orders_with_balance"
            referencedColumns: ["final_invoice_id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_permit_form_id_fkey"
            columns: ["permit_form_id"]
            isOneToOne: false
            referencedRelation: "permit_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customer_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_permit_reconciliation: {
        Row: {
          amount_still_held: number | null
          collected_date: string | null
          customer_name: string | null
          location: string | null
          order_id: string | null
          order_number: number | null
          permit_cost: number | null
          permit_status: string | null
          permit_transferred_at: string | null
        }
        Insert: {
          amount_still_held?: never
          collected_date?: string | null
          customer_name?: string | null
          location?: string | null
          order_id?: string | null
          order_number?: number | null
          permit_cost?: number | null
          permit_status?: never
          permit_transferred_at?: string | null
        }
        Update: {
          amount_still_held?: never
          collected_date?: string | null
          customer_name?: string | null
          location?: string | null
          order_id?: string | null
          order_number?: number | null
          permit_cost?: number | null
          permit_status?: never
          permit_transferred_at?: string | null
        }
        Relationships: []
      }
      v_top_products: {
        Row: {
          net_revenue: number | null
          order_count: number | null
          product_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activity_log_write: {
        Args: {
          p_action: string
          p_changes: Json
          p_context?: Json
          p_entity_id: string
          p_entity_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      add_organization_member_by_email: {
        Args: { p_email: string; p_organization_id: string }
        Returns: undefined
      }
      change_member_role: {
        Args: { p_organization_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      create_inbox_from_enquiry: {
        Args: { p_enquiry_id: string }
        Returns: string
      }
      create_organization: { Args: { p_name: string }; Returns: string }
      create_quote: { Args: { payload: Json }; Returns: Json }
      delete_conversations: {
        Args: { p_conversation_ids: string[] }
        Returns: number
      }
      delete_organization: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      get_active_organization_id: { Args: never; Returns: string }
      get_customer_messages: {
        Args: { p_organization_id: string; p_person_id: string }
        Returns: {
          body_html: string | null
          body_text: string
          channel: string
          conversation_id: string
          created_at: string
          direction: string
          external_message_id: string | null
          from_handle: string
          gmail_connection_id: string | null
          id: string
          meta: Json
          organization_id: string
          sent_at: string
          status: string | null
          subject: string | null
          to_handle: string
          user_id: string | null
          whatsapp_connection_id: string | null
          whatsapp_connection_mode: string | null
          whatsapp_managed_connection_id: string | null
          whatsapp_sender_sid: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inbox_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_ghl_api_key: {
        Args: { p_connection_id: string; p_encryption_key: string }
        Returns: string
      }
      get_inquiries_pipeline: {
        Args: {
          p_channels?: string[]
          p_from_date?: string
          p_organization_id: string
          p_to_date?: string
        }
        Returns: {
          appointment_at: string
          appointment_kind: string
          channel: string
          contact_pref: string
          created_at: string
          details: Json
          enquiry_id: string
          linked_order_id: string
          linked_order_status: string
          linked_quote_created_at: string
          linked_quote_id: string
          linked_quote_status: string
          linked_quote_total: number
          location: string
          message: string
          order_id: string
          person_email: string
          person_first_name: string
          person_id: string
          person_last_name: string
          person_phone: string
          photo_urls: string[]
          source_page: string
          stage: string
          sub_type: string
        }[]
      }
      get_next_invoice_number: { Args: never; Returns: string }
      get_organization_members_with_identity: {
        Args: { p_organization_id: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }[]
      }
      get_stripe_secret_key: {
        Args: {
          p_encryption_key: string
          p_mode: string
          p_organization_id: string
        }
        Returns: string
      }
      get_stripe_webhook_secret: {
        Args: {
          p_encryption_key: string
          p_mode: string
          p_organization_id: string
        }
        Returns: string
      }
      get_unlinked_messages: {
        Args: { p_channel: string; p_handle: string; p_organization_id: string }
        Returns: {
          body_html: string | null
          body_text: string
          channel: string
          conversation_id: string
          created_at: string
          direction: string
          external_message_id: string | null
          from_handle: string
          gmail_connection_id: string | null
          id: string
          meta: Json
          organization_id: string
          sent_at: string
          status: string | null
          subject: string | null
          to_handle: string
          user_id: string | null
          whatsapp_connection_id: string | null
          whatsapp_connection_mode: string | null
          whatsapp_managed_connection_id: string | null
          whatsapp_sender_sid: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inbox_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      jsonb_diff_rows: {
        Args: { ignore_keys?: string[]; new_row: Json; old_row: Json }
        Returns: Json
      }
      order_stage: {
        Args: {
          p_permit_status: string
          p_proof_status: string
          p_stone_status: string
        }
        Returns: string
      }
      recompute_person_is_customer: {
        Args: { p_person: string }
        Returns: undefined
      }
      remove_organization_member: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      upsert_organization_stripe_credentials: {
        Args: {
          p_encryption_key: string
          p_live_publishable_key?: string
          p_live_secret_key?: string
          p_live_webhook_secret?: string
          p_organization_id: string
          p_test_publishable_key: string
          p_test_secret_key: string
          p_test_webhook_secret: string
        }
        Returns: undefined
      }
      user_is_admin_of_org: { Args: { p_org_id: string }; Returns: boolean }
      user_is_member_of_org: { Args: { p_org_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
