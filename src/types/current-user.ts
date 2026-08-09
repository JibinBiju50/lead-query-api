export const userRoles = [
  "owner",
  "admin",
  "manager",
  "agent",
] as const;

export type UserRole = (typeof userRoles)[number];

export type CurrentUser = {
  tenantId: string;
  userId: string;
  role: UserRole;
};