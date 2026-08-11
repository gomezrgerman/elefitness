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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bonos_cliente: {
        Row: {
          activo: boolean
          cliente_id: string
          creditos_totales: number
          creditos_usados: number
          fecha_caducidad: string | null
          fecha_compra: string
          id: string
          plan_id: string | null
          tipo: Database["public"]["Enums"]["tipo_bono_enum"]
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          creditos_totales: number
          creditos_usados?: number
          fecha_caducidad?: string | null
          fecha_compra: string
          id?: string
          plan_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bono_enum"]
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          creditos_totales?: number
          creditos_usados?: number
          fecha_caducidad?: string | null
          fecha_compra?: string
          id?: string
          plan_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bono_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "bonos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonos_cliente_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      centro: {
        Row: {
          color_marca: string
          id: string
          logo_url: string | null
          nombre: string
          stripe_account_id: string | null
        }
        Insert: {
          color_marca?: string
          id?: string
          logo_url?: string | null
          nombre: string
          stripe_account_id?: string | null
        }
        Update: {
          color_marca?: string
          id?: string
          logo_url?: string | null
          nombre?: string
          stripe_account_id?: string | null
        }
        Relationships: []
      }
      clases: {
        Row: {
          aforo_max: number
          dia: Database["public"]["Enums"]["dia_semana_enum"]
          entrenador_id: string
          hora_fin: string
          hora_inicio: string
          id: string
          recurrente: boolean
        }
        Insert: {
          aforo_max: number
          dia: Database["public"]["Enums"]["dia_semana_enum"]
          entrenador_id: string
          hora_fin: string
          hora_inicio: string
          id?: string
          recurrente?: boolean
        }
        Update: {
          aforo_max?: number
          dia?: Database["public"]["Enums"]["dia_semana_enum"]
          entrenador_id?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          recurrente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clases_entrenador_id_fkey"
            columns: ["entrenador_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          deuda_creditos: number
          dias_semana_habituales: number
          estado: Database["public"]["Enums"]["estado_cliente_enum"]
          id: string
          notas_rutina: string
          plan_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          deuda_creditos?: number
          dias_semana_habituales?: number
          estado?: Database["public"]["Enums"]["estado_cliente_enum"]
          id?: string
          notas_rutina?: string
          plan_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          deuda_creditos?: number
          dias_semana_habituales?: number
          estado?: Database["public"]["Enums"]["estado_cliente_enum"]
          id?: string
          notas_rutina?: string
          plan_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          cliente_id: string
          estado: Database["public"]["Enums"]["estado_pago_enum"]
          fecha_pago: string
          id: string
          importe: number
          metodo: Database["public"]["Enums"]["metodo_pago_enum"]
          plan_id: string
          proximo_cobro: string | null
          registrado_por: string
          stripe_subscription_id: string | null
          tipo: Database["public"]["Enums"]["tipo_plan_enum"]
          ultimo_cobro: string | null
        }
        Insert: {
          cliente_id: string
          estado?: Database["public"]["Enums"]["estado_pago_enum"]
          fecha_pago: string
          id?: string
          importe: number
          metodo: Database["public"]["Enums"]["metodo_pago_enum"]
          plan_id: string
          proximo_cobro?: string | null
          registrado_por: string
          stripe_subscription_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_plan_enum"]
          ultimo_cobro?: string | null
        }
        Update: {
          cliente_id?: string
          estado?: Database["public"]["Enums"]["estado_pago_enum"]
          fecha_pago?: string
          id?: string
          importe?: number
          metodo?: Database["public"]["Enums"]["metodo_pago_enum"]
          plan_id?: string
          proximo_cobro?: string | null
          registrado_por?: string
          stripe_subscription_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_plan_enum"]
          ultimo_cobro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          clases_incluidas: number | null
          id: string
          nombre: string
          precio: number
          stripe_price_id: string | null
          tipo: Database["public"]["Enums"]["tipo_plan_enum"]
        }
        Insert: {
          clases_incluidas?: number | null
          id?: string
          nombre: string
          precio: number
          stripe_price_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_plan_enum"]
        }
        Update: {
          clases_incluidas?: number | null
          id?: string
          nombre?: string
          precio?: number
          stripe_price_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_plan_enum"]
        }
        Relationships: []
      }
      reservas: {
        Row: {
          asistencia: Database["public"]["Enums"]["estado_asistencia_enum"]
          cancelada_en: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_reserva_enum"]
          id: string
          sesion_id: string
        }
        Insert: {
          asistencia?: Database["public"]["Enums"]["estado_asistencia_enum"]
          cancelada_en?: string | null
          cliente_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_reserva_enum"]
          id?: string
          sesion_id: string
        }
        Update: {
          asistencia?: Database["public"]["Enums"]["estado_asistencia_enum"]
          cancelada_en?: string | null
          cliente_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_reserva_enum"]
          id?: string
          sesion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas_historial: {
        Row: {
          cliente_id: string
          creado_en: string
          evento: string
          id: string
          reserva_id: string
          sesion_id: string
        }
        Insert: {
          cliente_id: string
          creado_en?: string
          evento: string
          id?: string
          reserva_id: string
          sesion_id: string
        }
        Update: {
          cliente_id?: string
          creado_en?: string
          evento?: string
          id?: string
          reserva_id?: string
          sesion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_historial_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      sesiones: {
        Row: {
          aforo_efectivo: number | null
          clase_id: string
          created_at: string
          fecha: string
          id: string
        }
        Insert: {
          aforo_efectivo?: number | null
          clase_id: string
          created_at?: string
          fecha: string
          id?: string
        }
        Update: {
          aforo_efectivo?: number | null
          clase_id?: string
          created_at?: string
          fecha?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clases"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_enum"]
          telefono: string
        }
        Insert: {
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_enum"]
          telefono?: string
        }
        Update: {
          email?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_enum"]
          telefono?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_enum"]
      }
      cancelar_reserva: {
        Args: { p_reserva_id: string }
        Returns: {
          asistencia: Database["public"]["Enums"]["estado_asistencia_enum"]
          cancelada_en: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_reserva_enum"]
          id: string
          sesion_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reservas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      copiar_semana: {
        Args: { p_fecha_destino: string; p_fecha_origen: string }
        Returns: number
      }
      crear_bono: {
        Args: {
          p_cliente_id: string
          p_creditos_totales: number
          p_fecha_compra: string
          p_plan_id: string
          p_tipo?: Database["public"]["Enums"]["tipo_bono_enum"]
        }
        Returns: {
          activo: boolean
          cliente_id: string
          creditos_totales: number
          creditos_usados: number
          fecha_caducidad: string | null
          fecha_compra: string
          id: string
          plan_id: string | null
          tipo: Database["public"]["Enums"]["tipo_bono_enum"]
        }
        SetofOptions: {
          from: "*"
          to: "bonos_cliente"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marcar_asistencia: {
        Args: {
          p_asistencia: Database["public"]["Enums"]["estado_asistencia_enum"]
          p_reserva_id: string
        }
        Returns: {
          asistencia: Database["public"]["Enums"]["estado_asistencia_enum"]
          cancelada_en: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_reserva_enum"]
          id: string
          sesion_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reservas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ocupacion_sesiones: {
        Args: never
        Returns: {
          confirmadas: number
          sesion_id: string
        }[]
      }
      reservar_sesion: {
        Args: { p_cliente_id: string; p_sesion_id: string }
        Returns: {
          asistencia: Database["public"]["Enums"]["estado_asistencia_enum"]
          cancelada_en: string | null
          cliente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_reserva_enum"]
          id: string
          sesion_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reservas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      dia_semana_enum:
        | "lunes"
        | "martes"
        | "miercoles"
        | "jueves"
        | "viernes"
        | "sabado"
        | "domingo"
      estado_asistencia_enum: "pendiente" | "asistio" | "no_asistio"
      estado_cliente_enum: "activo" | "baja"
      estado_pago_enum: "al_dia" | "moroso" | "pendiente"
      estado_reserva_enum: "confirmada" | "lista_espera" | "cancelada"
      metodo_pago_enum: "stripe" | "efectivo" | "transferencia"
      rol_enum: "admin" | "entrenador" | "cliente"
      tipo_bono_enum: "normal" | "recuperacion"
      tipo_plan_enum: "mensual" | "bono"
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
      dia_semana_enum: [
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
        "domingo",
      ],
      estado_asistencia_enum: ["pendiente", "asistio", "no_asistio"],
      estado_cliente_enum: ["activo", "baja"],
      estado_pago_enum: ["al_dia", "moroso", "pendiente"],
      estado_reserva_enum: ["confirmada", "lista_espera", "cancelada"],
      metodo_pago_enum: ["stripe", "efectivo", "transferencia"],
      rol_enum: ["admin", "entrenador", "cliente"],
      tipo_bono_enum: ["normal", "recuperacion"],
      tipo_plan_enum: ["mensual", "bono"],
    },
  },
} as const
