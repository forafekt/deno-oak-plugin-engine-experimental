// models/user.ts
import { defineModel } from "../defineModel.ts";

export const UserModel = defineModel("User", {
  id: { type: "uuid", primary: true },
  email: { type: "string", unique: true, required: true },
  password: { type: "password", hidden: true },
  isStaff: { type: "boolean", default: false },
  isSuperuser: { type: "boolean", default: false },
}, {
  permissions: {
    create: "user.create",
    read: "user.read",
    update: "user.update",
    delete: "user.delete",
  },
});
