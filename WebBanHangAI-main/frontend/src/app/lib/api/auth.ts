import { apiGet, apiPost, apiPut } from "../apiClient";

export interface ApiUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  role: "customer" | "staff" | "admin";
}

export interface RegisterUserPayload {
  username: string;
  password: string;
  full_name: string;
  phone?: string;
  gender?: string;
  birthday?: string;
  address_line?: string;
  ward?: string;
  district?: string;
  province?: string;
}

export async function loginUser(
  username: string,
  password: string,
): Promise<{ user: ApiUser; access?: string }> {
  const response = await apiPost<{ user: ApiUser; access?: string }>(
    `/products/auth/login/`,
    {
      username,
      password,
    },
    false,
  );
  return response;
}

export async function registerUser(
  data: RegisterUserPayload,
): Promise<{ detail: string; email: string; requires_otp: boolean; dev_otp?: string }> {
  const response = await apiPost<{ detail: string; email: string; requires_otp: boolean; dev_otp?: string }>(
    `/products/auth/register/`,
    {
      ...data,
    },
    false,
  );
  return response;
}

export function verifyRegistrationOtp(email: string, otp: string) {
  return apiPost<{ detail: string }>(
    `/auth/register/verify-otp`,
    { email, otp },
    false,
  );
}

export function resendRegistrationOtp(email: string) {
  return apiPost<{ detail: string; dev_otp?: string }>(
    `/auth/register/resend-otp`,
    { email },
    false,
  );
}

export function requestPasswordReset(email: string) {
  return apiPost<{ detail: string; dev_otp?: string }>(
    `/auth/forgot-password`,
    { email },
    false,
  );
}

export function verifyPasswordResetOtp(email: string, otp: string) {
  return apiPost<{ detail: string; reset_token: string }>(
    `/auth/forgot-password/verify-otp`,
    { email, otp },
    false,
  );
}

export function resetPassword(resetToken: string, password: string) {
  return apiPost<{ detail: string }>(
    `/auth/reset-password`,
    { reset_token: resetToken, password },
    false,
  );
}

export async function fetchProfile(userId: number): Promise<ApiUser> {
  void userId;
  return apiGet<ApiUser>(`/products/profile/`);
}

export async function updateProfile(
  userId: number,
  data: Partial<Pick<ApiUser, "full_name" | "phone">>,
): Promise<ApiUser> {
  void userId;
  return apiPut<ApiUser>(`/products/profile/`, data);
}
