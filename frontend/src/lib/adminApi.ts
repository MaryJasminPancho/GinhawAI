// Data layer for the admin side (/admin).
//
// Follows the same rules as lib/api.ts:
//   NEXT_PUBLIC_USE_MOCK=true  -> everything uses the fake data below.
//   otherwise                  -> calls the FastAPI backend where an endpoint exists.
//
// Some features in the manuscript have NO backend endpoint yet (schedules, audit
// logs, analytics, validation, SMS gateway, security policy, cache control).
// Those always use mock data for now, and the page shows a "Sample data" notice.
// `LIVE` below says which is which — flip an entry to true once the endpoint exists.
// Lines marked CHECK are guesses about endpoint paths/field names.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export const LIVE = {
  auth: !USE_MOCK,
  programs: !USE_MOCK, // GET/POST exist; PATCH/DELETE are CHECK
  offices: !USE_MOCK, // GET/POST exist; PATCH/DELETE are CHECK
  barangays: !USE_MOCK,
  staff: !USE_MOCK, // GET + deactivate exist; create/activate are CHECK
  health: !USE_MOCK, // /health/db and /health/redis exist
  schedules: false,
  auditLogs: false,
  analytics: false,
  validation: false,
  smsGateway: false,
  security: false,
  cache: false,
};

// ===========================================================================
// ROLES
// The first three match backend/db/seed_accounts.sql. The executive roles come
// from the manuscript's use case diagram (Fig. 10) and still need to be added to
// the roles seed. CHECK
// ===========================================================================
export type RoleName =
  | "System Administrator"
  | "LGU Administrator"
  | "Social Worker"
  | "LGU Executive"
  | "Partner Organization";

export type RoleGroup = "sysadmin" | "welfare" | "executive";

export function roleGroup(role: string): RoleGroup {
  if (role === "System Administrator") return "sysadmin";
  if (role === "LGU Executive" || role === "Partner Organization") return "executive";
  return "welfare";
}

export const ALL_ROLES: RoleName[] = [
  "System Administrator",
  "LGU Administrator",
  "Social Worker",
  "LGU Executive",
  "Partner Organization",
];

// ===========================================================================
// SESSION (JWT kept in sessionStorage so it's cleared when the tab closes)
// ===========================================================================
export type AdminSession = {
  token: string;
  user_id: string;
  username: string;
  role: RoleName;
  expires_at: number; // ms epoch
};

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
  } catch {
    // Storage blocked: the user will just need to sign in again on reload.
  }
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
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (res.status === 401) {
    clearAdminSession();
    throw new AuthError("Your session has expired. Please sign in again.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {}
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;

// Seeded random so mock numbers stay the same between reloads.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ---- Mock accounts (password for all: ginhawai123) ----
export const DEMO_ACCOUNTS: { username: string; role: RoleName }[] = [
  { username: "sysadmin", role: "System Administrator" },
  { username: "lguadmin", role: "LGU Administrator" },
  { username: "socialworker", role: "Social Worker" },
  { username: "executive", role: "LGU Executive" },
  { username: "partner", role: "Partner Organization" },
];

export async function login(username: string, password: string): Promise<AdminSession> {
  if (!LIVE.auth) {
    await wait(500);
    const acct = DEMO_ACCOUNTS.find((a) => a.username === username.trim().toLowerCase());
    if (!acct || password !== "ginhawai123") throw new Error("Invalid username or password");
    const s: AdminSession = {
      token: "mock-token",
      user_id: `mock-${acct.username}`,
      username: acct.username,
      role: acct.role,
      expires_at: Date.now() + 60 * 60 * 1000,
    };
    saveAdminSession(s);
    addAudit(s.username, "LOGIN", "admin_users", null, `Signed in as ${acct.role}`);
    return s;
  }
  const res = await request<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ username, password }),
  });
  const claims = decodeJwt(res.access_token);
  const s: AdminSession = {
    token: res.access_token,
    user_id: String(claims.sub ?? ""),
    username,
    role: String(claims.role ?? "Social Worker") as RoleName,
    expires_at: typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + 60 * 60 * 1000,
  };
  saveAdminSession(s);
  return s;
}

export function logout() {
  const s = getAdminSession();
  if (s && !LIVE.auth) addAudit(s.username, "LOGOUT", "admin_users", null, "Signed out");
  clearAdminSession();
}

function currentUsername() {
  return getAdminSession()?.username ?? "unknown";
}

// ===========================================================================
// AUDIT LOGS (Table 12)
// ===========================================================================
export type AuditLog = {
  audit_id: string;
  username: string; // CHECK: backend table stores user_id; the list endpoint should join username
  action_type: string; // INSERT | UPDATE | DELETE | LOGIN | LOGOUT | FAILED_LOGIN | PURGE
  target_table: string;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
  flagged?: boolean; // "Flag Anomalous Access Patterns"
};

const mockAudit: AuditLog[] = (() => {
  const r = seeded(7);
  const users = ["lguadmin", "socialworker", "sysadmin", "executive"];
  const events: [string, string, string | null, string | null][] = [
    ["UPDATE", "eligibility_criteria", "monthly_income <= 12000", "monthly_income <= 12030"],
    ["INSERT", "barangay_schedules", null, "TUPAD registration · Pardo · Oct 6–10"],
    ["UPDATE", "lgu_offices", "Mon–Fri, 8:00 AM – 5:00 PM", "Mon–Sat, 8:00 AM – 5:00 PM"],
    ["INSERT", "document_requirements", null, "Barangay Certificate of Indigency"],
    ["LOGIN", "admin_users", null, "Signed in"],
    ["UPDATE", "programs", "is_active = true", "is_active = false"],
    ["DELETE", "barangay_schedules", "Feeding program · Tisa · Aug 2", null],
    ["PURGE", "session_cache", "412 keys", "0 keys"],
  ];
  const out: AuditLog[] = [];
  let t = new Date("2026-09-24T09:30:00+08:00").getTime();
  for (let i = 0; i < 46; i++) {
    const e = events[Math.floor(r() * events.length)];
    t -= Math.floor(r() * 9 * 3600 * 1000) + 600000;
    out.push({
      audit_id: `a-${i}`,
      username: e[0] === "PURGE" ? "sysadmin" : users[Math.floor(r() * users.length)],
      action_type: e[0],
      target_table: e[1],
      old_value: e[2],
      new_value: e[3],
      timestamp: new Date(t).toISOString(),
    });
  }
  // A small burst of failed logins at night, to show the anomaly flag.
  const night = new Date("2026-09-23T02:14:00+08:00").getTime();
  for (let i = 0; i < 5; i++) {
    out.push({
      audit_id: `f-${i}`,
      username: "lguadmin",
      action_type: "FAILED_LOGIN",
      target_table: "admin_users",
      old_value: null,
      new_value: "Invalid password · 112.198.x.x",
      timestamp: new Date(night + i * 40000).toISOString(),
      flagged: true,
    });
  }
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
})();

