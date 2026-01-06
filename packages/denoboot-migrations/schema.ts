// @denoboot/migrations/schema.ts

export interface SchemaSnapshot {
  version: number;
  models: Record<
    string,
    {
      tableName: string;
      fields: Record<string, {
        type: string;
        required?: boolean;
        unique?: boolean;
        default?: unknown;
      }>;
    }
  >;
}


// {
//   "version": 3,
//   "models": {
//     "User": {
//       "tableName": "user",
//       "fields": {
//         "id": { "type": "uuid" },
//         "email": { "type": "string", "unique": true }
//       }
//     }
//   }
// }
