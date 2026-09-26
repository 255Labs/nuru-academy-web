/**
 * Hand-written to match supabase/schema.sql exactly. Once you have a real
 * Supabase project, regenerate this file from the live database instead of
 * maintaining it by hand:
 *
 *   npx supabase gen types typescript --project-id <your-project-ref> \
 *     --schema public > src/lib/supabase/types.ts
 *
 * Do that any time you change schema.sql, and keep the two in sync.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          email: string;
          bio: string;
          language: "English" | "Swahili";
          role: "student" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          email: string;
          bio?: string;
          language?: "English" | "Swahili";
          role?: "student" | "admin";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      player_stats: {
        Row: {
          user_id: string;
          display_name: string;
          avatar_key: string;
          xp: number;
          coins: number;
          gems: number;
          level: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name: string;
          avatar_key?: string;
          xp?: number;
          coins?: number;
          gems?: number;
          level?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["player_stats"]["Insert"]>;
      };
      tracks: {
        Row: {
          id: string;
          name: string;
          subtitle: string;
          tagline: string;
          price_tzs: number;
          passing_pct: number;
          tone_hex: string;
          tone_deep_hex: string;
          enrolled_by_default: boolean;
          requires: string | null;
          sort_order: number;
        };
        Insert: Database["public"]["Tables"]["tracks"]["Row"];
        Update: Partial<Database["public"]["Tables"]["tracks"]["Row"]>;
      };
      modules: {
        Row: {
          id: string;
          track_id: string;
          week: number;
          name: string;
          tagline: string;
          sort_order: number;
        };
        Insert: Database["public"]["Tables"]["modules"]["Row"];
        Update: Partial<Database["public"]["Tables"]["modules"]["Row"]>;
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          day: number;
          title: string;
          objective: string;
          block1_topic: string;
          block1_points: string[];
          block2_topic: string;
          block2_points: string[];
          demo: string | null;
          homework: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["lessons"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["lessons"]["Row"]>;
      };
      quizzes: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          subtitle: string;
          minutes: number;
          passing_pct: number;
          is_placeholder: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["quizzes"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["quizzes"]["Row"]>;
      };
      questions: {
        Row: {
          id: string;
          quiz_id: string;
          sort_position: number;
          type: "mcq" | "tf" | "short";
          question_text: string;
          options: string[] | null;
          correct: unknown; // jsonb — number | boolean | string[], never selectable by clients
          explain: string;
        };
        Insert: Omit<Database["public"]["Tables"]["questions"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
      };
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          track_id: string;
          progress: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["enrollments"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrollments"]["Row"]>;
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string;
          score_pct: number;
          passed: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["quiz_attempts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_attempts"]["Row"]>;
      };
      study_log: {
        Row: { user_id: string; study_date: string; minutes: number };
        Insert: Database["public"]["Tables"]["study_log"]["Row"];
        Update: Partial<Database["public"]["Tables"]["study_log"]["Row"]>;
      };
      achievements: {
        Row: {
          id: string;
          label: string;
          description: string;
          icon: string;
          sort_order: number;
        };
        Insert: Database["public"]["Tables"]["achievements"]["Row"];
        Update: Partial<Database["public"]["Tables"]["achievements"]["Row"]>;
      };
      user_achievements: {
        Row: { user_id: string; achievement_id: string; earned_at: string };
        Insert: Omit<Database["public"]["Tables"]["user_achievements"]["Row"], "earned_at"> & {
          earned_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_achievements"]["Row"]>;
      };
      ai_chats: {
        Row: {
          id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ai_chats"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_chats"]["Row"]>;
      };
    };
    Views: {
      quiz_questions_public: {
        Row: {
          id: string;
          quiz_id: string;
          sort_position: number;
          type: "mcq" | "tf" | "short";
          question_text: string;
          options: string[] | null;
        };
      };
    };
    Functions: {
      get_quiz_questions: {
        Args: { p_quiz_id: string };
        Returns: {
          id: string;
          quiz_id: string;
          sort_position: number;
          type: "mcq" | "tf" | "short";
          question_text: string;
          options: string[] | null;
        }[];
      };
      battle_start: {
        Args: { p_quiz_id: string };
        Returns: {
          session_id: string;
          questions: {
            id: string;
            quiz_id: string;
            sort_position: number;
            type: "mcq" | "tf" | "short";
            question_text: string;
            options: string[] | null;
          }[];
        };
      };
      battle_answer: {
        Args: { p_session_id: string; p_question_id: string; p_answer: unknown };
        Returns: {
          ok: boolean;
          already_answered: boolean;
          explain: string;
          correct_answer: unknown;
        };
      };
      battle_finish: {
        Args: { p_session_id: string };
        Returns: { correct: number; total: number; pct: number; passed: boolean };
      };
      submit_quiz_attempt: {
        Args: { p_quiz_id: string; p_answers: unknown };
        Returns: {
          correct: number;
          total: number;
          pct: number;
          passed: boolean;
          reviews: {
            question_id: string;
            sort_position: number;
            ok: boolean;
            correct_answer: unknown;
            explain: string;
          }[];
        };
      };
      complete_lesson: {
        Args: { p_track_id: string; p_minutes?: number };
        Returns: void;
      };
      enroll_in_track: {
        Args: { p_track_id: string };
        Returns: void;
      };
      admin_list_learners: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          display_name: string;
          email: string;
          xp: number;
          level: number;
          coins: number;
          gems: number;
          role: "student" | "admin";
          joined_at: string;
        }[];
      };
      admin_list_enrollments: {
        Args: Record<string, never>;
        Returns: { user_id: string; track_id: string; progress: number }[];
      };
      initiate_track_purchase: {
        Args: { p_track_id: string; p_phone_number: string };
        Returns: { order_reference: string; amount_tzs: number };
      };
    };
  };
}
