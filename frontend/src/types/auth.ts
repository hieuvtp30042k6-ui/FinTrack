export type UserRole = "super_admin" | "admin" | "user";

export function isValidRole(role: unknown): role is UserRole {
  return role === "super_admin" || role === "admin" || role === "user";
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "locked" | "blocked" | "inactive";
  avatar_url?: string | null;
  has_password?: boolean | null;
  google_connected?: boolean | null;
  google_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string | Array<{ msg: string; loc?: string[] }>;
}
