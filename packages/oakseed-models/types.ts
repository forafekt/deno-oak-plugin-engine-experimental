// @oakseed/models/types.ts

export type FieldType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "uuid"
  | "json"
  | "password"
  | "relation";

export interface BaseField {
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  readonly?: boolean;
  hidden?: boolean;        // hidden from admin forms
  index?: boolean;
}

export interface RelationField extends BaseField {
  type: "relation";
  model: string;
  relation: "one" | "many";
  onDelete?: "cascade" | "restrict" | "null";
}

export type FieldDefinition =
  | BaseField
  | RelationField;

export type ModelSchema = Record<string, FieldDefinition>;
