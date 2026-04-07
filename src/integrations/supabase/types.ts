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
      leads: {
        Row: {
          activecampaign_id: string | null
          company: string | null
          confection_type: string | null
          created_at: string
          email: string | null
          entry_date: string | null
          history: Json | null
          id: string
          implementation_value: number | null
          is_new: boolean | null
          last_contact: string | null
          lead_source: string
          loss_reason: string | null
          manager_notes: string | null
          meeting_date: string | null
          meeting_link: string | null
          meeting_needs: string | null
          meeting_pain: string | null
          meeting_status: string | null
          monthly_value: number | null
          name: string
          next_contact: string | null
          pieces_per_month: number | null
          reference_month: string | null
          responsible_user_id: string | null
          stage: string
          temperature: string
          updated_at: string
          user_id: string
          value: number | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          activecampaign_id?: string | null
          company?: string | null
          confection_type?: string | null
          created_at?: string
          email?: string | null
          entry_date?: string | null
          history?: Json | null
          id?: string
          implementation_value?: number | null
          is_new?: boolean | null
          last_contact?: string | null
          lead_source?: string
          loss_reason?: string | null
          manager_notes?: string | null
          meeting_date?: string | null
          meeting_link?: string | null
          meeting_needs?: string | null
          meeting_pain?: string | null
          meeting_status?: string | null
          monthly_value?: number | null
          name: string
          next_contact?: string | null
          pieces_per_month?: number | null
          reference_month?: string | null
          responsible_user_id?: string | null
          stage?: string
          temperature?: string
          updated_at?: string
          user_id: string
          value?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          activecampaign_id?: string | null
          company?: string | null
          confection_type?: string | null
          created_at?: string
          email?: string | null
          entry_date?: string | null
          history?: Json | null
          id?: string
          implementation_value?: number | null
          is_new?: boolean | null
          last_contact?: string | null
          lead_source?: string
          loss_reason?: string | null
          manager_notes?: string | null
          meeting_date?: string | null
          meeting_link?: string | null
          meeting_needs?: string | null
          meeting_pain?: string | null
          meeting_status?: string | null
          monthly_value?: number | null
          name?: string
          next_contact?: string | null
          pieces_per_month?: number | null
          reference_month?: string | null
          responsible_user_id?: string | null
          stage?: string
          temperature?: string
          updated_at?: string
          user_id?: string
          value?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      manager_sdr_relations: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          sdr_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          sdr_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          sdr_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          avatar: string | null
          created_at: string
          id: string
          name: string
          role: string
          signature: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          avatar?: string | null
          created_at?: string
          id?: string
          name?: string
          role?: string
          signature?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          avatar?: string | null
          created_at?: string
          id?: string
          name?: string
          role?: string
          signature?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          additional_notes: string | null
          company_name: string | null
          created_at: string
          discount: string | null
          id: string
          lead_id: string
          payment_terms: string | null
          plans: Json
          responsible_name: string | null
          responsible_role: string | null
          sent_via_whatsapp: boolean | null
          total_implementation: number | null
          total_monthly: number | null
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          company_name?: string | null
          created_at?: string
          discount?: string | null
          id?: string
          lead_id: string
          payment_terms?: string | null
          plans?: Json
          responsible_name?: string | null
          responsible_role?: string | null
          sent_via_whatsapp?: boolean | null
          total_implementation?: number | null
          total_monthly?: number | null
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          company_name?: string | null
          created_at?: string
          discount?: string | null
          id?: string
          lead_id?: string
          payment_terms?: string | null
          plans?: Json
          responsible_name?: string | null
          responsible_role?: string | null
          sent_via_whatsapp?: boolean | null
          total_implementation?: number | null
          total_monthly?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          meeting_goal: number | null
          msg_template: string | null
          sales_goal: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_goal?: number | null
          msg_template?: string | null
          sales_goal?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_goal?: number | null
          msg_template?: string | null
          sales_goal?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_lead_user_id: { Args: { _lead_id: string }; Returns: string }
      get_managed_sdr_ids: { Args: { _manager_id: string }; Returns: string[] }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
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
