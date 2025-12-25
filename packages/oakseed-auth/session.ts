// @oakseed/auth/session.ts

const sessions = new Map<string, any>();

export function createSession(user: any) {
  const token = crypto.randomUUID();
  sessions.set(token, user);
  return token;
}

export function getSession(token: string) {
  return sessions.get(token);
}