function addAudit(username: string, action: string, table: string, oldV: string | null, newV: string | null) {
  mockAudit.unshift({
    audit_id: uid(),
    username,
    action_type: action,
    target_table: table,
    old_value: oldV,
    new_value: newV,
    timestamp: new Date().toISOString(),
  });
}
const audit = (action: string, table: string, oldV: string | null, newV: string | null) =>
  addAudit(currentUsername(), action, table, oldV, newV);

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (!LIVE.auditLogs) {
    await wait(250);
    return [...mockAudit];
  }
  return request<AuditLog[]>("/api/audit-logs"); // CHECK: endpoint not built yet
}

// ===========================================================================
// WELFARE CORE — programs, eligibility criteria, document requirements (Tables 7–9)
// ===========================================================================
export type AdminProgram = {
  program_id: string;
  program_name: string;
  agency: string;
  scope: string; // National | Municipal | Barangay
  is_active: boolean;
};

export type Criterion = {
  criteria_id: string;
  attribute: string;
  operator: string;
  threshold_value: string;
  weight: number;
};

export type DocumentReq = {
  doc_id: string;
  document_name: string;
  is_mandatory: boolean;
  notes: string | null;
};

// Household attributes the chat collects (keep in sync with the assessment slots).
export const ATTRIBUTES = [
  "monthly_income",
  "household_size",
  "children_0_18",
  "employment_status",
  "housing_type",
  "barangay_code",
  "is_pwd",
  "is_solo_parent",
  "is_senior_citizen",
  "crisis_type",
  "age",
];
export const OPERATORS = ["<=", ">=", "<", ">", "==", "!=", "in"];

const mockPrograms: AdminProgram[] = [
  { program_id: "p-4ps", program_name: "Pantawid Pamilyang Pilipino Program (4Ps)", agency: "DSWD", scope: "National", is_active: true },
  { program_id: "p-aics", program_name: "Assistance to Individuals in Crisis Situations (AICS)", agency: "DSWD", scope: "National", is_active: true },
  { program_id: "p-tupad", program_name: "Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)", agency: "DOLE", scope: "National", is_active: true },
  { program_id: "p-feed", program_name: "Barangay Supplemental Feeding Program", agency: "Cebu City Health Department", scope: "Barangay", is_active: true },
  { program_id: "p-senior", program_name: "Cebu City Senior Citizens Financial Assistance", agency: "Cebu City DSWS", scope: "Municipal", is_active: false },
];

const mockCriteria: Record<string, Criterion[]> = {
  "p-4ps": [
    { criteria_id: uid(), attribute: "monthly_income", operator: "<=", threshold_value: "12030", weight: 0.35 },
    { criteria_id: uid(), attribute: "children_0_18", operator: ">=", threshold_value: "1", weight: 0.3 },
    { criteria_id: uid(), attribute: "household_size", operator: ">=", threshold_value: "3", weight: 0.15 },
    { criteria_id: uid(), attribute: "housing_type", operator: "in", threshold_value: "informal,rented", weight: 0.2 },
  ],
  "p-aics": [
    { criteria_id: uid(), attribute: "crisis_type", operator: "in", threshold_value: "medical,burial,fire,flood", weight: 0.6 },
    { criteria_id: uid(), attribute: "monthly_income", operator: "<=", threshold_value: "20000", weight: 0.4 },
  ],
  "p-tupad": [
    { criteria_id: uid(), attribute: "employment_status", operator: "in", threshold_value: "displaced,underemployed,unemployed", weight: 0.5 },
    { criteria_id: uid(), attribute: "age", operator: ">=", threshold_value: "18", weight: 0.2 },
    { criteria_id: uid(), attribute: "monthly_income", operator: "<=", threshold_value: "15000", weight: 0.3 },
  ],
  "p-feed": [
    { criteria_id: uid(), attribute: "children_0_18", operator: ">=", threshold_value: "1", weight: 0.5 },
    { criteria_id: uid(), attribute: "barangay_code", operator: "in", threshold_value: "0730600034,0730600022", weight: 0.5 },
  ],
  "p-senior": [
    { criteria_id: uid(), attribute: "is_senior_citizen", operator: "==", threshold_value: "true", weight: 1 },
  ],
};

const mockDocs: Record<string, DocumentReq[]> = {
  "p-4ps": [
    { doc_id: uid(), document_name: "Birth certificates of children (PSA)", is_mandatory: true, notes: null },
    { doc_id: uid(), document_name: "Barangay Certificate of Residency", is_mandatory: true, notes: "Request from your barangay hall." },
    { doc_id: uid(), document_name: "Valid government ID of household head", is_mandatory: true, notes: null },
  ],
  "p-aics": [
    { doc_id: uid(), document_name: "Certificate of Indigency", is_mandatory: true, notes: null },
    { doc_id: uid(), document_name: "Medical abstract / prescription or death certificate", is_mandatory: true, notes: "Depends on the type of crisis." },
    { doc_id: uid(), document_name: "Valid ID", is_mandatory: true, notes: null },
  ],
  "p-tupad": [
    { doc_id: uid(), document_name: "TUPAD profile form", is_mandatory: true, notes: "Available at the DOLE field office or barangay." },
    { doc_id: uid(), document_name: "Valid ID", is_mandatory: true, notes: null },
    { doc_id: uid(), document_name: "Certificate of displacement / employment", is_mandatory: false, notes: null },
  ],
  "p-feed": [{ doc_id: uid(), document_name: "Child's health record / baby book", is_mandatory: false, notes: null }],
  "p-senior": [{ doc_id: uid(), document_name: "OSCA ID", is_mandatory: true, notes: null }],
};

export async function listPrograms(): Promise<AdminProgram[]> {
  if (!LIVE.programs) {
    await wait(250);
    return mockPrograms.map((p) => ({ ...p }));
  }
  return request<AdminProgram[]>("/api/programs");
}

