/** Roles and permissions are database rows in the API, so they are strings here. */
export type RoleName = string;
export type Permission = string;

export interface CurrentUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roles: RoleName[];
  permissions?: Permission[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
