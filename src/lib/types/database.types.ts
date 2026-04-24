/**
 * Supabase TypeScript types for Database
 *
 * NOTE: This file was hand-authored from the migration schemas in
 * supabase/migrations/ because the Supabase project credentials are not yet
 * configured in .env.local.
 *
 * Once NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set and
 * `npx supabase link` is run, regenerate with:
 *   npx supabase gen types typescript --linked > src/lib/types/database.types.ts
 *
 * TODO: Regenerate from live schema after credentials are configured (auth gate).
 * Last updated: added clients, pipeline_stages, client_interactions, client_tasks
 * from migrations 0006–0009 (Phase 02 Plan 01).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          cnpj: string
          segment: 'seguros' | 'consorcio' | 'ambos'
          plan: string
          trial_ends_at: string
          active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          cnpj: string
          segment: 'seguros' | 'consorcio' | 'ambos'
          plan?: string
          trial_ends_at?: string
          active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          cnpj?: string
          segment?: 'seguros' | 'consorcio' | 'ambos'
          plan?: string
          trial_ends_at?: string
          active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          full_name: string | null
          role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
          active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          full_name?: string | null
          role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
          active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          full_name?: string | null
          role?: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
          active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      user_invitations: {
        Row: {
          id: string
          tenant_id: string
          email: string
          role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
          invited_by: string
          token: string
          expires_at: string
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
          invited_by: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          role?: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
          invited_by?: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_invitations_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_invitations_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      // -----------------------------------------------------------------------
      // Phase 02 tables — added from migrations 0006–0009
      // -----------------------------------------------------------------------
      clients: {
        Row: {
          id: string
          tenant_id: string
          type: 'pf' | 'pj'
          document: string
          name: string
          responsible: string | null
          email: string | null
          phone: string | null
          address: Json | null
          stage_id: string | null
          assigned_to: string
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type: 'pf' | 'pj'
          document: string
          name: string
          responsible?: string | null
          email?: string | null
          phone?: string | null
          address?: Json | null
          stage_id?: string | null
          assigned_to: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          type?: 'pf' | 'pj'
          document?: string
          name?: string
          responsible?: string | null
          email?: string | null
          phone?: string | null
          address?: Json | null
          stage_id?: string | null
          assigned_to?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clients_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clients_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clients_stage_id_fkey'
            columns: ['stage_id']
            isOneToOne: false
            referencedRelation: 'pipeline_stages'
            referencedColumns: ['id']
          },
        ]
      }
      pipeline_stages: {
        Row: {
          id: string
          tenant_id: string
          name: string
          color: string
          position: number
          is_closed: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          color?: string
          position: number
          is_closed?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          color?: string
          position?: number
          is_closed?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pipeline_stages_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      client_interactions: {
        Row: {
          id: string
          tenant_id: string
          client_id: string
          type: 'ligacao' | 'email' | 'reuniao' | 'whatsapp' | 'visita'
          occurred_at: string
          description: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          client_id: string
          type: 'ligacao' | 'email' | 'reuniao' | 'whatsapp' | 'visita'
          occurred_at?: string
          description: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          client_id?: string
          type?: 'ligacao' | 'email' | 'reuniao' | 'whatsapp' | 'visita'
          occurred_at?: string
          description?: string
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_interactions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_interactions_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_interactions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      client_tasks: {
        Row: {
          id: string
          tenant_id: string
          client_id: string
          description: string
          due_date: string
          assigned_to: string
          completed_at: string | null
          deleted_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          client_id: string
          description: string
          due_date: string
          assigned_to: string
          completed_at?: string | null
          deleted_at?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          client_id?: string
          description?: string
          due_date?: string
          assigned_to?: string
          completed_at?: string | null
          deleted_at?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_tasks_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_tasks_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_tasks_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rls_coverage: {
        Args: Record<PropertyKey, never>
        Returns: {
          tablename: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never
