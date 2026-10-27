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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_summaries: {
        Row: {
          content_md: string
          created_at: string
          id: string
          model: string
          period_end: string
          period_start: string
          user_id: string
        }
        Insert: {
          content_md: string
          created_at?: string
          id?: string
          model: string
          period_end: string
          period_start: string
          user_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          id?: string
          model?: string
          period_end?: string
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          key: Database["public"]["Enums"]["category_key"]
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: Database["public"]["Enums"]["category_key"]
          name: string
          sort_order?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: Database["public"]["Enums"]["category_key"]
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_snapshots: {
        Row: {
          abandoned_count: number
          category_id: string
          due_soon_count: number
          element_id: string
          goals_done: number
          goals_total: number
          overdue_count: number
          pct_complete: number
          snapshot_date: string
          status: Database["public"]["Enums"]["element_status"]
          user_id: string
        }
        Insert: {
          abandoned_count?: number
          category_id: string
          due_soon_count?: number
          element_id: string
          goals_done: number
          goals_total: number
          overdue_count?: number
          pct_complete: number
          snapshot_date: string
          status: Database["public"]["Enums"]["element_status"]
          user_id: string
        }
        Update: {
          abandoned_count?: number
          category_id?: string
          due_soon_count?: number
          element_id?: string
          goals_done?: number
          goals_total?: number
          overdue_count?: number
          pct_complete?: number
          snapshot_date?: string
          status?: Database["public"]["Enums"]["element_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_snapshots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_snapshots_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
        ]
      }
      elements: {
        Row: {
          category_id: string
          created_at: string
          decommissioned_at: string | null
          description: string | null
          id: string
          is_decommissioned: boolean
          name: string
          recommissioned_at: string | null
          restarted_at: string | null
          sort_order: number
          updated_at: string
          user_id: string
          zero_progress_status: Database["public"]["Enums"]["zero_progress_status"]
        }
        Insert: {
          category_id: string
          created_at?: string
          decommissioned_at?: string | null
          description?: string | null
          id?: string
          is_decommissioned?: boolean
          name: string
          recommissioned_at?: string | null
          restarted_at?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
          zero_progress_status?: Database["public"]["Enums"]["zero_progress_status"]
        }
        Update: {
          category_id?: string
          created_at?: string
          decommissioned_at?: string | null
          description?: string | null
          id?: string
          is_decommissioned?: boolean
          name?: string
          recommissioned_at?: string | null
          restarted_at?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
          zero_progress_status?: Database["public"]["Enums"]["zero_progress_status"]
        }
        Relationships: [
          {
            foreignKeyName: "elements_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goal_date_resets: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          new_due_date: string
          old_due_date: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          new_due_date: string
          old_due_date: string
          reason?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          new_due_date?: string
          old_due_date?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_date_resets_goal_owner_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          done_at: string | null
          due_date: string
          element_id: string
          id: string
          is_done: boolean
          notes: string | null
          original_due_date: string
          reset_count: number
          sort_order: number
          start_date: string
          tick_changed_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          due_date: string
          element_id: string
          id?: string
          is_done?: boolean
          notes?: string | null
          original_due_date: string
          reset_count?: number
          sort_order?: number
          start_date: string
          tick_changed_at?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          due_date?: string
          element_id?: string
          id?: string
          is_done?: boolean
          notes?: string | null
          original_due_date?: string
          reset_count?: number
          sort_order?: number
          start_date?: string
          tick_changed_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_element_id_user_id_fkey"
            columns: ["element_id", "user_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notification_log: {
        Row: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          claimed_at: string | null
          delivered_at: string | null
          element_id: string | null
          goal_id: string | null
          id: string
          kind: string
          last_error: string | null
          link: string | null
          read_at: string | null
          sent_at: string
          sent_on: string
          title: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          claimed_at?: string | null
          delivered_at?: string | null
          element_id?: string | null
          goal_id?: string | null
          id?: string
          kind: string
          last_error?: string | null
          link?: string | null
          read_at?: string | null
          sent_at?: string
          sent_on?: string
          title?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          claimed_at?: string | null
          delivered_at?: string | null
          element_id?: string | null
          goal_id?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          link?: string | null
          read_at?: string | null
          sent_at?: string
          sent_on?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_summary_enabled: boolean
          created_at: string
          display_name: string | null
          email_digest_enabled: boolean
          id: string
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          theme_preference: Database["public"]["Enums"]["theme_preference"]
          timezone: string
          updated_at: string
        }
        Insert: {
          ai_summary_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email_digest_enabled?: boolean
          id: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          theme_preference?: Database["public"]["Enums"]["theme_preference"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          ai_summary_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email_digest_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          theme_preference?: Database["public"]["Enums"]["theme_preference"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          keys: Json
          user_id?: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      status_events: {
        Row: {
          created_at: string
          element_id: string
          from_status: Database["public"]["Enums"]["element_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["element_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          element_id: string
          from_status?: Database["public"]["Enums"]["element_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["element_status"]
          user_id?: string
        }
        Update: {
          created_at?: string
          element_id?: string
          from_status?: Database["public"]["Enums"]["element_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["element_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_events_element_id_user_id_fkey"
            columns: ["element_id", "user_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_element_has_goals: { Args: { target: string }; Returns: undefined }
      claim_deliveries: {
        Args: { p_limit?: number }
        Returns: Database["public"]["Tables"]["notification_log"]["Row"][]
      }
      create_element_with_goals: {
        Args: {
          p_category_id: string
          p_description: string
          p_goals: Json
          p_name: string
        }
        Returns: string
      }
      engine_element_status: {
        Args: { p_element_id: string; p_today: string }
        Returns: {
          abandoned: number
          due_soon: number
          goals_done: number
          goals_total: number
          overdue: number
          pct: number
          status: Database["public"]["Enums"]["element_status"]
        }[]
      }
      finish_delivery: {
        Args: { p_error?: string; p_id: string; p_ok: boolean }
        Returns: undefined
      }
      is_push_endpoint: { Args: { p_endpoint: string }; Returns: boolean }
      notify_in_quiet: {
        Args: { p_local: string; p_quiet_end: string; p_quiet_start: string }
        Returns: boolean
      }
      notify_send_hour: {
        Args: { p_quiet_end: string; p_quiet_start: string }
        Returns: number
      }
      notify_token_ok: { Args: { p_token: string }; Returns: boolean }
      queue_notifications: {
        Args: { p_now?: string; p_send_hour_only?: boolean }
        Returns: number
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_label: string
          p_p256dh: string
        }
        Returns: undefined
      }
      reset_goal_date: {
        Args: {
          p_goal_id: string
          p_mark_restarted: boolean
          p_new_due_date: string
          p_reason: string
        }
        Returns: undefined
      }
      snapshot_totals: {
        Args: { p_from: string }
        Returns: {
          abandoned: number
          category_id: string
          due_soon: number
          goals_done: number
          goals_total: number
          overdue: number
          snapshot_date: string
        }[]
      }
      swap_goal_order: {
        Args: { p_goal_a: string; p_goal_b: string }
        Returns: undefined
      }
      take_daily_snapshots: {
        Args: { p_end_of_day_only?: boolean; p_now?: string }
        Returns: number
      }
      tick_goal: {
        Args: { p_goal_id: string; p_is_done: boolean; p_ticked_at: string }
        Returns: undefined
      }
      weekly_digest_data: {
        Args: { p_today: string; p_user: string }
        Returns: Json
      }
    }
    Enums: {
      category_key:
        | "paid_job"
        | "business"
        | "investment"
        | "personal_development"
      element_status:
        | "not_started"
        | "started"
        | "resource_delay"
        | "in_progress"
        | "completed"
        | "abandoned"
        | "restarted"
        | "decommissioned"
        | "recommissioned"
      notification_channel: "push" | "email" | "in_app"
      theme_preference: "light" | "dark" | "system"
      zero_progress_status: "not_started" | "started" | "resource_delay"
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
      category_key: [
        "paid_job",
        "business",
        "investment",
        "personal_development",
      ],
      element_status: [
        "not_started",
        "started",
        "resource_delay",
        "in_progress",
        "completed",
        "abandoned",
        "restarted",
        "decommissioned",
        "recommissioned",
      ],
      notification_channel: ["push", "email", "in_app"],
      theme_preference: ["light", "dark", "system"],
      zero_progress_status: ["not_started", "started", "resource_delay"],
    },
  },
} as const
