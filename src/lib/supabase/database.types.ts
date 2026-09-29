// npm run db:types 로 생성한다. 직접 고치지 않는다.
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: number
          target_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: never
          target_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: never
          target_id?: string | null
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      body_profiles: {
        Row: {
          chest_cm: number | null
          consent_version: string
          consented_at: string
          created_at: string
          fit_overrides: Json
          height_cm: number | null
          hip_cm: number | null
          shoulder_cm: number | null
          thigh_cm: number | null
          uncertain: string[]
          updated_at: string
          user_id: string
          waist_cm: number | null
        }
        Insert: {
          chest_cm?: number | null
          consent_version: string
          consented_at?: string
          created_at?: string
          fit_overrides?: Json
          height_cm?: number | null
          hip_cm?: number | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          uncertain?: string[]
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
        }
        Update: {
          chest_cm?: number | null
          consent_version?: string
          consented_at?: string
          created_at?: string
          fit_overrides?: Json
          height_cm?: number | null
          hip_cm?: number | null
          shoulder_cm?: number | null
          thigh_cm?: number | null
          uncertain?: string[]
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          measurement_group: string
          name_ko: string
          sort_order: number
        }
        Insert: {
          id: string
          measurement_group: string
          name_ko: string
          sort_order: number
        }
        Update: {
          id?: string
          measurement_group?: string
          name_ko?: string
          sort_order?: number
        }
        Relationships: []
      }
      fit_check_comparables: {
        Row: {
          fit_check_id: string
          garment_id: string
          included: boolean
          match_level: string
          user_id: string
        }
        Insert: {
          fit_check_id: string
          garment_id: string
          included?: boolean
          match_level: string
          user_id?: string
        }
        Update: {
          fit_check_id?: string
          garment_id?: string
          included?: boolean
          match_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fit_check_comparables_fit_check_id_fkey"
            columns: ["fit_check_id"]
            isOneToOne: false
            referencedRelation: "fit_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fit_check_comparables_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      fit_checks: {
        Row: {
          ai_model: string | null
          candidate: Json
          completed_at: string | null
          computed: Json | null
          confidence: string | null
          created_at: string
          error_code: string | null
          id: string
          import_id: string | null
          interpretation: Json | null
          status: Database["public"]["Enums"]["fit_check_status"]
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          candidate: Json
          completed_at?: string | null
          computed?: Json | null
          confidence?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          import_id?: string | null
          interpretation?: Json | null
          status?: Database["public"]["Enums"]["fit_check_status"]
          user_id?: string
        }
        Update: {
          ai_model?: string | null
          candidate?: Json
          completed_at?: string | null
          computed?: Json | null
          confidence?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          import_id?: string | null
          interpretation?: Json | null
          status?: Database["public"]["Enums"]["fit_check_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fit_checks_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "product_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      garment_review_signals: {
        Row: {
          created_at: string
          dimension: string
          direction: string
          evidence_text: string
          extractor: string
          garment_id: string
          id: string
          review_hash: string
          strength: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dimension: string
          direction: string
          evidence_text: string
          extractor: string
          garment_id: string
          id?: string
          review_hash: string
          strength?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          dimension?: string
          direction?: string
          evidence_text?: string
          extractor?: string
          garment_id?: string
          id?: string
          review_hash?: string
          strength?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garment_review_signals_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      garments: {
        Row: {
          brand: string | null
          category_id: string
          color_name: string | null
          color_source: Database["public"]["Enums"]["color_source"] | null
          created_at: string
          currency: string
          deleted_at: string | null
          fit_review: string | null
          id: string
          image_path: string | null
          m_brim: number | null
          m_chest: number | null
          m_depth: number | null
          m_head: number | null
          m_hip: number | null
          m_leg_opening: number | null
          m_length: number | null
          m_rise: number | null
          m_shoulder: number | null
          m_sleeve: number | null
          m_thigh: number | null
          m_waist: number | null
          material: string | null
          product_name: string
          product_url: string | null
          purchase_price: number | null
          purchased_on: string | null
          seasons: Database["public"]["Enums"]["season"][]
          shoe_fit_instep: string | null
          shoe_fit_length: string | null
          shoe_fit_width: string | null
          size_label: string | null
          source_import_id: string | null
          subcategory_id: string | null
          thumb_path: string | null
          updated_at: string
          user_fit: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          category_id: string
          color_name?: string | null
          color_source?: Database["public"]["Enums"]["color_source"] | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          fit_review?: string | null
          id?: string
          image_path?: string | null
          m_brim?: number | null
          m_chest?: number | null
          m_depth?: number | null
          m_head?: number | null
          m_hip?: number | null
          m_leg_opening?: number | null
          m_length?: number | null
          m_rise?: number | null
          m_shoulder?: number | null
          m_sleeve?: number | null
          m_thigh?: number | null
          m_waist?: number | null
          material?: string | null
          product_name: string
          product_url?: string | null
          purchase_price?: number | null
          purchased_on?: string | null
          seasons?: Database["public"]["Enums"]["season"][]
          shoe_fit_instep?: string | null
          shoe_fit_length?: string | null
          shoe_fit_width?: string | null
          size_label?: string | null
          source_import_id?: string | null
          subcategory_id?: string | null
          thumb_path?: string | null
          updated_at?: string
          user_fit?: string | null
          user_id?: string
        }
        Update: {
          brand?: string | null
          category_id?: string
          color_name?: string | null
          color_source?: Database["public"]["Enums"]["color_source"] | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          fit_review?: string | null
          id?: string
          image_path?: string | null
          m_brim?: number | null
          m_chest?: number | null
          m_depth?: number | null
          m_head?: number | null
          m_hip?: number | null
          m_leg_opening?: number | null
          m_length?: number | null
          m_rise?: number | null
          m_shoulder?: number | null
          m_sleeve?: number | null
          m_thigh?: number | null
          m_waist?: number | null
          material?: string | null
          product_name?: string
          product_url?: string | null
          purchase_price?: number | null
          purchased_on?: string | null
          seasons?: Database["public"]["Enums"]["season"][]
          shoe_fit_instep?: string | null
          shoe_fit_length?: string | null
          shoe_fit_width?: string | null
          size_label?: string | null
          source_import_id?: string | null
          subcategory_id?: string | null
          thumb_path?: string | null
          updated_at?: string
          user_fit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garments_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "product_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garments_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_imports: {
        Row: {
          created_at: string
          domain: string
          duration_ms: number | null
          error_code: string | null
          id: string
          normalized_url: string
          parser_id: string | null
          parser_version: string | null
          purpose: string
          result: Json | null
          source_url: string
          status: Database["public"]["Enums"]["import_status"]
          user_id: string
          warnings: Json
        }
        Insert: {
          created_at?: string
          domain: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          normalized_url: string
          parser_id?: string | null
          parser_version?: string | null
          purpose: string
          result?: Json | null
          source_url: string
          status?: Database["public"]["Enums"]["import_status"]
          user_id?: string
          warnings?: Json
        }
        Update: {
          created_at?: string
          domain?: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          normalized_url?: string
          parser_id?: string | null
          parser_version?: string | null
          purpose?: string
          result?: Json | null
          source_url?: string
          status?: Database["public"]["Enums"]["import_status"]
          user_id?: string
          warnings?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      release_note_edits: {
        Row: {
          body: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          body: string
          updated_at?: string
          updated_by?: string | null
          version: string
        }
        Update: {
          body?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          id: string
          name_ko: string
          similar_to: string[]
          sort_order: number
        }
        Insert: {
          category_id: string
          id: string
          name_ko: string
          similar_to?: string[]
          sort_order: number
        }
        Update: {
          category_id?: string
          id?: string
          name_ko?: string
          similar_to?: string[]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      testers: {
        Row: {
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_import_failures: {
        Args: never
        Returns: {
          domain: string
          error_code: string
          failures: number
          last_at: string
        }[]
      }
      admin_stats: { Args: never; Returns: Json }
      admin_user_counts: {
        Args: { p_user_ids: string[] }
        Returns: {
          fit_checks: number
          garments: number
          imports: number
          user_id: string
        }[]
      }
    }
    Enums: {
      color_source:
        | "selected_option"
        | "page_option"
        | "product_name"
        | "detail_field"
        | "manual"
      fit_check_status: "computing" | "interpreting" | "completed" | "failed"
      import_status: "pending" | "succeeded" | "partial" | "failed"
      season: "spring" | "summer" | "fall" | "winter" | "all"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      color_source: [
        "selected_option",
        "page_option",
        "product_name",
        "detail_field",
        "manual",
      ],
      fit_check_status: ["computing", "interpreting", "completed", "failed"],
      import_status: ["pending", "succeeded", "partial", "failed"],
      season: ["spring", "summer", "fall", "winter", "all"],
    },
  },
} as const
