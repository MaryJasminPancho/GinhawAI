import { SMS_ENABLED } from "@/lib/features";

// Data layer for the admin console (/admin). Every call goes to the FastAPI
// backend at NEXT_PUBLIC_API_URL; there is no sample data here.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ===========================================================================
// ROLES (must match the roles table — see backend/db/seed_accounts.sql and
// seed_dev_admins.sql)
// ===========================================================================
export type RoleName = "System Administrator" | "LGU Administrator" | "Social Worker" | "LGU Executive" | "Partner Organization";
export type RoleGroup = "sysadmin" | "welfare" | "executive";

export function roleGroup(role: string): RoleGroup {
  if (role === "System Administrator") return "sysadmin";
  if (role === "LGU Executive" || role === "Partner Organization") return "executive";
  return "welfare";
}

// ===========================================================================
// SESSION (JWT kept in sessionStorage so it's cleared when the tab closes)
// ===========================================================================
export type AdminSession = {
  token: string;
  user_id: string;
  username: string;
  role: RoleName;
  expires_at: number;
  /** True while the account still uses a temporary password (new account or admin reset). */
  must_change_password?: boolean;
};

const SESSION_KEY = "ginhawai_admin_session";
const NOTICE_KEY = "ginhawai_admin_notice";

/** One-time message for the sign-in screen (e.g. why the session ended). */
export function takeSignInNotice(): string | null {
  try {
    const n = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return n;
  } catch {
    return null;
  }
}

function setSignInNotice(text: string) {
  try {
    sessionStorage.setItem(NOTICE_KEY, text);
  } catch {}
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AdminSession;
    if (s.expires_at && s.expires_at < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveAdminSession(s: AdminSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
}

export function clearAdminSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part));
  } catch {
    return {};
  }
}

export class AuthError extends Error {}

