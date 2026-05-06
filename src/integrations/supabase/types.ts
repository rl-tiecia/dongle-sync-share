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
      delivery_agents: {
        Row: {
          agent_token: string
          created_at: string
          enabled: boolean
          id: string
          last_seen_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_token: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_token?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_backups: {
        Row: {
          backup_type: string | null
          content_type: string | null
          created_at: string
          delivered_at: string | null
          delivered_path: string | null
          delivery_attempts: number
          delivery_error: string | null
          delivery_error_code: string | null
          delivery_last_attempt_at: string | null
          delivery_next_attempt_at: string | null
          delivery_status: string
          destination: string | null
          device_id: string
          duration_ms: number | null
          error_message: string | null
          file_size_mb: number | null
          filename: string
          id: string
          integrity_verified: boolean
          md5_hash: string | null
          network_destination_id: string | null
          progress: number
          status: string
          storage_path: string | null
          upload_completed_at: string | null
          upload_started_at: string | null
        }
        Insert: {
          backup_type?: string | null
          content_type?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_path?: string | null
          delivery_attempts?: number
          delivery_error?: string | null
          delivery_error_code?: string | null
          delivery_last_attempt_at?: string | null
          delivery_next_attempt_at?: string | null
          delivery_status?: string
          destination?: string | null
          device_id: string
          duration_ms?: number | null
          error_message?: string | null
          file_size_mb?: number | null
          filename: string
          id?: string
          integrity_verified?: boolean
          md5_hash?: string | null
          network_destination_id?: string | null
          progress?: number
          status?: string
          storage_path?: string | null
          upload_completed_at?: string | null
          upload_started_at?: string | null
        }
        Update: {
          backup_type?: string | null
          content_type?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_path?: string | null
          delivery_attempts?: number
          delivery_error?: string | null
          delivery_error_code?: string | null
          delivery_last_attempt_at?: string | null
          delivery_next_attempt_at?: string | null
          delivery_status?: string
          destination?: string | null
          device_id?: string
          duration_ms?: number | null
          error_message?: string | null
          file_size_mb?: number | null
          filename?: string
          id?: string
          integrity_verified?: boolean
          md5_hash?: string | null
          network_destination_id?: string | null
          progress?: number
          status?: string
          storage_path?: string | null
          upload_completed_at?: string | null
          upload_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_backups_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_logs: {
        Row: {
          created_at: string
          device_id: string
          id: string
          log_level: string
          message: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          log_level?: string
          message: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          log_level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_permissions: {
        Row: {
          device_id: string
          granted_at: string
          granted_by: string
          id: string
          permission_level: string
          user_id: string
        }
        Insert: {
          device_id: string
          granted_at?: string
          granted_by: string
          id?: string
          permission_level?: string
          user_id: string
        }
        Update: {
          device_id?: string
          granted_at?: string
          granted_by?: string
          id?: string
          permission_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_permissions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_secrets: {
        Row: {
          claim_code: string | null
          created_at: string
          device_id: string
          device_token: string | null
          token_retrieved_at: string | null
          updated_at: string
        }
        Insert: {
          claim_code?: string | null
          created_at?: string
          device_id: string
          device_token?: string | null
          token_retrieved_at?: string | null
          updated_at?: string
        }
        Update: {
          claim_code?: string | null
          created_at?: string
          device_id?: string
          device_token?: string | null
          token_retrieved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_secrets_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_status: {
        Row: {
          created_at: string
          device_id: string
          display_active: boolean
          id: string
          storage_used_mb: number
          total_backups: number
          transfer_active: boolean
          usb_host_active: boolean
          wifi_connected: boolean
        }
        Insert: {
          created_at?: string
          device_id: string
          display_active?: boolean
          id?: string
          storage_used_mb?: number
          total_backups?: number
          transfer_active?: boolean
          usb_host_active?: boolean
          wifi_connected?: boolean
        }
        Update: {
          created_at?: string
          device_id?: string
          display_active?: boolean
          id?: string
          storage_used_mb?: number
          total_backups?: number
          transfer_active?: boolean
          usb_host_active?: boolean
          wifi_connected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "device_status_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          claimed_at: string | null
          created_at: string
          device_id: string
          device_name: string
          firmware_version: string | null
          id: string
          is_claimed: boolean
          is_online: boolean
          last_seen_at: string | null
          mac_address: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          device_id: string
          device_name: string
          firmware_version?: string | null
          id?: string
          is_claimed?: boolean
          is_online?: boolean
          last_seen_at?: string | null
          mac_address?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          device_id?: string
          device_name?: string
          firmware_version?: string | null
          id?: string
          is_claimed?: boolean
          is_online?: boolean
          last_seen_at?: string | null
          mac_address?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      network_destinations: {
        Row: {
          created_at: string
          device_id: string | null
          domain: string | null
          enabled: boolean
          host: string
          id: string
          is_default: boolean
          name: string
          password: string | null
          port: number | null
          protocol: string
          remote_path: string
          share: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          domain?: string | null
          enabled?: boolean
          host: string
          id?: string
          is_default?: boolean
          name: string
          password?: string | null
          port?: number | null
          protocol: string
          remote_path?: string
          share: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          domain?: string | null
          enabled?: boolean
          host?: string
          id?: string
          is_default?: boolean
          name?: string
          password?: string | null
          port?: number | null
          protocol?: string
          remote_path?: string
          share?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_destinations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_device: {
        Args: { _device_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_device: {
        Args: { _device_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
