// @denoboot/admin/ui/schema.ts

export function buildFormSchema(model: any) {
  return Object.entries<any>(model.fields)
    .filter(([_, f]) => !f.hidden)
    .map(([name, field]) => ({
      name,
      label: name,
      type: field.type,
      readonly: field.readonly ?? false,
      required: field.required ?? false,
    }));
}
