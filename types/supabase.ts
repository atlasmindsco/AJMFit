export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string | null
          stripe_customer_id: string | null
          name: string
          email: string
          phone: string | null
          status: 'pending' | 'active' | 'paused' | 'cancelled'
          daily_cal_target: number
          protein_target: number
          carb_target: number
          fat_target: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_id?: string | null
          stripe_customer_id?: string | null
          name: string
          email: string
          phone?: string | null
          status?: 'pending' | 'active' | 'paused' | 'cancelled'
          daily_cal_target?: number
          protein_target?: number
          carb_target?: number
          fat_target?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_id?: string | null
          stripe_customer_id?: string | null
          name?: string
          email?: string
          phone?: string | null
          status?: 'pending' | 'active' | 'paused' | 'cancelled'
          daily_cal_target?: number
          protein_target?: number
          carb_target?: number
          fat_target?: number
          updated_at?: string
        }
      }
      meals: {
        Row: {
          id: string
          user_id: string
          name: string
          scheduled_time: string | null
          meal_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          scheduled_time?: string | null
          meal_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          scheduled_time?: string | null
          meal_order?: number
        }
      }
      food_logs: {
        Row: {
          id: string
          user_id: string
          meal_id: string | null
          date: string
          food_name: string
          calories: number
          protein: number
          carbs: number
          fats: number
          serving_size: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          meal_id?: string | null
          date?: string
          food_name: string
          calories?: number
          protein?: number
          carbs?: number
          fats?: number
          serving_size?: string | null
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          meal_id?: string | null
          date?: string
          food_name?: string
          calories?: number
          protein?: number
          carbs?: number
          fats?: number
          serving_size?: string | null
          source?: string | null
        }
      }
      daily_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          water_oz: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          water_oz?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          water_oz?: number
          notes?: string | null
        }
      }
      applications: {
        Row: {
          id: string
          user_id: string
          goals: string
          equipment: string[]
          health_limitations: string | null
          availability: string
          tier: 'blueprint' | 'accelerator' | 'full-experience'
          billing_cycle: 'monthly' | 'weekly'
          referral: string | null
          status: 'pending' | 'reviewing' | 'accepted' | 'declined'
          reviewed_at: string | null
          reviewed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goals: string
          equipment: string[]
          health_limitations?: string | null
          availability: string
          tier: 'blueprint' | 'accelerator' | 'full-experience'
          billing_cycle: 'monthly' | 'weekly'
          referral?: string | null
          status?: 'pending' | 'reviewing' | 'accepted' | 'declined'
          reviewed_at?: string | null
          reviewed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'reviewing' | 'accepted' | 'declined'
          reviewed_at?: string | null
          reviewed_by?: string | null
          notes?: string | null
        }
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          date: string
          day_name: string
          program_name: string | null
          program_phase: string | null
          started_at: string
          ended_at: string | null
          duration_seconds: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          day_name: string
          program_name?: string | null
          program_phase?: string | null
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          ended_at?: string | null
          duration_seconds?: number | null
          notes?: string | null
        }
      }
      workout_sets: {
        Row: {
          id: string
          workout_id: string
          user_id: string
          exercise_name: string
          original_exercise_name: string | null
          set_number: number
          weight: number | null
          reps: number | null
          is_intensity_set: boolean
          intensity_technique: 'dropset' | 'restpause' | 'partial' | null
          completed: boolean
          logged_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          user_id: string
          exercise_name: string
          original_exercise_name?: string | null
          set_number: number
          weight?: number | null
          reps?: number | null
          is_intensity_set?: boolean
          intensity_technique?: 'dropset' | 'restpause' | 'partial' | null
          completed?: boolean
          logged_at?: string
        }
        Update: {
          weight?: number | null
          reps?: number | null
          completed?: boolean
          intensity_technique?: 'dropset' | 'restpause' | 'partial' | null
        }
      }
      exercise_prs: {
        Row: {
          id: string
          user_id: string
          exercise_name: string
          weight: number
          reps: number
          previous_weight: number | null
          set_at: string
          workout_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          exercise_name: string
          weight: number
          reps: number
          previous_weight?: number | null
          set_at?: string
          workout_id?: string | null
        }
        Update: {
          weight?: number
          reps?: number
          previous_weight?: number | null
          set_at?: string
          workout_id?: string | null
        }
      }
      exercise_swaps: {
        Row: {
          id: string
          user_id: string
          original_exercise_name: string
          swapped_exercise_name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          original_exercise_name: string
          swapped_exercise_name: string
          created_at?: string
        }
        Update: {
          swapped_exercise_name?: string
        }
      }
    }
  }
}
