export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type TaskStatusDb =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'awaiting_completion'
  | 'completed'
  | 'disputed'
  | 'closed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          nickname: string
          email: string
          phone: string | null
          certification_status: 'none' | 'pending' | 'approved' | 'rejected'
          real_name: string | null
          id_card: string | null
          law_firm: string | null
          license_number: string | null
          license_image_url: string | null
          practice_area: string | null
          role: 'admin' | 'publisher' | 'lawyer'
          permissions: string[]
          status: 'active' | 'suspended'
          avatar: string | null
          create_time: string
        }
        Insert: {
          id: string
          username: string
          nickname: string
          email: string
          phone?: string | null
          certification_status?: 'none' | 'pending' | 'approved' | 'rejected'
          real_name?: string | null
          id_card?: string | null
          law_firm?: string | null
          license_number?: string | null
          license_image_url?: string | null
          practice_area?: string | null
          role?: 'admin' | 'publisher' | 'lawyer'
          permissions?: string[]
          status?: 'active' | 'suspended'
          avatar?: string | null
          create_time?: string
        }
        Update: {
          id?: string
          username?: string
          nickname?: string
          email?: string
          phone?: string | null
          certification_status?: 'none' | 'pending' | 'approved' | 'rejected'
          real_name?: string | null
          id_card?: string | null
          law_firm?: string | null
          license_number?: string | null
          license_image_url?: string | null
          practice_area?: string | null
          role?: 'admin' | 'publisher' | 'lawyer'
          permissions?: string[]
          status?: 'active' | 'suspended'
          avatar?: string | null
          create_time?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          publisher_id: string
          title: string
          task_type: string
          region: string
          description: string
          budget: number | null
          deadline: string | null
          attachment_urls: string[]
          status: TaskStatusDb
          assigned_lawyer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          publisher_id: string
          title: string
          task_type: string
          region: string
          description?: string
          budget?: number | null
          deadline?: string | null
          attachment_urls?: string[]
          status?: TaskStatusDb
          assigned_lawyer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          publisher_id?: string
          title?: string
          task_type?: string
          region?: string
          description?: string
          budget?: number | null
          deadline?: string | null
          attachment_urls?: string[]
          status?: TaskStatusDb
          assigned_lawyer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_applications: {
        Row: {
          id: string
          task_id: string
          lawyer_id: string
          proposal: string
          quote: number | null
          status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          lawyer_id: string
          proposal?: string
          quote?: number | null
          status?: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          lawyer_id?: string
          proposal?: string
          quote?: number | null
          status?: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          id: string
          name: string
          color: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      task_regions: {
        Row: {
          id: string
          name: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      task_submissions: {
        Row: {
          id: string
          task_id: string
          lawyer_id: string
          title: string
          content: string
          attachment_urls: string[]
          submission_type: 'progress' | 'completion'
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          lawyer_id: string
          title?: string
          content?: string
          attachment_urls?: string[]
          submission_type?: 'progress' | 'completion'
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          lawyer_id?: string
          title?: string
          content?: string
          attachment_urls?: string[]
          submission_type?: 'progress' | 'completion'
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_username_available: {
        Args: { check_username: string }
        Returns: boolean
      }
      get_login_email_by_username: {
        Args: { check_username: string }
        Returns: string
      }
      get_login_email_by_account: {
        Args: { account: string }
        Returns: string
      }
      is_phone_available: {
        Args: { check_phone: string }
        Returns: boolean
      }
      admin_delete_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