export async function createProgram(p: Omit<AdminProgram, "program_id">): Promise<AdminProgram> {
  if (!LIVE.programs) {
    await wait(300);
    const row = { ...p, program_id: uid() };
    mockPrograms.push(row);
    mockCriteria[row.program_id] = [];
    mockDocs[row.program_id] = [];
    audit("INSERT", "programs", null, row.program_name);
    return row;
  }
  return request<AdminProgram>("/api/programs", { method: "POST", body: JSON.stringify(p) });
}

export async function updateProgram(id: string, patch: Partial<AdminProgram>): Promise<AdminProgram> {
  if (!LIVE.programs) {
    await wait(250);
    const row = mockPrograms.find((p) => p.program_id === id)!;
    const before = JSON.stringify({ is_active: row.is_active, program_name: row.program_name });
    Object.assign(row, patch);
    audit("UPDATE", "programs", before, JSON.stringify(patch));
    return { ...row };
  }
  // CHECK: PATCH /api/programs/{id} does not exist in the backend yet.
  return request<AdminProgram>(`/api/programs/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function listCriteria(programId: string): Promise<Criterion[]> {
  if (!LIVE.programs) {
    await wait(200);
    return (mockCriteria[programId] ?? []).map((c) => ({ ...c }));
  }
  return request<Criterion[]>(`/api/programs/${programId}/eligibility`);
}

export async function saveCriterion(programId: string, c: Omit<Criterion, "criteria_id"> & { criteria_id?: string }): Promise<Criterion> {
  const text = (x: Omit<Criterion, "criteria_id">) => `${x.attribute} ${x.operator} ${x.threshold_value} (w=${x.weight})`;
  if (!LIVE.programs) {
    await wait(250);
    const list = (mockCriteria[programId] ??= []);
    if (c.criteria_id) {
      const row = list.find((x) => x.criteria_id === c.criteria_id)!;
      audit("UPDATE", "eligibility_criteria", text(row), text(c));
      Object.assign(row, c);
      return { ...row };
    }
    const row = { ...c, criteria_id: uid() };
    list.push(row);
    audit("INSERT", "eligibility_criteria", null, text(c));
    return row;
  }
  if (c.criteria_id) {
    // CHECK: PATCH endpoint not built yet.
    return request<Criterion>(`/api/programs/${programId}/eligibility/${c.criteria_id}`, { method: "PATCH", body: JSON.stringify(c) });
  }
  return request<Criterion>(`/api/programs/${programId}/eligibility`, { method: "POST", body: JSON.stringify(c) });
}

export async function deleteCriterion(programId: string, criteriaId: string): Promise<void> {
  if (!LIVE.programs) {
    await wait(200);
    const list = mockCriteria[programId] ?? [];
    const i = list.findIndex((x) => x.criteria_id === criteriaId);
    if (i >= 0) {
      audit("DELETE", "eligibility_criteria", `${list[i].attribute} ${list[i].operator} ${list[i].threshold_value}`, null);
      list.splice(i, 1);
    }
    return;
  }
  // CHECK: DELETE endpoint not built yet.
  return request<void>(`/api/programs/${programId}/eligibility/${criteriaId}`, { method: "DELETE" });
}

export async function listDocuments(programId: string): Promise<DocumentReq[]> {
  if (!LIVE.programs) {
    await wait(200);
    return (mockDocs[programId] ?? []).map((d) => ({ ...d }));
  }
  return request<DocumentReq[]>(`/api/programs/${programId}/documents`);
}

export async function saveDocument(programId: string, d: Omit<DocumentReq, "doc_id"> & { doc_id?: string }): Promise<DocumentReq> {
  if (!LIVE.programs) {
    await wait(250);
    const list = (mockDocs[programId] ??= []);
    if (d.doc_id) {
      const row = list.find((x) => x.doc_id === d.doc_id)!;
      audit("UPDATE", "document_requirements", row.document_name, d.document_name);
      Object.assign(row, d);
      return { ...row };
    }
    const row = { ...d, doc_id: uid() };
    list.push(row);
    audit("INSERT", "document_requirements", null, d.document_name);
    return row;
  }
  if (d.doc_id) {
    // CHECK: PATCH endpoint not built yet.
    return request<DocumentReq>(`/api/programs/${programId}/documents/${d.doc_id}`, { method: "PATCH", body: JSON.stringify(d) });
  }
  return request<DocumentReq>(`/api/programs/${programId}/documents`, { method: "POST", body: JSON.stringify(d) });
}

export async function deleteDocument(programId: string, docId: string): Promise<void> {
  if (!LIVE.programs) {
    await wait(200);
    const list = mockDocs[programId] ?? [];
    const i = list.findIndex((x) => x.doc_id === docId);
    if (i >= 0) {
      audit("DELETE", "document_requirements", list[i].document_name, null);
      list.splice(i, 1);
    }
    return;
  }
  // CHECK: DELETE endpoint not built yet.
  return request<void>(`/api/programs/${programId}/documents/${docId}`, { method: "DELETE" });
}

// ===========================================================================
// LOCALIZATION — barangays, LGU offices, barangay schedules (Tables 13–15)
// ===========================================================================
export type Barangay = {
  barangay_code: string;
  barangay_name: string;
  city_municipality: string;
  // CHECK: the barangays table has no coordinates yet. The heatmap needs lat/lng
  // (add two columns, or keep a static lookup on the frontend like below).
  lat?: number;
  lng?: number;
};

export type Office = {
  office_id: string;
  office_name: string;
  address: string | null;
  barangay_code: string | null;
  contact_number: string | null;
  operating_hours: string | null;
};

export type Schedule = {
  schedule_id: string;
  office_id: string;
  program_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  notes: string | null;
};

// Approximate centre points of Cebu City barangays (for the map only).
const BARANGAY_COORDS: Record<string, [string, number, number]> = {
  "0730600034": ["Kalunasan", 10.3285, 123.8805],
  "0730600022": ["Guadalupe", 10.3196, 123.8906],
  "0730600043": ["Lahug", 10.3325, 123.8985],
  "0730600046": ["Mabolo", 10.3187, 123.9154],
  "0730600073": ["Talamban", 10.3665, 123.9128],
  "0730600009": ["Banilad", 10.3437, 123.9121],
  "0730600060": ["Pardo", 10.2830, 123.8520],
  "0730600077": ["Tisa", 10.2983, 123.8700],
  "0730600041": ["Labangon", 10.3000, 123.8820],
  "0730600011": ["Basak San Nicolas", 10.2880, 123.8680],
  "0730600064": ["Punta Princesa", 10.3040, 123.8740],
  "0730600029": ["Ermita", 10.2930, 123.8990],
  "0730600067": ["Sambag I", 10.3055, 123.8930],
  "0730600017": ["Capitol Site", 10.3150, 123.8910],
  "0730600014": ["Busay", 10.3710, 123.8870],
  "0730600048": ["Mambaling", 10.2870, 123.8800],
  "0730600024": ["Inayawan", 10.2700, 123.8540],
  "0730600031": ["Kasambagan", 10.3290, 123.9120],
};

const mockBarangays: Barangay[] = Object.entries(BARANGAY_COORDS).map(([code, [name, lat, lng]]) => ({
  barangay_code: code,
  barangay_name: name,
  city_municipality: "Cebu City",
  lat,
  lng,
}));

export async function listBarangays(): Promise<Barangay[]> {
  if (!LIVE.barangays) {
    await wait(150);
    return mockBarangays.map((b) => ({ ...b }));
  }
  const rows = await request<Barangay[]>("/api/barangays");
  return rows.map((b) => {
    const c = BARANGAY_COORDS[b.barangay_code];
    return c ? { ...b, lat: c[1], lng: c[2] } : b;
  });
}

const mockOffices: Office[] = [
  { office_id: "o-dswd7", office_name: "DSWD Field Office VII", address: "M.J. Cuenco Ave., cor. Gen. Maxilom Ave., Cebu City", barangay_code: "0730600046", contact_number: "(032) 232-9505", operating_hours: "Mon–Fri, 8:00 AM – 5:00 PM" },
  { office_id: "o-dsws", office_name: "Cebu City Dept. of Social Welfare & Services", address: "Cebu City Hall, M.C. Briones St., Cebu City", barangay_code: "0730600029", contact_number: "(032) 255-6984", operating_hours: "Mon–Fri, 8:00 AM – 5:00 PM" },
  { office_id: "o-dole", office_name: "DOLE Cebu Provincial Field Office", address: "Gen. Maxilom Ave. Ext., Cebu City", barangay_code: "0730600017", contact_number: "(032) 266-9722", operating_hours: "Mon–Fri, 8:00 AM – 5:00 PM" },
  { office_id: "o-kal", office_name: "Barangay Kalunasan Hall", address: "Kalunasan, Cebu City", barangay_code: "0730600034", contact_number: "0917 000 1234", operating_hours: "Mon–Sat, 8:00 AM – 5:00 PM" },
  { office_id: "o-guad-hc", office_name: "Guadalupe Health Center", address: "V. Rama Ave., Guadalupe, Cebu City", barangay_code: "0730600022", contact_number: null, operating_hours: "Mon–Fri, 8:00 AM – 4:00 PM" },
];

export async function listOffices(): Promise<Office[]> {
  if (!LIVE.offices) {
    await wait(250);
    return mockOffices.map((o) => ({ ...o }));
  }
  return request<Office[]>("/api/lgu-offices");
}

export async function saveOffice(o: Omit<Office, "office_id"> & { office_id?: string }): Promise<Office> {
  if (!LIVE.offices) {
    await wait(300);
    if (o.office_id) {
      const row = mockOffices.find((x) => x.office_id === o.office_id)!;
      audit("UPDATE", "lgu_offices", `${row.office_name} · ${row.operating_hours ?? ""}`, `${o.office_name} · ${o.operating_hours ?? ""}`);
      Object.assign(row, o);
      return { ...row };
    }
    const row = { ...o, office_id: uid() } as Office;
    mockOffices.push(row);
    audit("INSERT", "lgu_offices", null, row.office_name);
    return row;
  }
  if (o.office_id) {
    // CHECK: PATCH /api/lgu-offices/{id} not built yet.
    return request<Office>(`/api/lgu-offices/${o.office_id}`, { method: "PATCH", body: JSON.stringify(o) });
  }
  return request<Office>("/api/lgu-offices", { method: "POST", body: JSON.stringify(o) });
}

const mockSchedules: Schedule[] = [
  { schedule_id: uid(), office_id: "o-dole", program_id: "p-tupad", start_date: "2026-10-06", end_date: "2026-10-10", notes: "Registration for displaced workers in Pardo & Inayawan. Bring valid ID." },
  { schedule_id: uid(), office_id: "o-kal", program_id: "p-feed", start_date: "2026-09-28", end_date: "2026-11-27", notes: "Every Mon/Wed/Fri 9–11 AM for children 2–5 years old." },
  { schedule_id: uid(), office_id: "o-dswd7", program_id: "p-4ps", start_date: "2026-10-15", end_date: "2026-10-17", notes: "Household assessment (Listahanan) validation." },
  { schedule_id: uid(), office_id: "o-dsws", program_id: "p-aics", start_date: "2026-09-01", end_date: "2026-12-18", notes: "Walk-in crisis assistance, first 50 clients daily." },
  { schedule_id: uid(), office_id: "o-guad-hc", program_id: "p-feed", start_date: "2026-08-03", end_date: "2026-09-18", notes: "Supplemental feeding cycle 2." },
];

export async function listSchedules(): Promise<Schedule[]> {
  if (!LIVE.schedules) {
    await wait(250);
    return mockSchedules.map((s) => ({ ...s }));
  }
  return request<Schedule[]>("/api/barangay-schedules"); // CHECK
}

export async function saveSchedule(s: Omit<Schedule, "schedule_id"> & { schedule_id?: string }): Promise<Schedule> {
  const text = (x: Omit<Schedule, "schedule_id">) => `${x.program_id} @ ${x.office_id} · ${x.start_date} → ${x.end_date}`;
  if (!LIVE.schedules) {
    await wait(300);
    if (s.schedule_id) {
      const row = mockSchedules.find((x) => x.schedule_id === s.schedule_id)!;
      audit("UPDATE", "barangay_schedules", text(row), text(s));
      Object.assign(row, s);
      return { ...row };
    }
    const row = { ...s, schedule_id: uid() } as Schedule;
    mockSchedules.push(row);
    audit("INSERT", "barangay_schedules", null, text(s));
    return row;
  }
  return request<Schedule>(s.schedule_id ? `/api/barangay-schedules/${s.schedule_id}` : "/api/barangay-schedules", {
    method: s.schedule_id ? "PATCH" : "POST",
    body: JSON.stringify(s),
  }); // CHECK
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!LIVE.schedules) {
    await wait(200);
    const i = mockSchedules.findIndex((x) => x.schedule_id === id);
    if (i >= 0) {
      const s = mockSchedules[i];
      audit("DELETE", "barangay_schedules", `${s.program_id} · ${s.start_date} → ${s.end_date}`, null);
      mockSchedules.splice(i, 1);
    }
    return;
  }
  return request<void>(`/api/barangay-schedules/${id}`, { method: "DELETE" }); // CHECK
}

// ===========================================================================
// STAFF ACCOUNTS (Table 11) — System Administrator only
// ===========================================================================
export type StaffUser = {
  user_id: string;
  username: string;
  role_name: RoleName;
  office_id?: string | null; // CHECK: GET /api/admin-users doesn't return office yet
  is_active: boolean;
  last_login: string | null;
};

const mockStaff: StaffUser[] = [
  { user_id: "mock-sysadmin", username: "sysadmin", role_name: "System Administrator", office_id: "o-dsws", is_active: true, last_login: "2026-09-24T08:02:00+08:00" },
  { user_id: "mock-lguadmin", username: "lguadmin", role_name: "LGU Administrator", office_id: "o-dsws", is_active: true, last_login: "2026-09-24T07:45:00+08:00" },
  { user_id: "mock-socialworker", username: "socialworker", role_name: "Social Worker", office_id: "o-dswd7", is_active: true, last_login: "2026-09-23T16:20:00+08:00" },
  { user_id: "mock-rsantos", username: "rsantos", role_name: "Social Worker", office_id: "o-kal", is_active: true, last_login: "2026-09-20T10:11:00+08:00" },
  { user_id: "mock-executive", username: "executive", role_name: "LGU Executive", office_id: "o-dsws", is_active: true, last_login: "2026-09-22T13:30:00+08:00" },
  { user_id: "mock-partner", username: "partner", role_name: "Partner Organization", office_id: null, is_active: true, last_login: null },
  { user_id: "mock-jreyes", username: "jreyes", role_name: "LGU Administrator", office_id: "o-dole", is_active: false, last_login: "2026-06-02T09:00:00+08:00" },
];

export async function listStaff(): Promise<StaffUser[]> {
  if (!LIVE.staff) {
    await wait(250);
    return mockStaff.map((u) => ({ ...u }));
  }
  return request<StaffUser[]>("/api/admin-users");
}

export async function createStaff(u: { username: string; password: string; role_name: RoleName; office_id: string | null }): Promise<StaffUser> {
  if (!LIVE.staff) {
    await wait(350);
    if (mockStaff.some((x) => x.username === u.username)) throw new Error("That username is already taken");
    const row: StaffUser = { user_id: uid(), username: u.username, role_name: u.role_name, office_id: u.office_id, is_active: true, last_login: null };
    mockStaff.push(row);
    audit("INSERT", "admin_users", null, `${u.username} (${u.role_name})`);
    return row;
  }
  // CHECK: POST /api/admin-users is not built yet (backend/scripts/create_admin.py does this from the CLI).
  return request<StaffUser>("/api/admin-users", { method: "POST", body: JSON.stringify(u) });
}

export async function setStaffActive(userId: string, active: boolean): Promise<void> {
  if (!LIVE.staff) {
    await wait(250);
    const row = mockStaff.find((x) => x.user_id === userId)!;
    if (row.user_id === getAdminSession()?.user_id) throw new Error("You cannot deactivate your own account");
    audit("UPDATE", "admin_users", `${row.username} is_active=${row.is_active}`, `${row.username} is_active=${active}`);
    row.is_active = active;
    return;
  }
  // deactivate exists; activate is CHECK.
  await request(`/api/admin-users/${userId}/${active ? "activate" : "deactivate"}`, { method: "PATCH" });
}

export async function resetStaffPassword(userId: string): Promise<string> {
  // Returns a one-time temporary password to hand to the staff member.
  const temp = `Gh-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
  if (!LIVE.staff) {
    await wait(300);
    const row = mockStaff.find((x) => x.user_id === userId)!;
    audit("UPDATE", "admin_users", `${row.username} password_hash`, `${row.username} password reset (JWT revoked)`);
    return temp;
  }
  // CHECK: endpoint not built yet.
  const res = await request<{ temporary_password: string }>(`/api/admin-users/${userId}/reset-password`, { method: "POST" });
  return res.temporary_password;
}

// ===========================================================================
// ANALYTICS (aggregated, anonymized demand_logs / sms_logs / feedback_logs)
// ===========================================================================
export type Tier = "high" | "moderate" | "low";
export const TIERS: Tier[] = ["high", "moderate", "low"];

export type DemandCell = { month: string; barangay_code: string; program_id: string | null; tier: Tier; count: number };

// 12 months ending Sep 2026. program_id null = "no matching program" (eligibility gap).
export const MONTHS = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

const mockDemand: DemandCell[] = (() => {
  const r = seeded(42);
  const out: DemandCell[] = [];
  const programs = ["p-4ps", "p-aics", "p-tupad", "p-feed", null];
  const codes = Object.keys(BARANGAY_COORDS);
  // Some barangays are denser / poorer than others.
  const density: Record<string, number> = {};
  codes.forEach((c, i) => (density[c] = 0.4 + ((i * 37) % 11) / 8));
  density["0730600060"] = 2.1; // Pardo
  density["0730600024"] = 1.9; // Inayawan
  density["0730600011"] = 1.7; // Basak San Nicolas
  MONTHS.forEach((m, mi) => {
    const season = 1 + 0.35 * Math.sin((mi / 12) * Math.PI * 2) + mi * 0.03; // gentle growth + seasonality
    for (const code of codes) {
      for (const p of programs) {
        const pBase = p === "p-aics" ? 7 : p === "p-4ps" ? 6 : p === "p-tupad" ? 4 : p === "p-feed" ? 3 : 1.6;
        for (const tier of TIERS) {
          const tierW = tier === "high" ? 0.3 * density[code] : tier === "moderate" ? 0.45 : 0.35 / density[code];
          const n = Math.round(pBase * season * density[code] * tierW * (0.6 + r() * 0.8));
          if (n > 0) out.push({ month: m, barangay_code: code, program_id: p, tier, count: n });
        }
      }
    }
  });
  return out;
})();

export async function getDemandLogs(): Promise<DemandCell[]> {
  if (!LIVE.analytics) {
    await wait(350);
    return mockDemand;
  }
  return request<DemandCell[]>("/api/analytics/demand"); // CHECK
}

export type SmsMonth = { month: string; delivered: number; failed: number };
export type SmsLog = { sms_id: string; masked_recipient: string; program_id: string; delivery_status: "DELIVERED" | "FAILED" | "QUEUED"; sent_at: string };

const mockSmsMonths: SmsMonth[] = MONTHS.map((m, i) => {
  const r = seeded(100 + i);
  const total = Math.round(180 + i * 28 + r() * 60);
  const failed = Math.round(total * (0.03 + r() * 0.05));
  return { month: m, delivered: total - failed, failed };
});

const mockSmsLogs: SmsLog[] = (() => {
  const r = seeded(9);
  const progs = ["p-4ps", "p-aics", "p-tupad", "p-feed"];
  let t = new Date("2026-09-24T09:20:00+08:00").getTime();
  return Array.from({ length: 25 }, (_, i) => {
    t -= Math.floor(r() * 50 * 60000) + 60000;
    const x = r();
    return {
      sms_id: `s-${i}`,
      masked_recipient: `09${Math.floor(10 + r() * 89)}****${Math.floor(100 + r() * 899)}`,
      program_id: progs[Math.floor(r() * progs.length)],
      delivery_status: (i === 0 ? "QUEUED" : x < 0.07 ? "FAILED" : "DELIVERED") as SmsLog["delivery_status"],
      sent_at: new Date(t).toISOString(),
    };
  });
})();

export async function getSmsStats(): Promise<{ months: SmsMonth[]; recent: SmsLog[] }> {
  if (!LIVE.analytics) {
    await wait(250);
    return { months: mockSmsMonths, recent: mockSmsLogs };
  }
  return request("/api/analytics/sms"); // CHECK
}

export type Feedback = { feedback_id: string; sus_score: number; qualitative_feedback: string | null; submitted_at: string };

const mockFeedback: Feedback[] = (() => {
  const r = seeded(21);
  const comments = [
    "Dali ra kaayo gamiton, salamat!",
    "Mas klaro na kung unsa ang dad-on nga dokumento.",
    "Sana may Tagalog voice option para kay lola.",
    "The SMS checklist helped me a lot at the barangay hall.",
    "Medyo nalibog ko sa pangutana bahin sa income.",
    "Very helpful, I didn't know I qualified for AICS.",
    null,
    null,
  ];
  let t = new Date("2026-09-24T08:00:00+08:00").getTime();
  return Array.from({ length: 140 }, (_, i) => {
    t -= Math.floor(r() * 8 * 3600000);
    const sus = Math.max(20, Math.min(100, Math.round((62 + r() * 38 - (r() < 0.12 ? 30 : 0)) / 2.5) * 2.5));
    return { feedback_id: `fb-${i}`, sus_score: sus, qualitative_feedback: comments[Math.floor(r() * comments.length)], submitted_at: new Date(t).toISOString() };
  });
})();

export async function getFeedback(): Promise<Feedback[]> {
  if (!LIVE.analytics) {
    await wait(250);
    return mockFeedback;
  }
  return request<Feedback[]>("/api/analytics/feedback"); // CHECK
}

// "Document Deficiency": how often assessed households said they lack a required document.
export type DocDeficiency = { document_name: string; program_id: string; missing_count: number; checked_count: number };

export async function getDocumentDeficiency(): Promise<DocDeficiency[]> {
  if (!LIVE.analytics) {
    await wait(200);
    return [
      { document_name: "PSA birth certificates of children", program_id: "p-4ps", missing_count: 412, checked_count: 1130 },
      { document_name: "Certificate of Indigency", program_id: "p-aics", missing_count: 388, checked_count: 1504 },
      { document_name: "Medical abstract / prescription", program_id: "p-aics", missing_count: 301, checked_count: 1504 },
      { document_name: "Valid government ID", program_id: "p-tupad", missing_count: 247, checked_count: 866 },
      { document_name: "Barangay Certificate of Residency", program_id: "p-4ps", missing_count: 198, checked_count: 1130 },
      { document_name: "Certificate of displacement", program_id: "p-tupad", missing_count: 176, checked_count: 866 },
      { document_name: "OSCA ID", program_id: "p-senior", missing_count: 64, checked_count: 290 },
    ];
  }
  return request<DocDeficiency[]>("/api/analytics/document-deficiency"); // CHECK
}

// ===========================================================================
// BLIND CROSS-VALIDATION (Scope: "AI Model Validation Framework")
// 30–50 synthetic household profiles. Social workers rate each case blind
// (they never see the model's tier); results compare the panel to the model.
// ===========================================================================
export type SyntheticCase = {
  case_id: string;
  household_size: number;
  monthly_income: number;
  employment_status: string;
  housing_type: string;
  barangay: string;
  children_0_18: number;
  special: string[];
  crisis: string | null;
};

export type Rating = { case_id: string; rater: string; tier: Tier };

const mockCases: SyntheticCase[] = (() => {
  const r = seeded(314);
  const emp = ["unemployed", "informal / daily wage", "underemployed", "regular employment", "displaced (recent)", "self-employed"];
  const housing = ["informal settler", "rented room", "owned (light materials)", "owned (concrete)", "living with relatives"];
  const brgys = Object.values(BARANGAY_COORDS).map((b) => b[0]);
  const specials = ["PWD member", "solo parent", "senior citizen", "pregnant member", "4Ps grantee before"];
  const crises = ["medical emergency", "fire victim", "flood damage", "death in family"];
  return Array.from({ length: 36 }, (_, i) => ({
    case_id: `SP-${String(i + 1).padStart(3, "0")}`,
    household_size: 1 + Math.floor(r() * 9),
    monthly_income: Math.round((2000 + r() * 30000) / 500) * 500,
    employment_status: emp[Math.floor(r() * emp.length)],
    housing_type: housing[Math.floor(r() * housing.length)],
    barangay: brgys[Math.floor(r() * brgys.length)],
    children_0_18: Math.floor(r() * 5),
    special: specials.filter(() => r() < 0.18),
    crisis: r() < 0.25 ? crises[Math.floor(r() * crises.length)] : null,
  }));
})();

// A rough "true" tier so the mock model & mock raters agree most of the time.
function referenceTier(c: SyntheticCase): Tier {
  const perCapita = c.monthly_income / Math.max(c.household_size, 1);
  let s = perCapita < 2200 ? 3 : perCapita < 4200 ? 2 : perCapita < 7000 ? 1 : 0;
  if (c.crisis) s += 1;
  if (c.housing_type === "informal settler") s += 1;
  if (c.employment_status.startsWith("unemployed") || c.employment_status.startsWith("displaced")) s += 1;
  s += Math.min(c.special.length, 2) * 0.5;
  return s >= 3.5 ? "high" : s >= 1.5 ? "moderate" : "low";
}

function jitter(t: Tier, p: number, r: () => number): Tier {
  if (r() > p) return t;
  const i = TIERS.indexOf(t);
  return TIERS[Math.max(0, Math.min(2, i + (r() < 0.5 ? -1 : 1)))];
}

const mockModelTiers: Record<string, Tier> = (() => {
  const r = seeded(55);
  return Object.fromEntries(mockCases.map((c) => [c.case_id, jitter(referenceTier(c), 0.15, r)]));
})();

// Two other panelists have already finished; the signed-in user rates in the UI.
const mockRatings: Rating[] = (() => {
  const out: Rating[] = [];
  (["rsantos", "mdelacruz"] as const).forEach((rater, k) => {
    const r = seeded(900 + k);
    for (const c of mockCases) out.push({ case_id: c.case_id, rater, tier: jitter(referenceTier(c), 0.2, r) });
  });
  return out;
})();

export async function getValidationCases(): Promise<SyntheticCase[]> {
  if (!LIVE.validation) {
    await wait(250);
    return mockCases;
  }
  return request<SyntheticCase[]>("/api/validation/cases"); // CHECK
}

export async function getRatings(): Promise<Rating[]> {
  if (!LIVE.validation) {
    await wait(150);
    return [...mockRatings];
  }
  return request<Rating[]>("/api/validation/ratings"); // CHECK
}

export async function submitRating(caseId: string, tier: Tier): Promise<void> {
  const rater = currentUsername();
  if (!LIVE.validation) {
    await wait(150);
    const existing = mockRatings.find((x) => x.case_id === caseId && x.rater === rater);
    if (existing) existing.tier = tier;
    else mockRatings.push({ case_id: caseId, rater, tier });
    return;
  }
  return request<void>(`/api/validation/cases/${caseId}/rating`, { method: "PUT", body: JSON.stringify({ tier }) }); // CHECK
}

// The model's output is only released once the panel is done (keeps the test blind).
export async function getModelTiers(): Promise<Record<string, Tier>> {
  if (!LIVE.validation) {
    await wait(250);
    return { ...mockModelTiers };
  }
  return request<Record<string, Tier>>("/api/validation/model-results"); // CHECK
}

// ===========================================================================
// SYSTEM ADMINISTRATOR — health, cache, database, SMS gateway, security
// ===========================================================================
export type ServiceStatus = { name: string; status: "up" | "degraded" | "down"; detail: string; latency_ms: number | null };

export async function getSystemHealth(): Promise<ServiceStatus[]> {
  const timed = async (name: string, fn: () => Promise<string>): Promise<ServiceStatus> => {
    const t = performance.now();
    try {
      const detail = await fn();
      return { name, status: "up", detail, latency_ms: Math.round(performance.now() - t) };
    } catch (e) {
      return { name, status: "down", detail: e instanceof Error ? e.message : "Unreachable", latency_ms: null };
    }
  };

  // The NLP/scoring/SMS rows have no health endpoint yet, so they are always sample values.
  const extra: ServiceStatus[] = [
    { name: "XLM-RoBERTa NLP service", status: "up", detail: "Intent model v0.3 · p95 612 ms", latency_ms: 238 },
    { name: "XGBoost scoring engine", status: "up", detail: "Model v1.1 · 36 features", latency_ms: 41 },
    { name: "Semaphore SMS gateway", status: "degraded", detail: "Globe route delay reported", latency_ms: 1320 },
  ];

  if (!LIVE.health) {
    await wait(400);
    return [
      { name: "FastAPI backend", status: "up", detail: "GinhawAI backend is running", latency_ms: 18 },
      { name: "PostgreSQL", status: "up", detail: "PostgreSQL 16.4", latency_ms: 9 },
      { name: "Redis session cache", status: "up", detail: "connected", latency_ms: 3 },
      ...extra,
    ];
  }
  const core = await Promise.all([
    timed("FastAPI backend", async () => (await request<{ status: string }>("/", { auth: false })).status),
    timed("PostgreSQL", async () => {
      const v = (await request<{ postgres_version: string }>("/health/db", { auth: false })).postgres_version;
      return v.split(" on ")[0];
    }),
    timed("Redis session cache", async () => (await request<{ redis: string }>("/health/redis", { auth: false })).redis),
  ]);
  return [...core, ...extra];
}

export type CacheStats = { active_sessions: number; keys: number; memory_mb: number; ttl_minutes: number; purged_today: number };
const mockCache: CacheStats = { active_sessions: 37, keys: 412, memory_mb: 18.4, ttl_minutes: 30, purged_today: 1284 };

export async function getCacheStats(): Promise<CacheStats> {
  if (!LIVE.cache) {
    await wait(200);
    return { ...mockCache };
  }
  return request<CacheStats>("/api/system/cache"); // CHECK
}

export async function purgeCache(scope: "expired" | "all"): Promise<CacheStats> {
  if (!LIVE.cache) {
    await wait(600);
    const before = mockCache.keys;
    if (scope === "all") {
      mockCache.purged_today += mockCache.keys;
      mockCache.keys = 0;
      mockCache.active_sessions = 0;
      mockCache.memory_mb = 0.9;
    } else {
      const n = Math.round(mockCache.keys * 0.3);
      mockCache.keys -= n;
      mockCache.purged_today += n;
      mockCache.memory_mb = +(mockCache.memory_mb * 0.7).toFixed(1);
    }
    audit("PURGE", "session_cache", `${before} keys`, `${mockCache.keys} keys (${scope})`);
    return { ...mockCache };
  }
  return request<CacheStats>(`/api/system/cache/purge?scope=${scope}`, { method: "POST" }); // CHECK
}

export async function setCacheTtl(minutes: number): Promise<void> {
  if (!LIVE.cache) {
    await wait(250);
    audit("UPDATE", "system_config", `session_ttl=${mockCache.ttl_minutes}m`, `session_ttl=${minutes}m`);
    mockCache.ttl_minutes = minutes;
    return;
  }
  return request<void>("/api/system/cache/ttl", { method: "PUT", body: JSON.stringify({ minutes }) }); // CHECK
}

export type TableInfo = { table: string; module: string; rows: number; size_kb: number };

export async function getDatabaseInfo(): Promise<{ pool_size: number; pool_in_use: number; tables: TableInfo[]; last_backup: string }> {
  // CHECK: no endpoint yet. The module grouping follows Table 6 of the manuscript.
  await wait(250);
  return {
    pool_size: 10,
    pool_in_use: 3,
    last_backup: "2026-09-24T02:00:00+08:00",
    tables: [
      { table: "programs", module: "Welfare Core", rows: mockPrograms.length, size_kb: 16 },
      { table: "eligibility_criteria", module: "Welfare Core", rows: Object.values(mockCriteria).flat().length, size_kb: 24 },
      { table: "document_requirements", module: "Welfare Core", rows: Object.values(mockDocs).flat().length, size_kb: 24 },
      { table: "barangays", module: "Localization", rows: mockBarangays.length, size_kb: 16 },
      { table: "lgu_offices", module: "Localization", rows: mockOffices.length, size_kb: 16 },
      { table: "barangay_schedules", module: "Localization", rows: mockSchedules.length, size_kb: 16 },
      { table: "demand_logs", module: "Localization", rows: mockDemand.reduce((a, b) => a + b.count, 0), size_kb: 2210 },
      { table: "sms_logs", module: "Localization", rows: mockSmsMonths.reduce((a, b) => a + b.delivered + b.failed, 0), size_kb: 640 },
      { table: "roles", module: "Management & Security", rows: ALL_ROLES.length, size_kb: 8 },
      { table: "admin_users", module: "Management & Security", rows: mockStaff.length, size_kb: 16 },
      { table: "audit_logs", module: "Management & Security", rows: mockAudit.length, size_kb: 48 },
      { table: "feedback_logs", module: "Feedback & QA", rows: mockFeedback.length, size_kb: 56 },
    ],
  };
}

export type SmsGatewayConfig = {
  sender_name: string;
  api_key_masked: string;
  key_created_at: string;
  credits_remaining: number;
  webhook_url: string;
  enabled: boolean;
};

const mockGateway: SmsGatewayConfig = {
  sender_name: "GINHAWAI",
  api_key_masked: "sk_live_••••••••••••7f3a",
  key_created_at: "2026-07-01T09:00:00+08:00",
  credits_remaining: 4180,
  webhook_url: "https://api.ginhawai.ph/webhooks/semaphore",
  enabled: true,
};

export async function getSmsGateway(): Promise<SmsGatewayConfig> {
  if (!LIVE.smsGateway) {
    await wait(200);
    return { ...mockGateway };
  }
  return request<SmsGatewayConfig>("/api/system/sms-gateway"); // CHECK
}

export async function updateSmsGateway(patch: Partial<Pick<SmsGatewayConfig, "sender_name" | "webhook_url" | "enabled">> & { api_key?: string }): Promise<SmsGatewayConfig> {
  if (!LIVE.smsGateway) {
    await wait(400);
    const { api_key, ...rest } = patch;
    Object.assign(mockGateway, rest);
    if (api_key) {
      mockGateway.api_key_masked = `sk_live_••••••••••••${api_key.slice(-4)}`;
      mockGateway.key_created_at = new Date().toISOString();
      audit("UPDATE", "system_config", "semaphore_api_key (old)", "semaphore_api_key rotated");
    } else {
      audit("UPDATE", "system_config", null, `sms_gateway ${JSON.stringify(rest)}`);
    }
    return { ...mockGateway };
  }
  return request<SmsGatewayConfig>("/api/system/sms-gateway", { method: "PATCH", body: JSON.stringify(patch) }); // CHECK
}

export async function sendTestSms(number: string): Promise<{ status: string }> {
  if (!LIVE.smsGateway) {
    await wait(900);
    if (!/^09\d{9}$/.test(number.replace(/\s/g, ""))) throw new Error("Enter an 11-digit mobile number starting with 09");
    return { status: "DELIVERED" };
  }
  return request("/api/system/sms-gateway/test", { method: "POST", body: JSON.stringify({ number }) }); // CHECK
}

export type SecurityPolicy = {
  jwt_expire_minutes: number;
  password_min_length: number;
  require_mfa: boolean;
  max_failed_logins: number;
  lockout_minutes: number;
  rate_limit_per_minute: number;
  allowed_origins: string[];
  purge_on_session_end: boolean;
};

const mockPolicy: SecurityPolicy = {
  jwt_expire_minutes: 60,
  password_min_length: 10,
  require_mfa: true,
  max_failed_logins: 5,
  lockout_minutes: 15,
  rate_limit_per_minute: 60,
  allowed_origins: ["http://localhost:3000"],
  purge_on_session_end: true,
};

export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  if (!LIVE.security) {
    await wait(200);
    return { ...mockPolicy, allowed_origins: [...mockPolicy.allowed_origins] };
  }
  return request<SecurityPolicy>("/api/system/security-policy"); // CHECK
}

export async function updateSecurityPolicy(p: SecurityPolicy): Promise<SecurityPolicy> {
  if (!LIVE.security) {
    await wait(400);
    const changed = (Object.keys(p) as (keyof SecurityPolicy)[]).filter((k) => JSON.stringify(p[k]) !== JSON.stringify(mockPolicy[k]));
    audit("UPDATE", "system_config", changed.map((k) => `${k}=${JSON.stringify(mockPolicy[k])}`).join(", "), changed.map((k) => `${k}=${JSON.stringify(p[k])}`).join(", "));
    Object.assign(mockPolicy, p);
    return { ...mockPolicy };
  }
  return request<SecurityPolicy>("/api/system/security-policy", { method: "PUT", body: JSON.stringify(p) }); // CHECK
}

export async function revokeAllSessions(): Promise<void> {
  if (!LIVE.security) {
    await wait(500);
    audit("UPDATE", "admin_users", null, "All staff JWTs revoked");
    return;
  }
  return request<void>("/api/system/revoke-sessions", { method: "POST" }); // CHECK
}