async function request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.auth !== false) {
    const s = getAdminSession();
    if (s) headers.Authorization = `Bearer ${s.token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(20000), headers: { ...headers, ...(init?.headers ?? {}) } });
  } catch {
    throw new Error("Can't reach the GinhawAI backend. Is it running?");
  }
  if (res.status === 401 && init?.auth !== false) {
    clearAdminSession();
    let why = "";
    try {
      why = (await res.json()).detail ?? "";
    } catch {}
    // A revoked session usually means a password change was approved or a reset happened.
    setSignInNotice(
      /revoked/i.test(why)
        ? "You were signed out because your password changed (or an administrator ended all sessions). Sign in with your current password."
        : "Your session has ended. Please sign in again."
    );
    throw new AuthError("Your session has ended. Please sign in again.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : Array.isArray(body.detail) ? body.detail.map((d: { msg?: string }) => d.msg).join("; ") : "";
    } catch {}
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown) => JSON.stringify(body);

export async function login(username: string, password: string): Promise<AdminSession> {
  const res = await request<{ access_token: string; must_change_password?: boolean }>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: json({ username, password }),
  });
  const claims = decodeJwt(res.access_token);
  const s: AdminSession = {
    token: res.access_token,
    user_id: String(claims.sub ?? ""),
    username: username.trim().toLowerCase(),
    role: String(claims.role ?? "") as RoleName,
    expires_at: typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + 60 * 60 * 1000,
    must_change_password: !!res.must_change_password,
  };
  saveAdminSession(s);
  return s;
}

export async function logout() {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {}
  clearAdminSession();
}

// ===========================================================================
// WELFARE CORE — programs, eligibility criteria, document requirements
// ===========================================================================
export type AdminProgram = { program_id: string; program_name: string; agency: string; scope: string; is_active: boolean };
export type Criterion = { criteria_id: string; attribute: string; operator: string; threshold_value: string; weight: number };
/** for_crisis: show only when the citizen's crisis is this type (null = always). */
export type DocumentReq = { doc_id: string; document_name: string; is_mandatory: boolean; notes: string | null; for_crisis: CrisisType | null };
export type CrisisType = "medical" | "death" | "fire" | "calamity" | "job_loss";
export const CRISIS_LABELS: Record<CrisisType, string> = {
  medical: "Medical / hospital",
  death: "Death in the family",
  fire: "Fire",
  calamity: "Flood / typhoon / calamity",
  job_loss: "Sudden loss of income",
};
export type AttributeMeta = { attribute: string; label: string; computed: boolean };

export const OPERATORS = ["<=", ">=", "<", ">", "=", "!=", "in"];

/** "Pantawid Pamilyang Pilipino Program (4Ps)" -> "4Ps" for charts. */
export function shortProgramName(name: string) {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : name.length > 28 ? `${name.slice(0, 26)}…` : name;
}

export const listPrograms = () => request<AdminProgram[]>("/api/programs");
export const createProgram = (p: Omit<AdminProgram, "program_id">) => request<AdminProgram>("/api/programs", { method: "POST", body: json(p) });
export const updateProgram = (id: string, patch: Partial<AdminProgram>) => request<AdminProgram>(`/api/programs/${id}`, { method: "PATCH", body: json(patch) });
export const listAttributes = () => request<AttributeMeta[]>("/api/meta/attributes", { auth: false });

export async function listCriteria(programId: string): Promise<Criterion[]> {
  const rows = await request<Criterion[]>(`/api/programs/${programId}/eligibility`);
  return rows.map((r) => ({ ...r, weight: Number(r.weight) }));
}

export async function saveCriterion(programId: string, c: Omit<Criterion, "criteria_id"> & { criteria_id?: string }): Promise<Criterion> {
  const { criteria_id, ...body } = c;
  const row = await request<Criterion>(criteria_id ? `/api/programs/${programId}/eligibility/${criteria_id}` : `/api/programs/${programId}/eligibility`, {
    method: criteria_id ? "PATCH" : "POST",
    body: json(body),
  });
  return { ...row, weight: Number(row.weight) };
}

export const deleteCriterion = (programId: string, criteriaId: string) =>
  request<void>(`/api/programs/${programId}/eligibility/${criteriaId}`, { method: "DELETE" });

export const listDocuments = (programId: string) => request<DocumentReq[]>(`/api/programs/${programId}/documents`);

export function saveDocument(programId: string, d: Omit<DocumentReq, "doc_id"> & { doc_id?: string }): Promise<DocumentReq> {
  const { doc_id, ...body } = d;
  return request<DocumentReq>(doc_id ? `/api/programs/${programId}/documents/${doc_id}` : `/api/programs/${programId}/documents`, {
    method: doc_id ? "PATCH" : "POST",
    body: json(body),
  });
}

export const deleteDocument = (programId: string, docId: string) => request<void>(`/api/programs/${programId}/documents/${docId}`, { method: "DELETE" });

// ===========================================================================
// LOCALIZATION — barangays, LGU offices, barangay schedules
// ===========================================================================
export type Barangay = { barangay_code: string; barangay_name: string; city_municipality: string; latitude: number | null; longitude: number | null };
export type Office = { office_id: string; office_name: string; address: string | null; barangay_code: string | null; contact_number: string | null; operating_hours: string | null };
export type Schedule = { schedule_id: string; office_id: string; program_id: string; start_date: string; end_date: string; notes: string | null };

export const listBarangays = () => request<Barangay[]>("/api/barangays");

export function saveBarangay(b: Barangay, isNew: boolean): Promise<Barangay> {
  return request<Barangay>(isNew ? "/api/barangays" : `/api/barangays/${encodeURIComponent(b.barangay_code)}`, { method: isNew ? "POST" : "PATCH", body: json(b) });
}

export const listOffices = () => request<Office[]>("/api/lgu-offices");

export function saveOffice(o: Omit<Office, "office_id"> & { office_id?: string }): Promise<Office> {
  const { office_id, ...body } = o;
  return request<Office>(office_id ? `/api/lgu-offices/${office_id}` : "/api/lgu-offices", { method: office_id ? "PATCH" : "POST", body: json(body) });
}

export const deleteOffice = (id: string) => request<void>(`/api/lgu-offices/${id}`, { method: "DELETE" });

export const listSchedules = () => request<Schedule[]>("/api/barangay-schedules");

export function saveSchedule(s: Omit<Schedule, "schedule_id"> & { schedule_id?: string }): Promise<Schedule> {
  const { schedule_id, ...body } = s;
  return request<Schedule>(schedule_id ? `/api/barangay-schedules/${schedule_id}` : "/api/barangay-schedules", {
    method: schedule_id ? "PATCH" : "POST",
    body: json(body),
  });
}

export const deleteSchedule = (id: string) => request<void>(`/api/barangay-schedules/${id}`, { method: "DELETE" });

// ===========================================================================
// AUDIT LOGS
// ===========================================================================
export type AuditLog = {
  audit_id: string;
  username: string;
  action_type: string;
  target_table: string;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
  flagged?: boolean;
  flag_reason?: string;
};

export const getAuditLogs = () => request<AuditLog[]>("/api/audit-logs?limit=2000");

// ===========================================================================
// STAFF ACCOUNTS (System Administrator)
// ===========================================================================
export type StaffUser = {
  user_id: string;
  username: string;
  full_name?: string | null;
  has_avatar?: boolean;
  avatar_updated_at?: string | null;
  role_name: RoleName;
  office_id: string | null;
  is_active: boolean;
  last_login: string | null;
  must_change_password?: boolean;
};
export type Role = { role_id: string; role_name: RoleName; description: string | null };

export const listStaff = () => request<StaffUser[]>("/api/admin-users");

// ---- Own profile: display name + profile picture ----
export type Profile = {
  user_id: string;
  username: string;
  full_name: string | null;
  role_name: RoleName;
  office_name: string | null;
  last_login: string | null;
  has_avatar: boolean;
  avatar_updated_at: string | null;
  /** e.g. "0917****567"; null if no verified number yet. */
  mobile_masked: string | null;
  mobile_verified_at: string | null;
  email_masked: string | null;
  email_verified_at: string | null;
};
export const getProfile = () => request<Profile>("/api/auth/profile");
// Mobile number for "forgot password" codes — confirmed with a code sent by SMS.
export const sendMobileCode = (mobile: string) => request<{ sent_to: string }>("/api/auth/profile/mobile", { method: "POST", body: json({ mobile }) });
export const verifyMobileCode = (code: string) => request<Profile>("/api/auth/profile/mobile/verify", { method: "POST", body: json({ code }) });
export const removeMobile = () => request<Profile>("/api/auth/profile/mobile", { method: "DELETE" });

// Email address for "forgot password" codes (free) — confirmed with a code sent by email.
export const sendEmailCode = (email: string) => request<{ sent_to: string }>("/api/auth/profile/email", { method: "POST", body: json({ email }) });
export const verifyEmailCode = (code: string) => request<Profile>("/api/auth/profile/email/verify", { method: "POST", body: json({ code }) });
export const removeEmail = () => request<Profile>("/api/auth/profile/email", { method: "DELETE" });

// Forgot password (signed out): SMS code, then the new password waits for approval.
export const forgotPasswordStart = (username: string) =>
  request<{ message: string }>("/api/auth/forgot-password/start", { method: "POST", auth: false, body: json({ username }) });
export const forgotPasswordComplete = (username: string, code: string, new_password: string) =>
  request<{ applied: boolean }>("/api/auth/forgot-password/complete", { method: "POST", auth: false, body: json({ username, code, new_password }) });
export const updateProfileName = (full_name: string) => request<Profile>("/api/auth/profile", { method: "PATCH", body: json({ full_name }) });
export const uploadAvatar = (data_url: string) => request<Profile>("/api/auth/profile/avatar", { method: "PUT", body: json({ data_url }) });
export const removeAvatar = () => request<Profile>("/api/auth/profile/avatar", { method: "DELETE" });
export const OWN_AVATAR_PATH = "/api/auth/profile/avatar";
export const staffAvatarPath = (userId: string) => `/api/admin-users/${userId}/avatar`;

/** Profile pictures need the sign-in token, so they're fetched and shown as blob: URLs. */
export async function fetchAvatarUrl(path: string): Promise<string | null> {
  const s = getAdminSession();
  if (!s) return null;
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${s.token}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

/** Crop the chosen photo to a centred square and shrink it to 256×256 before upload. */
export async function photoToAvatarDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 10 * 1024 * 1024) throw new Error("That photo is over 10 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That photo couldn't be opened."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    const webp = canvas.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- Password changes (every change needs a System Administrator's approval) ----
export type PasswordRequestStatus = "pending" | "approved" | "rejected";
export type MyPasswordRequest = {
  request_id: string;
  reason: "first_login" | "voluntary" | "forgot_password";
  status: PasswordRequestStatus;
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
};
export type PasswordRequestRow = MyPasswordRequest & { user_id: string; username: string; role_name: RoleName; decided_by: string | null };

export const getMyPasswordRequest = () => request<{ must_change_password: boolean; request: MyPasswordRequest | null }>("/api/auth/password-request");
export const requestPasswordChange = (current_password: string, new_password: string) =>
  request<{ request: MyPasswordRequest; applied: boolean }>("/api/auth/password-request", { method: "POST", body: json({ current_password, new_password }) });
export const cancelPasswordRequest = () => request<void>("/api/auth/password-request", { method: "DELETE" });
export const listPasswordRequests = (status: PasswordRequestStatus | "all" = "pending") =>
  request<PasswordRequestRow[]>(`/api/admin-users/password-requests?status=${status}`);
export const approvePasswordRequest = (id: string, note?: string) =>
  request<{ status: string }>(`/api/admin-users/password-requests/${id}/approve`, { method: "POST", body: json({ note: note ?? null }) });
// Viewing a requested password needs the System Administrator's own 4-digit PIN.
export const getRevealPin = () => request<{ has_pin: boolean; locked_until: string | null }>("/api/admin-users/reveal-pin");
export const setRevealPin = (current_password: string, pin: string) =>
  request<{ has_pin: boolean }>("/api/admin-users/reveal-pin", { method: "PUT", body: json({ current_password, pin }) });
export const revealRequestedPassword = (id: string, pin: string) =>
  request<{ password: string }>(`/api/admin-users/password-requests/${id}/reveal`, { method: "POST", body: json({ pin }) });

export const rejectPasswordRequest = (id: string, note: string) =>
  request<{ status: string }>(`/api/admin-users/password-requests/${id}/reject`, { method: "POST", body: json({ note }) });
export const listRoles = () => request<Role[]>("/api/roles");
export const createStaff = (u: { username: string; password: string; role_name: RoleName; office_id: string | null; full_name?: string | null }) =>
  request<StaffUser>("/api/admin-users", { method: "POST", body: json(u) });
export const updateStaff = (userId: string, patch: { role_name?: RoleName; office_id?: string | null; full_name?: string | null }) =>
  request<StaffUser>(`/api/admin-users/${userId}`, { method: "PATCH", body: json(patch) });
export const setStaffActive = (userId: string, active: boolean) =>
  request<void>(`/api/admin-users/${userId}/${active ? "activate" : "deactivate"}`, { method: "PATCH" });
export async function resetStaffPassword(userId: string): Promise<string> {
  return (await request<{ temporary_password: string }>(`/api/admin-users/${userId}/reset-password`, { method: "POST" })).temporary_password;
}

// ===========================================================================
// ANALYTICS (anonymized aggregates)
// ===========================================================================
export type Tier = "high" | "moderate" | "low";
export const TIERS: Tier[] = ["high", "moderate", "low"];

/** Distinct assessments per month × barangay × tier; `gap` = matched no program. */
export type AssessmentRow = { month: string; barangay_code: string | null; tier: Tier; count: number; gap: number };
/** Assessments that matched a program, per month × barangay × program × tier. */
export type MatchRow = { month: string; barangay_code: string | null; program_id: string; tier: Tier; count: number };
export type DemandData = { months: string[]; assessments: AssessmentRow[]; matches: MatchRow[] };

export const getDemand = (months = 12) => request<DemandData>(`/api/analytics/demand?months=${months}`);

export type SmsMonth = { month: string; sent: number; failed: number };
export type SmsLog = { sms_id: string; masked_recipient: string; program_id: string; program_name: string; delivery_status: string; sent_at: string };
export const getSmsStats = (months = 12) => request<{ months: SmsMonth[]; recent: SmsLog[] }>(`/api/analytics/sms?months=${months}`);

/** Checklist messages sent to citizens, by whichever channel is on (email while SMS is a future enhancement). */
export type DeliveryLog = { log_id: string; masked_recipient: string; program_id: string; program_name: string; delivery_status: string; sent_at: string };
export type DeliveryStats = { months: SmsMonth[]; recent: DeliveryLog[] };
export const getDeliveryStats = async (months = 12): Promise<DeliveryStats> => {
  if (SMS_ENABLED) {
    const s = await getSmsStats(months);
    return { months: s.months, recent: s.recent.map(({ sms_id, ...r }) => ({ log_id: sms_id, ...r })) };
  }
  return request<DeliveryStats>(`/api/analytics/email?months=${months}`);
};

export type Feedback = { feedback_id: string; sus_score: number; qualitative_feedback: string | null; submitted_at: string };
export const getFeedback = (months = 12) => request<Feedback[]>(`/api/analytics/feedback?months=${months}`);

export type DocDeficiency = { doc_id: string; document_name: string; program_id: string; program_name: string; missing_count: number; checked_count: number };
export const getDocumentDeficiency = (months = 12) => request<DocDeficiency[]>(`/api/analytics/documents?months=${months}`);

// ===========================================================================
// BLIND CROSS-VALIDATION
// ===========================================================================
export type SyntheticCase = {
  case_id: string;
  barangay: string;
  household_size: number;
  monthly_income: number;
  employment_status: string;
  age: number;
  housing_type: string;
  has_children_0_18: boolean;
  has_pwd: boolean;
  is_solo_parent: boolean;
  crisis_type: string;
};
export type Rating = { case_id: string; rater: string; tier: Tier };

export const getValidationCases = () => request<SyntheticCase[]>("/api/validation/cases");
export const generateValidationCases = (count: number) => request<{ created: number }>("/api/validation/cases/generate", { method: "POST", body: json({ count }) });
export const resetValidationCases = () => request<void>("/api/validation/cases", { method: "DELETE" });
export const getRatings = () => request<Rating[]>("/api/validation/ratings");
export const submitRating = (caseId: string, tier: Tier) => request<void>(`/api/validation/cases/${caseId}/rating`, { method: "PUT", body: json({ tier }) });
export const getModelTiers = () => request<Record<string, Tier>>("/api/validation/model-results");

// ===========================================================================
// SYSTEM ADMINISTRATOR
// ===========================================================================
export type ServiceStatus = { name: string; status: "up" | "degraded" | "down"; detail: string; latency_ms?: number | null };

export async function getSystemHealth(): Promise<ServiceStatus[]> {
  const timed = async (name: string, path: string, pick: (b: Record<string, string>) => string): Promise<ServiceStatus> => {
    const t = performance.now();
    try {
      const body = await request<Record<string, string>>(path, { auth: false });
      return { name, status: "up", detail: pick(body), latency_ms: Math.round(performance.now() - t) };
    } catch (e) {
      return { name, status: "down", detail: e instanceof Error ? e.message : "Unreachable", latency_ms: null };
    }
  };
  const core = await Promise.all([
    timed("FastAPI backend", "/", (b) => b.status),
    timed("PostgreSQL", "/health/db", (b) => String(b.postgres_version ?? "").split(" on ")[0] || "connected"),
    timed("Redis session cache", "/health/redis", (b) => b.redis),
  ]);
  let extra: ServiceStatus[] = [];
  try {
    extra = await request<ServiceStatus[]>("/api/system/services");
  } catch {}
  return [...core, ...extra];
}

export type CacheStats = { active_sessions: number; keys: number; memory_mb: number | null; ttl_minutes: number; purged?: number };
export const getCacheStats = () => request<CacheStats>("/api/system/cache");
export const purgeCache = (scope: "idle" | "all") => request<CacheStats>(`/api/system/cache/purge?scope=${scope}`, { method: "POST" });
export const setCacheTtl = (minutes: number) => request<{ ttl_minutes: number }>("/api/system/cache/ttl", { method: "PUT", body: json({ minutes }) });

export type TableInfo = { table: string; module: string; rows: number; size_kb: number };
export type DatabaseInfo = { version: string; size_mb: number; pool_size: number; pool_idle: number; tables: TableInfo[] };
export const getDatabaseInfo = () => request<DatabaseInfo>("/api/system/database");

export type SmsProvider = "semaphore" | "android";
export type SmsGatewayConfig = {
  provider: SmsProvider;
  sender_name: string;
  enabled: boolean;
  /** The selected provider has everything it needs. */
  configured: boolean;
  semaphore_configured: boolean;
  android_url: string;
  android_username: string;
  android_password_set: boolean;
  key_source: string | null;
  api_key_masked: string | null;
  key_updated_at: string | null;
  credits_remaining: number | null;
};
export const getSmsGateway = () => request<SmsGatewayConfig>("/api/system/sms-gateway");
export type SmsGatewayPatch = {
  sender_name?: string;
  enabled?: boolean;
  api_key?: string;
  provider?: SmsProvider;
  android_url?: string;
  android_username?: string;
  android_password?: string;
};
export const updateSmsGateway = (patch: SmsGatewayPatch) =>
  request<SmsGatewayConfig>("/api/system/sms-gateway", { method: "PATCH", body: json(patch) });
export type EmailLog = { email_id: string; masked_recipient: string; program_name: string; delivery_status: string; sent_at: string };
export type EmailGatewayConfig = {
  enabled: boolean;
  configured: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  password_set: boolean;
  from_name: string;
  sent_this_month: number;
  failed_this_month: number;
  recent: EmailLog[];
};
export type EmailGatewayPatch = { enabled?: boolean; smtp_host?: string; smtp_port?: number; smtp_username?: string; smtp_password?: string; from_name?: string };
export const getEmailGateway = () => request<EmailGatewayConfig>("/api/system/email-gateway");
export const updateEmailGateway = (patch: EmailGatewayPatch) => request<EmailGatewayConfig>("/api/system/email-gateway", { method: "PATCH", body: json(patch) });
export const sendTestEmail = (email: string) => request<{ status: string }>("/api/system/email-gateway/test", { method: "POST", body: json({ email }) });
export const sendTestSms = (number: string) => request<{ status: string }>("/api/system/sms-gateway/test", { method: "POST", body: json({ number }) });

export type SecurityPolicy = {
  jwt_expire_minutes: number;
  password_min_length: number;
  max_failed_logins: number;
  lockout_minutes: number;
  rate_limit_per_minute: number;
  allowed_origins: string[];
  purge_on_session_end: boolean;
};
export const getSecurityPolicy = () => request<SecurityPolicy>("/api/system/security-policy");
export const updateSecurityPolicy = (p: SecurityPolicy) => request<SecurityPolicy>("/api/system/security-policy", { method: "PUT", body: json(p) });
export const revokeAllSessions = () => request<{ revoked: number }>("/api/system/revoke-sessions", { method: "POST" });
