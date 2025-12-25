// @oakseed/permissions/objectPolicy.ts

type ObjectPolicy = (ctx: {
  user: any;
  object: any;
}) => boolean;

const objectPolicies = new Map<string, ObjectPolicy>();

export function defineObjectPolicy(
  permission: string,
  policy: ObjectPolicy,
) {
  objectPolicies.set(permission, policy);
}

export function checkObjectPermission(
  user: any,
  permission: string,
  object: any,
) {
  const policy = objectPolicies.get(permission);
  if (!policy) return true;
  return policy({ user, object });
}
