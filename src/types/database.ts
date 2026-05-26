export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          nickname: string
          email: string
          role: 'admin' | 'editor' | 'viewer'
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
          role?: 'admin' | 'editor' | 'viewer'
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
          role?: 'admin' | 'editor' | 'viewer'
          permissions?: string[]
          status?: 'active' | 'suspended'
          avatar?: string | null
          create_time?: string
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
