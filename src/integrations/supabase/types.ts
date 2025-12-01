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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      approval_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          measurement_id: string | null
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          measurement_id?: string | null
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          measurement_id?: string | null
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_tokens_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "match_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      astm_e308_sum_totals: {
        Row: {
          created_at: string
          id: string
          illuminant_name: string
          observer: string
          rows: number
          sum_x: number
          sum_y: number
          sum_z: number
          table_number: number
          white_point_x: number | null
          white_point_y: number | null
          white_point_z: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          illuminant_name: string
          observer: string
          rows: number
          sum_x: number
          sum_y: number
          sum_z: number
          table_number: number
          white_point_x?: number | null
          white_point_y?: number | null
          white_point_z?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          illuminant_name?: string
          observer?: string
          rows?: number
          sum_x?: number
          sum_y?: number
          sum_z?: number
          table_number?: number
          white_point_x?: number | null
          white_point_y?: number | null
          white_point_z?: number | null
        }
        Relationships: []
      }
      astm_e308_tables: {
        Row: {
          created_at: string
          id: string
          illuminant_name: string
          observer: string
          table_number: number
          wavelength: number
          white_point_x: number | null
          white_point_y: number | null
          white_point_z: number | null
          x_factor: number
          y_factor: number
          z_factor: number
        }
        Insert: {
          created_at?: string
          id?: string
          illuminant_name: string
          observer: string
          table_number: number
          wavelength: number
          white_point_x?: number | null
          white_point_y?: number | null
          white_point_z?: number | null
          x_factor: number
          y_factor: number
          z_factor: number
        }
        Update: {
          created_at?: string
          id?: string
          illuminant_name?: string
          observer?: string
          table_number?: number
          wavelength?: number
          white_point_x?: number | null
          white_point_y?: number | null
          white_point_z?: number | null
          x_factor?: number
          y_factor?: number
          z_factor?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      color_book_associations: {
        Row: {
          book_id: string
          color_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          book_id: string
          color_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          book_id?: string
          color_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_associations_book"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "color_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_associations_color"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_associations_color"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_associations_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      color_book_selections: {
        Row: {
          book_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      color_books: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_color_books_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      color_matches: {
        Row: {
          created_at: string
          delta_e: number
          id: string
          matched_by: string | null
          organization_id: string
          sample_color_hex: string
          status: string
          target_color_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delta_e: number
          id?: string
          matched_by?: string | null
          organization_id: string
          sample_color_hex: string
          status: string
          target_color_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delta_e?: number
          id?: string
          matched_by?: string | null
          organization_id?: string
          sample_color_hex?: string
          status?: string
          target_color_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "color_matches_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_matches_target_color_id_fkey"
            columns: ["target_color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_matches_target_color_id_fkey"
            columns: ["target_color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
        ]
      }
      color_measurements: {
        Row: {
          color_id: string
          created_at: string
          id: string
          illuminant: string | null
          lab: Json | null
          mode: string
          observer: string | null
          spectral_data: Json
          tint_percentage: number | null
          updated_at: string
        }
        Insert: {
          color_id: string
          created_at?: string
          id?: string
          illuminant?: string | null
          lab?: Json | null
          mode: string
          observer?: string | null
          spectral_data: Json
          tint_percentage?: number | null
          updated_at?: string
        }
        Update: {
          color_id?: string
          created_at?: string
          id?: string
          illuminant?: string | null
          lab?: Json | null
          mode?: string
          observer?: string | null
          spectral_data?: Json
          tint_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "color_measurements_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_measurements_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
        ]
      }
      color_print_condition_associations: {
        Row: {
          adapted_at: string | null
          color_id: string
          created_at: string
          id: string
          is_adapted: boolean
          organization_id: string
          preferred_data_mode: string | null
          print_condition_id: string
        }
        Insert: {
          adapted_at?: string | null
          color_id: string
          created_at?: string
          id?: string
          is_adapted?: boolean
          organization_id: string
          preferred_data_mode?: string | null
          print_condition_id: string
        }
        Update: {
          adapted_at?: string | null
          color_id?: string
          created_at?: string
          id?: string
          is_adapted?: boolean
          organization_id?: string
          preferred_data_mode?: string | null
          print_condition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "color_print_condition_associations_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_print_condition_associations_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_print_condition_associations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_print_condition_associations_print_condition_id_fkey"
            columns: ["print_condition_id"]
            isOneToOne: false
            referencedRelation: "print_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      colors: {
        Row: {
          created_at: string
          created_by: string | null
          from_ink_condition_id: string | null
          hex: string
          id: string
          lab_a: number | null
          lab_b: number | null
          lab_illuminant: string | null
          lab_l: number | null
          lab_observer: string | null
          lab_table: string | null
          last_edited_by: string | null
          master_color_id: string | null
          name: string
          organization_id: string
          standard_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_ink_condition_id?: string | null
          hex: string
          id?: string
          lab_a?: number | null
          lab_b?: number | null
          lab_illuminant?: string | null
          lab_l?: number | null
          lab_observer?: string | null
          lab_table?: string | null
          last_edited_by?: string | null
          master_color_id?: string | null
          name: string
          organization_id: string
          standard_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_ink_condition_id?: string | null
          hex?: string
          id?: string
          lab_a?: number | null
          lab_b?: number | null
          lab_illuminant?: string | null
          lab_l?: number | null
          lab_observer?: string | null
          lab_table?: string | null
          last_edited_by?: string | null
          master_color_id?: string | null
          name?: string
          organization_id?: string
          standard_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_from_ink_condition_id_fkey"
            columns: ["from_ink_condition_id"]
            isOneToOne: false
            referencedRelation: "ink_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_master_color_id_fkey"
            columns: ["master_color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_master_color_id_fkey"
            columns: ["master_color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      illuminants: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          spectral_data: Json
          white_point: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          spectral_data: Json
          white_point: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          spectral_data?: Json
          white_point?: Json
        }
        Relationships: []
      }
      ink_book_associations: {
        Row: {
          book_id: string
          created_at: string
          id: string
          ink_id: string
          organization_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          ink_id: string
          organization_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          ink_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ink_book_associations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "ink_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ink_book_associations_ink_id_fkey"
            columns: ["ink_id"]
            isOneToOne: false
            referencedRelation: "inks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ink_book_associations_ink_id_fkey"
            columns: ["ink_id"]
            isOneToOne: false
            referencedRelation: "inks_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      ink_books: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ink_books_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ink_condition_color_approvals: {
        Row: {
          approved_by: string | null
          brand_organization_id: string
          color_id: string
          created_at: string
          id: string
          ink_condition_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          brand_organization_id: string
          color_id: string
          created_at?: string
          id?: string
          ink_condition_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          brand_organization_id?: string
          color_id?: string
          created_at?: string
          id?: string
          ink_condition_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ink_conditions: {
        Row: {
          adapted_tints: Json | null
          ch: Json | null
          color_hex: string | null
          created_at: string
          creation_origin: string | null
          id: string
          imported_tints: Json | null
          ink_curve: string | null
          ink_id: string
          is_hidden: boolean
          is_part_of_structure: boolean | null
          lab: Json | null
          measurement_settings: Json | null
          name: string
          pack_type: string | null
          spectral_data: Json | null
          spectral_string: string | null
          substrate_condition: string | null
          substrate_id: string | null
          ui_state: Json | null
          updated_at: string
          version: string | null
        }
        Insert: {
          adapted_tints?: Json | null
          ch?: Json | null
          color_hex?: string | null
          created_at?: string
          creation_origin?: string | null
          id?: string
          imported_tints?: Json | null
          ink_curve?: string | null
          ink_id: string
          is_hidden?: boolean
          is_part_of_structure?: boolean | null
          lab?: Json | null
          measurement_settings?: Json | null
          name: string
          pack_type?: string | null
          spectral_data?: Json | null
          spectral_string?: string | null
          substrate_condition?: string | null
          substrate_id?: string | null
          ui_state?: Json | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          adapted_tints?: Json | null
          ch?: Json | null
          color_hex?: string | null
          created_at?: string
          creation_origin?: string | null
          id?: string
          imported_tints?: Json | null
          ink_curve?: string | null
          ink_id?: string
          is_hidden?: boolean
          is_part_of_structure?: boolean | null
          lab?: Json | null
          measurement_settings?: Json | null
          name?: string
          pack_type?: string | null
          spectral_data?: Json | null
          spectral_string?: string | null
          substrate_condition?: string | null
          substrate_id?: string | null
          ui_state?: Json | null
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ink_conditions_ink_id_fkey"
            columns: ["ink_id"]
            isOneToOne: false
            referencedRelation: "inks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ink_conditions_ink_id_fkey"
            columns: ["ink_id"]
            isOneToOne: false
            referencedRelation: "inks_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ink_conditions_substrate_id_fkey"
            columns: ["substrate_id"]
            isOneToOne: false
            referencedRelation: "substrates"
            referencedColumns: ["id"]
          },
        ]
      }
      ink_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          value?: string
        }
        Relationships: []
      }
      inks: {
        Row: {
          appearance_type: string | null
          book_id: string | null
          created_at: string
          created_by: string | null
          curve: string | null
          id: string
          ink_type: string | null
          is_hidden: boolean
          last_edited_by: string | null
          material: string | null
          metallic: boolean | null
          metallic_gloss: number | null
          name: string
          opacity_left: number | null
          opaque: boolean | null
          organization_id: string
          print_process: string | null
          series: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          appearance_type?: string | null
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          curve?: string | null
          id?: string
          ink_type?: string | null
          is_hidden?: boolean
          last_edited_by?: string | null
          material?: string | null
          metallic?: boolean | null
          metallic_gloss?: number | null
          name: string
          opacity_left?: number | null
          opaque?: boolean | null
          organization_id: string
          print_process?: string | null
          series?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          appearance_type?: string | null
          book_id?: string | null
          created_at?: string
          created_by?: string | null
          curve?: string | null
          id?: string
          ink_type?: string | null
          is_hidden?: boolean
          last_edited_by?: string | null
          material?: string | null
          metallic?: boolean | null
          metallic_gloss?: number | null
          name?: string
          opacity_left?: number | null
          opaque?: boolean | null
          organization_id?: string
          print_process?: string | null
          series?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "ink_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inks_ink_type_fkey"
            columns: ["ink_type"]
            isOneToOne: false
            referencedRelation: "ink_types"
            referencedColumns: ["value"]
          },
          {
            foreignKeyName: "inks_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_5_3_density_tables: {
        Row: {
          blue_weighting: number
          created_at: string
          green_weighting: number
          id: string
          red_weighting: number
          status: string
          visual_weighting: number
          wavelength: number
        }
        Insert: {
          blue_weighting: number
          created_at?: string
          green_weighting: number
          id?: string
          red_weighting: number
          status?: string
          visual_weighting: number
          wavelength: number
        }
        Update: {
          blue_weighting?: number
          created_at?: string
          green_weighting?: number
          id?: string
          red_weighting?: number
          status?: string
          visual_weighting?: number
          wavelength?: number
        }
        Relationships: []
      }
      match_measurements: {
        Row: {
          color_id: string
          created_at: string
          id: string
          illuminant: string | null
          ink_condition_id: string | null
          is_routed: boolean
          lab_a: number | null
          lab_b: number | null
          lab_l: number | null
          match_location: string | null
          match_measurement_state: string | null
          match_print_process: string | null
          match_request_id: string
          match_substrate: string | null
          matched_by_name: string | null
          matched_color_data: Json | null
          matched_hex: string | null
          measurement_mode: string | null
          measurements: Json | null
          notes: string | null
          observer: string | null
          quality_set_id: string | null
          reference_lab_a: number | null
          reference_lab_b: number | null
          reference_lab_l: number | null
          spectral_data: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          color_id: string
          created_at?: string
          id?: string
          illuminant?: string | null
          ink_condition_id?: string | null
          is_routed?: boolean
          lab_a?: number | null
          lab_b?: number | null
          lab_l?: number | null
          match_location?: string | null
          match_measurement_state?: string | null
          match_print_process?: string | null
          match_request_id: string
          match_substrate?: string | null
          matched_by_name?: string | null
          matched_color_data?: Json | null
          matched_hex?: string | null
          measurement_mode?: string | null
          measurements?: Json | null
          notes?: string | null
          observer?: string | null
          quality_set_id?: string | null
          reference_lab_a?: number | null
          reference_lab_b?: number | null
          reference_lab_l?: number | null
          spectral_data?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          color_id?: string
          created_at?: string
          id?: string
          illuminant?: string | null
          ink_condition_id?: string | null
          is_routed?: boolean
          lab_a?: number | null
          lab_b?: number | null
          lab_l?: number | null
          match_location?: string | null
          match_measurement_state?: string | null
          match_print_process?: string | null
          match_request_id?: string
          match_substrate?: string | null
          matched_by_name?: string | null
          matched_color_data?: Json | null
          matched_hex?: string | null
          measurement_mode?: string | null
          measurements?: Json | null
          notes?: string | null
          observer?: string | null
          quality_set_id?: string | null
          reference_lab_a?: number | null
          reference_lab_b?: number | null
          reference_lab_l?: number | null
          spectral_data?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_measurements_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_measurements_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_measurements_match_request_id_fkey"
            columns: ["match_request_id"]
            isOneToOne: false
            referencedRelation: "match_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_measurements_quality_set_id_fkey"
            columns: ["quality_set_id"]
            isOneToOne: false
            referencedRelation: "quality_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      match_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          date_shared: string | null
          due_date: string | null
          id: string
          is_routed: boolean | null
          job_id: string
          location: string | null
          organization_id: string
          print_condition: string | null
          print_process: string | null
          project_id: string | null
          related_artwork_id: string | null
          routed_from_request_id: string | null
          routed_to: string | null
          routed_to_org_id: string | null
          routed_to_user_id: string | null
          routing_chain: Json | null
          shared_with: string | null
          shared_with_org_id: string | null
          shared_with_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          date_shared?: string | null
          due_date?: string | null
          id?: string
          is_routed?: boolean | null
          job_id?: string
          location?: string | null
          organization_id: string
          print_condition?: string | null
          print_process?: string | null
          project_id?: string | null
          related_artwork_id?: string | null
          routed_from_request_id?: string | null
          routed_to?: string | null
          routed_to_org_id?: string | null
          routed_to_user_id?: string | null
          routing_chain?: Json | null
          shared_with?: string | null
          shared_with_org_id?: string | null
          shared_with_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          date_shared?: string | null
          due_date?: string | null
          id?: string
          is_routed?: boolean | null
          job_id?: string
          location?: string | null
          organization_id?: string
          print_condition?: string | null
          print_process?: string | null
          project_id?: string | null
          related_artwork_id?: string | null
          routed_from_request_id?: string | null
          routed_to?: string | null
          routed_to_org_id?: string | null
          routed_to_user_id?: string | null
          routing_chain?: Json | null
          shared_with?: string | null
          shared_with_org_id?: string | null
          shared_with_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_match_requests_routed_to_org"
            columns: ["routed_to_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_match_requests_shared_with_org"
            columns: ["shared_with_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_requests_routed_from_request_id_fkey"
            columns: ["routed_from_request_id"]
            isOneToOne: false
            referencedRelation: "match_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          metadata: Json | null
          organization_id: string
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          organization_id: string
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          organization_id?: string
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      observers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          spectral_data: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          spectral_data: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          spectral_data?: Json
        }
        Relationships: []
      }
      organization_locations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          color_libraries_license: string | null
          create_pack_license: string | null
          created_at: string
          default_astm_table: string | null
          default_delta_e: string | null
          default_illuminant: string | null
          default_measurement_mode: string | null
          default_observer: string | null
          id: string
          location: string | null
          logo_url: string | null
          match_pack_license: string | null
          name: string
          printer_kiosk_license: string | null
          type: string[] | null
        }
        Insert: {
          color_libraries_license?: string | null
          create_pack_license?: string | null
          created_at?: string
          default_astm_table?: string | null
          default_delta_e?: string | null
          default_illuminant?: string | null
          default_measurement_mode?: string | null
          default_observer?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          match_pack_license?: string | null
          name: string
          printer_kiosk_license?: string | null
          type?: string[] | null
        }
        Update: {
          color_libraries_license?: string | null
          create_pack_license?: string | null
          created_at?: string
          default_astm_table?: string | null
          default_delta_e?: string | null
          default_illuminant?: string | null
          default_measurement_mode?: string | null
          default_observer?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          match_pack_license?: string | null
          name?: string
          printer_kiosk_license?: string | null
          type?: string[] | null
        }
        Relationships: []
      }
      pack_types: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          allow_download: boolean
          auto_request_analog_drawdowns: boolean
          collect_color_matches: boolean
          create_pack_license_count: number
          created_at: string
          force_direct_measurement: boolean
          id: string
          organization_id: string
          partner_location: string | null
          partner_organization_id: string
          partner_roles: string[]
          share_create_pack_licenses: boolean
          sharing_option: string
          status: string
          updated_at: string
        }
        Insert: {
          allow_download?: boolean
          auto_request_analog_drawdowns?: boolean
          collect_color_matches?: boolean
          create_pack_license_count?: number
          created_at?: string
          force_direct_measurement?: boolean
          id?: string
          organization_id: string
          partner_location?: string | null
          partner_organization_id: string
          partner_roles?: string[]
          share_create_pack_licenses?: boolean
          sharing_option?: string
          status?: string
          updated_at?: string
        }
        Update: {
          allow_download?: boolean
          auto_request_analog_drawdowns?: boolean
          collect_color_matches?: boolean
          create_pack_license_count?: number
          created_at?: string
          force_direct_measurement?: boolean
          id?: string
          organization_id?: string
          partner_location?: string | null
          partner_organization_id?: string
          partner_roles?: string[]
          share_create_pack_licenses?: boolean
          sharing_option?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patch_set_patches: {
        Row: {
          cmyk: Json | null
          created_at: string
          hex: string | null
          id: string
          lab: Json | null
          patch_index: number
          patch_name: string
          patch_set_id: string
          spectral_data: Json | null
        }
        Insert: {
          cmyk?: Json | null
          created_at?: string
          hex?: string | null
          id?: string
          lab?: Json | null
          patch_index: number
          patch_name: string
          patch_set_id: string
          spectral_data?: Json | null
        }
        Update: {
          cmyk?: Json | null
          created_at?: string
          hex?: string | null
          id?: string
          lab?: Json | null
          patch_index?: number
          patch_name?: string
          patch_set_id?: string
          spectral_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "patch_set_patches_patch_set_id_fkey"
            columns: ["patch_set_id"]
            isOneToOne: false
            referencedRelation: "patch_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      patch_sets: {
        Row: {
          colorspace: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          number_of_patches: number
          organization_id: string
          printing_channels: number
          updated_at: string
        }
        Insert: {
          colorspace?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          number_of_patches?: number
          organization_id: string
          printing_channels?: number
          updated_at?: string
        }
        Update: {
          colorspace?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          number_of_patches?: number
          organization_id?: string
          printing_channels?: number
          updated_at?: string
        }
        Relationships: []
      }
      print_card_orders: {
        Row: {
          card_type: string | null
          color_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          flow_id: string | null
          gmg_order_id: string
          id: string
          match_measurement_id: string | null
          match_request_id: string | null
          organization_id: string
          status: string | null
          submitted_by: string | null
          substrate_id: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          card_type?: string | null
          color_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          flow_id?: string | null
          gmg_order_id: string
          id?: string
          match_measurement_id?: string | null
          match_request_id?: string | null
          organization_id: string
          status?: string | null
          submitted_by?: string | null
          substrate_id?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          card_type?: string | null
          color_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          flow_id?: string | null
          gmg_order_id?: string
          id?: string
          match_measurement_id?: string | null
          match_request_id?: string | null
          organization_id?: string
          status?: string | null
          submitted_by?: string | null
          substrate_id?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_card_orders_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_card_orders_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_card_orders_match_measurement_id_fkey"
            columns: ["match_measurement_id"]
            isOneToOne: false
            referencedRelation: "match_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_card_orders_match_request_id_fkey"
            columns: ["match_request_id"]
            isOneToOne: false
            referencedRelation: "match_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_card_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      print_conditions: {
        Row: {
          appearance_settings: Json | null
          ch: Json | null
          color_hex: string | null
          construction_details: Json | null
          created_at: string
          description: string | null
          id: string
          is_part_of_structure: boolean | null
          lab: Json | null
          measurement_settings: Json | null
          name: string
          organization_id: string
          pack_type: string | null
          print_process: string | null
          printing_side: string | null
          spectral_data: Json | null
          spectral_string: string | null
          substrate_material_id: string | null
          substrate_type_id: string | null
          updated_at: string
          use_white_ink: boolean | null
          version: string | null
        }
        Insert: {
          appearance_settings?: Json | null
          ch?: Json | null
          color_hex?: string | null
          construction_details?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_part_of_structure?: boolean | null
          lab?: Json | null
          measurement_settings?: Json | null
          name: string
          organization_id: string
          pack_type?: string | null
          print_process?: string | null
          printing_side?: string | null
          spectral_data?: Json | null
          spectral_string?: string | null
          substrate_material_id?: string | null
          substrate_type_id?: string | null
          updated_at?: string
          use_white_ink?: boolean | null
          version?: string | null
        }
        Update: {
          appearance_settings?: Json | null
          ch?: Json | null
          color_hex?: string | null
          construction_details?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_part_of_structure?: boolean | null
          lab?: Json | null
          measurement_settings?: Json | null
          name?: string
          organization_id?: string
          pack_type?: string | null
          print_process?: string | null
          printing_side?: string | null
          spectral_data?: Json | null
          spectral_string?: string | null
          substrate_material_id?: string | null
          substrate_type_id?: string | null
          updated_at?: string
          use_white_ink?: boolean | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_conditions_substrate_material_id_fkey"
            columns: ["substrate_material_id"]
            isOneToOne: false
            referencedRelation: "substrate_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_conditions_substrate_type_id_fkey"
            columns: ["substrate_type_id"]
            isOneToOne: false
            referencedRelation: "substrate_types"
            referencedColumns: ["id"]
          },
        ]
      }
      print_processes: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      printer_condition_characterizations: {
        Row: {
          adapt_to_substrate: boolean | null
          created_at: string
          file_name: string | null
          id: string
          printer_condition_id: string
          substrate_lab_a: number | null
          substrate_lab_b: number | null
          substrate_lab_l: number | null
          updated_at: string
        }
        Insert: {
          adapt_to_substrate?: boolean | null
          created_at?: string
          file_name?: string | null
          id?: string
          printer_condition_id: string
          substrate_lab_a?: number | null
          substrate_lab_b?: number | null
          substrate_lab_l?: number | null
          updated_at?: string
        }
        Update: {
          adapt_to_substrate?: boolean | null
          created_at?: string
          file_name?: string | null
          id?: string
          printer_condition_id?: string
          substrate_lab_a?: number | null
          substrate_lab_b?: number | null
          substrate_lab_l?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      printer_condition_ink_setups: {
        Row: {
          characterization_id: string
          color_hex: string | null
          created_at: string
          curve: string | null
          id: string
          name: string
          screen_angle: number | null
          screen_ruling: number | null
          screening_type: string | null
          sort_order: number
          usage: string | null
        }
        Insert: {
          characterization_id: string
          color_hex?: string | null
          created_at?: string
          curve?: string | null
          id?: string
          name: string
          screen_angle?: number | null
          screen_ruling?: number | null
          screening_type?: string | null
          sort_order?: number
          usage?: string | null
        }
        Update: {
          characterization_id?: string
          color_hex?: string | null
          created_at?: string
          curve?: string | null
          id?: string
          name?: string
          screen_angle?: number | null
          screen_ruling?: number | null
          screening_type?: string | null
          sort_order?: number
          usage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printer_condition_ink_setups_characterization_id_fkey"
            columns: ["characterization_id"]
            isOneToOne: false
            referencedRelation: "printer_condition_characterizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_brand_partner_id: string | null
          allow_other_locations: boolean | null
          deleted_at: string | null
          deleted_by: string | null
          full_name: string | null
          id: string
          limit_by_tags: boolean | null
          location: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          selected_brand_partner_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          active_brand_partner_id?: string | null
          allow_other_locations?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string | null
          id: string
          limit_by_tags?: boolean | null
          location?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_brand_partner_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          active_brand_partner_id?: string | null
          allow_other_locations?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string | null
          id?: string
          limit_by_tags?: boolean | null
          location?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_brand_partner_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_brand_partner_id_fkey"
            columns: ["active_brand_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_levels: {
        Row: {
          action: string
          created_at: string
          display_color: string | null
          id: string
          name: string
          quality_rule_id: string
          range_from: number
          range_to: number | null
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          display_color?: string | null
          id?: string
          name: string
          quality_rule_id: string
          range_from: number
          range_to?: number | null
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          display_color?: string | null
          id?: string
          name?: string
          quality_rule_id?: string
          range_from?: number
          range_to?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_levels_quality_rule_id_fkey"
            columns: ["quality_rule_id"]
            isOneToOne: false
            referencedRelation: "quality_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_rules: {
        Row: {
          created_at: string
          id: string
          name: string
          quality_set_id: string
          reference: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quality_set_id: string
          reference: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quality_set_id?: string
          reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_rules_quality_set_id_fkey"
            columns: ["quality_set_id"]
            isOneToOne: false
            referencedRelation: "quality_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_sets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_edited_by: string | null
          measurement_settings: Json | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_edited_by?: string | null
          measurement_settings?: Json | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_edited_by?: string | null
          measurement_settings?: Json | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_sets_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sharing_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          location_id: string
          organization_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          location_id: string
          organization_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          location_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sharing_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sharing_codes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "organization_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sharing_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      substrate_conditions: {
        Row: {
          ch: Json | null
          color_hex: string | null
          construction_details: Json | null
          created_at: string
          description: string | null
          id: string
          imported_tints: Json | null
          is_part_of_structure: boolean | null
          lab: Json | null
          measurement_settings: Json | null
          name: string
          organization_id: string
          pack_type: string | null
          spectral_data: Json | null
          spectral_string: string | null
          substrate_id: string
          updated_at: string
          use_white_ink: boolean | null
          version: string | null
        }
        Insert: {
          ch?: Json | null
          color_hex?: string | null
          construction_details?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          imported_tints?: Json | null
          is_part_of_structure?: boolean | null
          lab?: Json | null
          measurement_settings?: Json | null
          name: string
          organization_id: string
          pack_type?: string | null
          spectral_data?: Json | null
          spectral_string?: string | null
          substrate_id: string
          updated_at?: string
          use_white_ink?: boolean | null
          version?: string | null
        }
        Update: {
          ch?: Json | null
          color_hex?: string | null
          construction_details?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          imported_tints?: Json | null
          is_part_of_structure?: boolean | null
          lab?: Json | null
          measurement_settings?: Json | null
          name?: string
          organization_id?: string
          pack_type?: string | null
          spectral_data?: Json | null
          spectral_string?: string | null
          substrate_id?: string
          updated_at?: string
          use_white_ink?: boolean | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "substrate_conditions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrate_conditions_substrate_id_fkey"
            columns: ["substrate_id"]
            isOneToOne: false
            referencedRelation: "substrates"
            referencedColumns: ["id"]
          },
        ]
      }
      substrate_materials: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          substrate_type_id: string
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          substrate_type_id: string
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          substrate_type_id?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "substrate_materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrate_materials_substrate_type_id_fkey"
            columns: ["substrate_type_id"]
            isOneToOne: false
            referencedRelation: "substrate_types"
            referencedColumns: ["id"]
          },
        ]
      }
      substrate_surface_qualities: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          substrate_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          substrate_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          substrate_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substrate_surface_qualities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrate_surface_qualities_substrate_type_id_fkey"
            columns: ["substrate_type_id"]
            isOneToOne: false
            referencedRelation: "substrate_types"
            referencedColumns: ["id"]
          },
        ]
      }
      substrate_types: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "substrate_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      substrates: {
        Row: {
          contrast: string | null
          created_at: string
          id: string
          ink_adhesion: number | null
          last_modified_by: string | null
          manufacturer: string | null
          material: string | null
          name: string
          notes: string | null
          organization_id: string
          printing_side: string | null
          product_name: string | null
          surface_quality: string | null
          thickness: number | null
          thickness_unit: string | null
          type: string | null
          updated_at: string
          use_white_ink: boolean | null
          weight: number | null
        }
        Insert: {
          contrast?: string | null
          created_at?: string
          id?: string
          ink_adhesion?: number | null
          last_modified_by?: string | null
          manufacturer?: string | null
          material?: string | null
          name: string
          notes?: string | null
          organization_id: string
          printing_side?: string | null
          product_name?: string | null
          surface_quality?: string | null
          thickness?: number | null
          thickness_unit?: string | null
          type?: string | null
          updated_at?: string
          use_white_ink?: boolean | null
          weight?: number | null
        }
        Update: {
          contrast?: string | null
          created_at?: string
          id?: string
          ink_adhesion?: number | null
          last_modified_by?: string | null
          manufacturer?: string | null
          material?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          printing_side?: string | null
          product_name?: string | null
          surface_quality?: string | null
          thickness?: number | null
          thickness_unit?: string | null
          type?: string | null
          updated_at?: string
          use_white_ink?: boolean | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "substrates_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrates_material_fkey"
            columns: ["material"]
            isOneToOne: false
            referencedRelation: "substrate_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrates_surface_quality_fkey"
            columns: ["surface_quality"]
            isOneToOne: false
            referencedRelation: "substrate_surface_qualities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substrates_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "substrate_types"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_associations: {
        Row: {
          color_id: string | null
          created_at: string
          id: string
          organization_id: string
          partner_id: string | null
          tag_id: string
          user_id: string | null
        }
        Insert: {
          color_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          partner_id?: string | null
          tag_id: string
          user_id?: string | null
        }
        Update: {
          color_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          partner_id?: string | null
          tag_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_associations_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_associations_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_associations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_associations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_associations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_associations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_hierarchies: {
        Row: {
          created_at: string
          id: string
          parent_tag_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_tag_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_tag_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_relationships_parent_tag_id_fkey"
            columns: ["parent_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_relationships_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      test_charts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instrument: string | null
          last_edited_by: string | null
          name: string
          number_of_pages: number | null
          number_of_patches: number | null
          organization_id: string
          page_size: string | null
          patch_set_id: string | null
          patch_set_name: string | null
          patch_size: number | null
          printing_channels: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instrument?: string | null
          last_edited_by?: string | null
          name: string
          number_of_pages?: number | null
          number_of_patches?: number | null
          organization_id: string
          page_size?: string | null
          patch_set_id?: string | null
          patch_set_name?: string | null
          patch_size?: number | null
          printing_channels?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instrument?: string | null
          last_edited_by?: string | null
          name?: string
          number_of_pages?: number | null
          number_of_patches?: number | null
          organization_id?: string
          page_size?: string | null
          patch_set_id?: string | null
          patch_set_name?: string | null
          patch_size?: number | null
          printing_channels?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_charts_patch_set_id_fkey"
            columns: ["patch_set_id"]
            isOneToOne: false
            referencedRelation: "patch_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sharing_tags: {
        Row: {
          created_at: string
          id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sharing_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sharing_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      varnish_types: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      astm_e308_sums: {
        Row: {
          illuminant_name: string | null
          observer: string | null
          rows: number | null
          sum_x: number | null
          sum_y: number | null
          sum_z: number | null
          table_number: number | null
        }
        Relationships: []
      }
      color_matches_with_details: {
        Row: {
          created_at: string | null
          delta_e: number | null
          id: string | null
          match_location: string | null
          match_print_condition: string | null
          match_print_process: string | null
          matched_by: string | null
          matched_by_name: string | null
          organization_id: string | null
          sample_color_hex: string | null
          status: string | null
          target_color_hex: string | null
          target_color_id: string | null
          target_color_lab_a: number | null
          target_color_lab_b: number | null
          target_color_lab_l: number | null
          target_color_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "color_matches_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_matches_target_color_id_fkey"
            columns: ["target_color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "color_matches_target_color_id_fkey"
            columns: ["target_color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
        ]
      }
      colors_with_full_details: {
        Row: {
          book_associations: Json | null
          book_ids: string[] | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          hex: string | null
          id: string | null
          last_edited_by: string | null
          last_edited_by_name: string | null
          master_color_id: string | null
          measurements: Json | null
          name: string | null
          organization_id: string | null
          standard_type: string | null
          tags: Json | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_master_color_id_fkey"
            columns: ["master_color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_master_color_id_fkey"
            columns: ["master_color_id"]
            isOneToOne: false
            referencedRelation: "colors_with_full_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inks_with_details: {
        Row: {
          book_id: string | null
          conditions: Json | null
          created_at: string | null
          id: string | null
          material: string | null
          name: string | null
          organization_id: string | null
          print_process: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          book_id?: string | null
          conditions?: never
          created_at?: string | null
          id?: string | null
          material?: string | null
          name?: string | null
          organization_id?: string | null
          print_process?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          book_id?: string | null
          conditions?: never
          created_at?: string | null
          id?: string | null
          material?: string | null
          name?: string | null
          organization_id?: string | null
          print_process?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "ink_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_partner_invitation: {
        Args: { p_accepting_org_id: string; p_partner_connection_id: string }
        Returns: undefined
      }
      add_colors_to_book: {
        Args: {
          p_book_id: string
          p_color_ids: string[]
          p_organization_id: string
        }
        Returns: undefined
      }
      add_inks_to_book: {
        Args: {
          p_book_id: string
          p_ink_ids: string[]
          p_organization_id: string
        }
        Returns: undefined
      }
      admin_get_auth_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      approve_match_with_token: { Args: { p_token: string }; Returns: Json }
      approve_or_update_measurement_status: {
        Args: {
          p_measurement_id: string
          p_new_status: string
          p_notes?: string
          p_user_org_id?: string
        }
        Returns: Json
      }
      archive_completed_jobs: { Args: never; Returns: number }
      backfill_color_editor_fields: {
        Args: { p_color_id: string }
        Returns: boolean
      }
      backfill_is_adapted_by_substrate_match: { Args: never; Returns: number }
      backfill_match_measurement_lab_from_spectral: {
        Args: never
        Returns: number
      }
      backfill_my_org_color_editors: { Args: never; Returns: number }
      broadcast_changes: {
        Args: { data: Json; table_name: string }
        Returns: undefined
      }
      calculate_colors_routed_count: {
        Args: { p_match_request_id: string }
        Returns: number
      }
      calculate_effective_status: {
        Args: {
          p_is_routed?: boolean
          p_job_status: string
          p_measurement_status: string
          p_viewer_role: string
        }
        Returns: string
      }
      calculate_job_status: {
        Args: { p_actor_org_id?: string; p_match_request_id: string }
        Returns: string
      }
      can_edit: { Args: { _user_id: string }; Returns: boolean }
      check_tag_hierarchy_conflicts: {
        Args: {
          p_color_id: string
          p_new_tag_ids: string[]
          p_organization_id: string
        }
        Returns: Json
      }
      cleanup_expired_reset_tokens: { Args: never; Returns: undefined }
      cleanup_hidden_inks_and_conditions: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      cleanup_orphan_auth_users: {
        Args: never
        Returns: {
          deleted_user_id: string
          email: string
        }[]
      }
      cleanup_orphan_by_email: { Args: { p_email: string }; Returns: undefined }
      cleanup_orphaned_inks_and_conditions: { Args: never; Returns: Json }
      create_match_notification: {
        Args: {
          p_include_only_routed_colors?: boolean
          p_message: string
          p_metadata: Json
          p_organization_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      create_notification:
        | {
            Args: {
              p_message: string
              p_metadata?: Json
              p_organization_id: string
              p_title: string
              p_type: string
            }
            Returns: string
          }
        | {
            Args: {
              p_match_request_id: string
              p_message: string
              p_metadata: Json
              p_org_id: string
              p_title: string
              p_type: string
            }
            Returns: string
          }
      create_partner_invitation:
        | {
            Args: {
              p_allow_download?: boolean
              p_auto_request_analog_drawdowns?: boolean
              p_collect_color_matches?: boolean
              p_create_pack_license_count?: number
              p_force_direct_measurement?: boolean
              p_inviting_org_id: string
              p_partner_org_id: string
              p_partner_org_location?: string
              p_partner_roles?: string[]
              p_share_create_pack_licenses?: boolean
              p_tags?: string[]
            }
            Returns: string
          }
        | {
            Args: {
              p_auto_request_analog_drawdowns?: boolean
              p_collect_color_matches?: boolean
              p_force_direct_measurement?: boolean
              p_inviting_org_id: string
              p_partner_org_id: string
              p_partner_org_location: string
              p_partner_roles?: string[]
              p_tags?: string[]
            }
            Returns: Json
          }
        | {
            Args: {
              p_auto_request_analog_drawdowns?: boolean
              p_collect_color_matches?: boolean
              p_create_pack_license_count?: number
              p_force_direct_measurement?: boolean
              p_inviting_org_id: string
              p_partner_org_id: string
              p_partner_org_location: string
              p_partner_roles?: string[]
              p_share_create_pack_licenses?: boolean
              p_tags?: string[]
            }
            Returns: Json
          }
      create_substrate_condition_from_imported_tints: {
        Args: {
          p_ink_condition_id: string
          p_organization_id: string
          p_substrate_id: string
        }
        Returns: Json
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      debug_profile_access: { Args: never; Returns: Json }
      debug_user_org: {
        Args: never
        Returns: {
          is_authenticated: boolean
          organization_id: string
          user_id: string
        }[]
      }
      delete_color_book_associations: {
        Args: { p_association_ids: string[]; p_organization_id: string }
        Returns: undefined
      }
      delete_colors_transaction: {
        Args: { p_color_ids: string[] }
        Returns: undefined
      }
      delete_ink_book_associations: {
        Args: { p_association_ids: string[]; p_organization_id: string }
        Returns: undefined
      }
      delete_match_requests_cascade: {
        Args: { p_match_request_ids: string[] }
        Returns: undefined
      }
      delete_partner_connection: {
        Args: { p_org_id_1: string; p_org_id_2: string }
        Returns: undefined
      }
      delete_tag_cascade: {
        Args: { p_organization_id: string; p_tag_id: string }
        Returns: Json
      }
      delete_user_and_profile: { Args: { user_id: string }; Returns: undefined }
      extract_lab_from_matched_color_data: { Args: never; Returns: undefined }
      find_and_delete_duplicate_colors: {
        Args: { p_color_ids: string[]; p_organization_id: string }
        Returns: Json
      }
      find_duplicate_colors: {
        Args: { p_color_ids: string[]; p_organization_id: string }
        Returns: number
      }
      generate_ink_condition_name:
        | {
            Args: {
              p_ink_curve?: string
              p_substrate_condition_id: string
              p_version?: string
            }
            Returns: string
          }
        | {
            Args: { p_ink_curve?: string; p_substrate_condition_id: string }
            Returns: string
          }
      generate_job_id: { Args: never; Returns: string }
      generate_random_string: { Args: { length: number }; Returns: string }
      get_basic_color_library_for_org: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string
          created_by: string
          hex: string
          id: string
          lab_a: number
          lab_b: number
          lab_l: number
          last_edited_by: string
          master_color_id: string
          measurements: Json
          name: string
          organization_id: string
          owner_org_name: string
          standard_type: string
          status: string
          tags: Json
          updated_at: string
        }[]
      }
      get_brand_orgs_for_partner: {
        Args: { p_partner_org_id: string }
        Returns: {
          brand_name: string
          brand_org_id: string
          partner_id: string
        }[]
      }
      get_color_library_for_org: { Args: { p_org_id: string }; Returns: Json }
      get_color_measurements_for_color: {
        Args: { p_color_id: string }
        Returns: {
          created_at: string
          id: string
          illuminant: string
          lab: Json
          mode: string
          observer: string
          spectral_data: Json
          tint_percentage: number
        }[]
      }
      get_color_measurements_for_colors:
        | {
            Args: { p_color_ids: string[]; p_org_id: string }
            Returns: {
              color_id: string
              measurements: Json
            }[]
          }
        | {
            Args: { p_color_ids: string[] }
            Returns: {
              color_id: string
              measurements: Json
            }[]
          }
      get_color_statistics_for_org: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_color_tags_for_colors:
        | {
            Args: { p_color_ids: string[]; p_org_id: string }
            Returns: {
              color_id: string
              tags: Json
            }[]
          }
        | {
            Args: { p_color_ids: string[] }
            Returns: {
              color_id: string
              tags: Json
            }[]
          }
      get_colors_shared_with_partner: {
        Args: { p_org_id: string; p_partner_id: string }
        Returns: string[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_descendant_tag_ids: {
        Args: { p_tag_ids: string[] }
        Returns: string[]
      }
      get_ink_condition_details: {
        Args: { p_condition_id: string }
        Returns: Json
      }
      get_inks_for_organization: {
        Args: { p_org_id: string }
        Returns: {
          book_id: string
          conditions: Json
          created_at: string
          id: string
          material: string
          name: string
          organization_id: string
          print_process: string
          type: string
          updated_at: string
        }[]
      }
      get_inks_for_picker: { Args: { p_org_id: string }; Returns: Json }
      get_inks_list_minimal: { Args: { p_org_id: string }; Returns: Json }
      get_inks_with_complete_details: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_match_data_optimized: {
        Args: { p_color_id: string; p_match_request_id: string }
        Returns: Json
      }
      get_match_request_colors: {
        Args: { p_match_request_id: string }
        Returns: Json
      }
      get_match_request_details: {
        Args: { p_color_id?: string; p_match_request_id: string }
        Returns: Json
      }
      get_match_requests_for_current_user: {
        Args: never
        Returns: {
          colors: Json
          created_at: string
          date_shared: string
          due_date: string
          id: string
          is_routed: boolean
          job_id: string
          location: string
          organization_id: string
          print_condition: string
          print_process: string
          project_id: string
          related_artwork_id: string
          requestor_organization_name: string
          routed_from_request_id: string
          routed_to: string
          routed_to_org_id: string
          routing_chain: Json
          shared_with: string
          shared_with_org_id: string
          status: string
          updated_at: string
        }[]
      }
      get_match_requests_for_org: {
        Args: { p_org_id: string }
        Returns: {
          colors: Json
          colors_possessed: number
          created_at: string
          date_shared: string
          due_date: string
          id: string
          is_routed: boolean
          job_id: string
          location: string
          matches_completed: number
          organization_id: string
          print_condition: string
          print_process: string
          project_id: string
          related_artwork_id: string
          requesting_org_name: string
          routed_to: string
          shared_with: string
          status: string
          total_colors: number
          updated_at: string
        }[]
      }
      get_measurement_for_approval: {
        Args: { token_hash_input: string }
        Returns: {
          color_hex: string
          color_id: string
          color_name: string
          color_spectral_data: Json
          default_astm_table: string
          default_delta_e: string
          default_illuminant: string
          default_observer: string
          illuminant: string
          job_id: string
          match_location: string
          match_measurement_state: string
          match_request_id: string
          matched_color_data: Json
          matched_hex: string
          observer: string
          organization_id: string
          quality_set_id: string
          quality_set_illuminant: string
          quality_set_mode: string
          quality_set_name: string
          quality_set_observer: string
          quality_set_table: string
          spectral_data: Json
        }[]
      }
      get_measurement_for_approval_wrapper: {
        Args: { token_hash: string }
        Returns: {
          color_id: string
          color_name: string
          color_spectral_data: Json
          default_astm_table: string
          default_delta_e: string
          default_illuminant: string
          default_observer: string
          job_id: string
          job_number: string
          job_reference: string
          match_location: string
          matched_hex: string
          measurement_id: string
          quality_set_id: string
          quality_set_illuminant: string
          quality_set_mode: string
          quality_set_name: string
          quality_set_observer: string
          quality_set_table: string
          spectral_data: Json
        }[]
      }
      get_my_org_id: { Args: never; Returns: string }
      get_org_id_by_name: { Args: { p_name: string }; Returns: string }
      get_org_name_by_id: { Args: { org_id: string }; Returns: string }
      get_org_sharing_preference: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      get_partner_allowed_tags: {
        Args: { p_partner_id: string }
        Returns: {
          tag_id: string
        }[]
      }
      get_partner_locations_for_brand: {
        Args: { p_org_id: string }
        Returns: {
          combined_display: string
          partner_id: string
          partner_location: string
          partner_name: string
          partner_org_id: string
        }[]
      }
      get_partner_taxonomy: { Args: { p_partner_id: string }; Returns: Json }
      get_partners_for_org: {
        Args: { p_org_id: string }
        Returns: {
          allow_download: boolean
          auto_request_analog_drawdowns: boolean
          collect_color_matches: boolean
          colors_shared_by_inviter: number
          create_pack_license_count: number
          created_at: string
          force_direct_measurement: boolean
          id: string
          is_initiator: boolean
          matches: number
          partner_location: string
          partner_name: string
          partner_organization_id: string
          partner_roles: string[]
          partner_type: string[]
          share_create_pack_licenses: boolean
          sharing_categories: string[]
          sharing_option: string
          sharing_tags: string[]
          status: string
          updated_at: string
        }[]
      }
      get_print_condition_core: {
        Args: { p_print_condition_id: string }
        Returns: {
          id: string
          name: string
          pack_type: string
          print_process: string
          printing_side: string
          substrate_material_name: string
          substrate_type_name: string
        }[]
      }
      get_print_condition_details_for_match: {
        Args: { p_match_request_id: string }
        Returns: {
          id: string
          name: string
          pack_type: string
          print_process: string
          printing_side: string
          substrate_material_name: string
          substrate_type_name: string
        }[]
      }
      get_quality_set_details: { Args: { qs_id: string }; Returns: Json }
      get_quality_set_details_for_match: {
        Args: { p_match_request_id: string }
        Returns: Json
      }
      get_quality_sets_with_details: {
        Args: never
        Returns: {
          editor_name: string
          id: string
          name: string
          rules_summary: string
          updated_at: string
        }[]
      }
      get_role_aware_message: {
        Args: {
          p_job_id?: string
          p_message_type: string
          p_partner_roles: string[]
        }
        Returns: string
      }
      get_routed_colors_for_match_request: {
        Args: { p_match_request_id: string }
        Returns: Json
      }
      get_shared_print_condition_details:
        | {
            Args: {
              p_match_request_id?: string
              p_print_condition_identifier?: string
              p_print_condition_name?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_match_request_id?: string
              p_print_condition_name: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_match_request_id?: string
              p_print_condition_identifier?: string
              p_print_condition_name?: string
            }
            Returns: Json
          }
      get_shared_quality_set_details: {
        Args: { match_request_id?: string; qs_id: string }
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_transferable_asset_count: {
        Args: { p_user_id: string }
        Returns: Json
      }
      hard_delete_user_with_transfer: {
        Args: { p_transfer_to_user_id?: string; p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_session: { Args: never; Returns: boolean }
      import_astm_e308_weights: { Args: { p_rows: Json }; Returns: number }
      import_cxf_colors: {
        Args: {
          p_colors_data: Json
          p_organization_id: string
          p_user_id: string
        }
        Returns: {
          color_id: string
          color_name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_color_download_restricted: {
        Args: { p_color_id: string; p_viewing_org_id: string }
        Returns: boolean
      }
      is_match_participant: {
        Args: { p_match_request_id: string; p_user_org_id: string }
        Returns: boolean
      }
      is_meaningful_status_change: {
        Args: {
          p_new_measurement_status: string
          p_new_status: string
          p_old_measurement_status: string
          p_old_status: string
        }
        Returns: boolean
      }
      mark_token_used: { Args: { token_hash: string }; Returns: boolean }
      merge_colors_by_modes: {
        Args: { p_color_ids: string[]; p_new_name: string }
        Returns: string
      }
      migrate_lab_from_hex: {
        Args: never
        Returns: {
          calculated_lab_a: number
          calculated_lab_b: number
          calculated_lab_l: number
          color_id: string
          hex_value: string
        }[]
      }
      populate_missing_lab_from_hex: { Args: never; Returns: number }
      refresh_colors_with_full_details: { Args: never; Returns: undefined }
      reject_match_with_token: { Args: { p_token: string }; Returns: Json }
      route_match_request:
        | {
            Args: {
              p_color_ids?: string[]
              p_match_request_id: string
              p_notes?: string
              p_partner_organization_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_match_request_id: string
              p_notes?: string
              p_partner_organization_id: string
            }
            Returns: Json
          }
      set_color_tags_bulk:
        | {
            Args: {
              p_color_ids: string[]
              p_organization_id: string
              p_tag_ids: string[]
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_color_ids: string[]
              p_operation_mode?: string
              p_organization_id: string
              p_tag_ids: string[]
              p_user_id: string
            }
            Returns: Json
          }
      set_match_state: {
        Args: { p_measurement_id: string; p_new_measurement_state: string }
        Returns: Json
      }
      soft_delete_user: { Args: { p_user_id: string }; Returns: Json }
      update_color_print_conditions: {
        Args: {
          p_color_id: string
          p_organization_id: string
          p_print_condition_ids: string[]
        }
        Returns: undefined
      }
      update_color_standard_type: {
        Args: { p_color_ids: string[]; p_standard_type: string }
        Returns: undefined
      }
      update_color_tags_optimized: {
        Args: {
          p_color_ids: string[]
          p_organization_id: string
          p_tag_ids_to_set: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      update_color_tags_transaction: {
        Args: {
          p_color_ids: string[]
          p_organization_id: string
          p_tag_ids_to_set: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      update_color_tags_ultra_optimized: {
        Args: {
          p_color_ids: string[]
          p_existing_tags?: Json
          p_organization_id: string
          p_tag_ids_to_set: string[]
          p_user_id: string
        }
        Returns: Json
      }
      update_ink_condition: {
        Args: { p_condition_data: Json; p_condition_id: string }
        Returns: Json
      }
      update_ink_condition_name_auto: {
        Args: { p_condition_id: string }
        Returns: string
      }
      update_match_status: {
        Args: {
          p_measurement_id: string
          p_new_measurement_state?: string
          p_new_status: string
        }
        Returns: Json
      }
      update_partner_settings:
        | {
            Args: {
              p_auto_request_analog_drawdowns: boolean
              p_collect_color_matches: boolean
              p_force_direct_measurement: boolean
              p_partner_id: string
              p_partner_roles: string[]
            }
            Returns: undefined
          }
        | {
            Args: {
              p_auto_request_analog_drawdowns: boolean
              p_collect_color_matches: boolean
              p_create_pack_license_count: number
              p_force_direct_measurement: boolean
              p_partner_id: string
              p_partner_roles: string[]
              p_share_create_pack_licenses: boolean
            }
            Returns: undefined
          }
        | {
            Args: {
              p_auto_request_analog_drawdowns: boolean
              p_collect_color_matches: boolean
              p_force_direct_measurement: boolean
              p_partner_id: string
              p_partner_role: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_allow_download?: boolean
              p_auto_request_analog_drawdowns: boolean
              p_collect_color_matches: boolean
              p_create_pack_license_count: number
              p_force_direct_measurement: boolean
              p_partner_id: string
              p_partner_roles: string[]
              p_share_create_pack_licenses: boolean
            }
            Returns: undefined
          }
      update_partner_tags: {
        Args: {
          p_organization_id: string
          p_partner_id: string
          p_tag_ids: string[]
        }
        Returns: undefined
      }
      upsert_quality_set_with_details: {
        Args: { payload: Json }
        Returns: undefined
      }
      user_owns_ink: { Args: { ink_id: string }; Returns: boolean }
      validate_approval_token: {
        Args: { token_hash: string }
        Returns: {
          already_used: boolean
          expired: boolean
          measurement_id: string
          valid: boolean
        }[]
      }
      validate_astm_tables: { Args: never; Returns: boolean }
      validate_colors_shared_with_partner: {
        Args: { p_color_ids: string[]; p_org_id: string; p_partner_id: string }
        Returns: Json
      }
      validate_colors_shared_with_partner_realtime: {
        Args: { p_color_ids: string[]; p_org_id: string; p_partner_id: string }
        Returns: Json
      }
      verify_reset_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
    }
    Enums: {
      user_role: "Superadmin" | "Admin" | "Color Admin" | "Color User"
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
      user_role: ["Superadmin", "Admin", "Color Admin", "Color User"],
    },
  },
} as const
