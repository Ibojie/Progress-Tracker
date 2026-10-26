// Hand-written for Phase 1. Regenerate from the live schema with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts
import type { ThemePreference } from './theme/theme';

export type CategoryKey = 'paid_job' | 'business' | 'investment' | 'personal_development';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          timezone: string;
          theme_preference: ThemePreference;
          email_digest_enabled: boolean;
          push_enabled: boolean;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          ai_summary_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      categories: {
        Row: { id: string; user_id: string; key: CategoryKey; name: string; sort_order: number; created_at: string };
        Insert: never;
        Update: { name?: string; sort_order?: number };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      theme_preference: ThemePreference;
    };
    CompositeTypes: Record<string, never>;
  };
}
