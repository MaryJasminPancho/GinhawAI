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
export type AdminSession = { token: string; user_id: string; username: string; role: RoleName; expires_at: number };

const SESSION_KEY = "ginhawai_admin_session";

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
  const res = await request<{ access_token: string }>("/api/auth/login", { method: "POST", auth: false, body: json({ username, password }) });
  const claims = decodeJwt(res.access_token);
  const s: AdminSession = {
    token: res.access_token,
    user_id: String(claims.sub ?? ""),
    username: username.trim().toLowerCase(),
    role: String(claims.role ?? "") as RoleName,
    expires_at: typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + 60 * 60 * 1000,
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
export type DocumentReq = { doc_id: string; document_name: string; is_mandatory: boolean; notes: string | null };
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
export type StaffUser = { user_id: string; username: string; role_name: RoleName; office_id: string | null; is_active: boolean; last_login: string | null };
export type Role = { role_id: string; role_name: RoleName; description: string | null };

export const listStaff = () => request<StaffUser[]>("/api/admin-users");
export const listRoles = () => request<Role[]>("/api/roles");
export const createStaff = (u: { username: string; password: string; role_name: RoleName; office_id: string | null }) =>
  request<StaffUser>("/api/admin-users", { method: "POST", body: json(u) });
export const updateStaff = (userId: string, patch: { role_name?: RoleName; office_id?: string | null }) =>
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

export type SmsGatewayConfig = {
  sender_name: string;
  enabled: boolean;
  configured: boolean;
  key_source: string | null;
  api_key_masked: string | null;
  key_updated_at: string | null;
  credits_remaining: number | null;
};
export const getSmsGateway = () => request<SmsGatewayConfig>("/api/system/sms-gateway");
export const updateSmsGateway = (patch: { sender_name?: string; enabled?: boolean; api_key?: string }) =>
  request<SmsGatewayConfig>("/api/system/sms-gateway", { method: "PATCH", body: json(patch) });
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
