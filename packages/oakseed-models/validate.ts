// @oakseed/models/validate.ts

export function validate(
  model: any,
  data: Record<string, any>,
) {
  for (const [name, field] of Object.entries(model.fields)) {
    if (field.required && data[name] == null) {
      throw new Error(`${name} is required`);
    }
  }
}
