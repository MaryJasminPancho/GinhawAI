// Citizen-side calls to the GinhawAI backend (storyboard Figs. 14–22).
// NEXT_PUBLIC_API_URL should be http://localhost:8000 (no /api, no /v1).

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Lang = "fil" | "ceb" | "en";
export type QuickReply = { value: string; label: string };
export type Tier = "high" | "moderate" | "low";

export type Entities = {
  barangay?: string;
  barangay_code?: string | null;
  household_size?: number;
  monthly_income?: number;
  employment_status?: string;
  age?: number;
  housing_type?: string;
  has_children_0_18?: boolean;
  has_pregnant?: boolean;
  has_pwd?: boolean;
  has_senior?: boolean;
  is_solo_parent?: boolean;
  crisis_type?: string;
};

export type StartResponse = { session_id: string; language: Lang; messages: string[]; asking: string | null; quick_replies: QuickReply[]; is_complete?: boolean };

export type MessageResponse = {
  reply: string;
  asking: string | null;
  quick_replies: QuickReply[];
  is_complete: boolean;
  entities: Entities;
  missing_fields: string[];
};

export type CriterionResult = { attribute: string; label: string; status: "pass" | "fail" | "unknown"; actual: string | null; requirement: string; explanation: string };
export type DocumentItem = { doc_id: string; document_name: string; is_mandatory: boolean; notes: string | null };
export type ScheduleItem = { schedule_id: string; start_date: string; end_date: string; notes: string | null; office_name: string; address: string | null };
export type OfficeItem = { office_id: string; office_name: string; address: string | null; barangay_code: string | null; contact_number: string | null; operating_hours: string | null };

export type ProgramResult = {
  program_id: string;
  program_name: string;
  agency: string;
  scope: string;
  status: "qualified" | "partial" | "not_qualified";
  /** One plain-language sentence: why they can or can't apply. */
  summary: string;
  /** How many of the program's requirements the household meets (counted, not weighted). */
  requirements_met: number;
  requirements_total: number;
  /** Requirements only the office can confirm (e.g. documents). */
  requirements_to_verify: number;
  criteria: CriterionResult[];
  documents: DocumentItem[];
  schedules: ScheduleItem[];
};

export type UrgentContact = { name: string; phone: string | null; address: string | null; what: string };

export type Assessment = {
  /** Who to call right now, when the citizen reported a crisis (empty otherwise). */
  urgent?: UrgentContact[];
  vulnerability: {
    score: number;
    tier: Tier;
    message: string;
    top_factors: string[];
    /** What raised and what lowered the score; share = % of the push in that direction. */
    breakdown?: { text: string; direction: "up" | "down"; share: number }[];
    engine: string;
  };
  programs: ProgramResult[];
  offices: OfficeItem[];
  barangay: string | null;
  assessed_on: string;
};

export type SessionState = {
  session_id: string;
  language: Lang;
  entities: Entities;
  missing_fields: string[];
  profile_complete: boolean;
  assessment: Assessment | null;
};

export class SessionExpiredError extends Error {}

// ---------------------------------------------------------------------------
// Optional citizen account (2nd consultation). The token is kept on this device only.
// ---------------------------------------------------------------------------
const CITIZEN_KEY = "citizenToken";
const CITIZEN_NAME = "citizenName";
export function getCitizenToken(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(CITIZEN_KEY);
  } catch {
    return null;
  }
}
export function getCitizenName(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(CITIZEN_NAME);
  } catch {
    return null;
  }
}
function keepCitizen(s: { token: string; display_name: string | null }) {
  try {
    localStorage.setItem(CITIZEN_KEY, s.token);
    localStorage.setItem(CITIZEN_NAME, s.display_name ?? "");
  } catch {
    // Storage blocked (private mode): the account works for this page only.
  }
}
export function citizenLogout() {
  try {
    localStorage.removeItem(CITIZEN_KEY);
    localStorage.removeItem(CITIZEN_NAME);
  } catch {
    // nothing stored
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // Give up after 20 s so the screen never sits on "Loading…" forever.
    // A signed-in citizen (optional account) sends their token, so the chat can use saved answers.
    const citizen = getCitizenToken();
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...(citizen ? { Authorization: `Bearer ${citizen}` } : {}), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Can't connect right now. Please check your internet and try again.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : "";
    } catch {}
    if (res.status === 404 && path.startsWith("/api/sessions/")) throw new SessionExpiredError(detail || "Your session has ended. Please start again.");
    throw new Error(detail || `Something went wrong (${res.status}). Please try again.`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const startSession = (language: string) => request<StartResponse>("/api/sessions", post({ language }));
export type HistoryResponse = {
  session_id: string;
  language: Lang;
  messages: { from: "assistant" | "citizen"; text: string }[];
  asking: string | null;
  quick_replies: QuickReply[];
  is_complete: boolean;
};
/** The conversation so far, used to restore the chat after a page refresh. */
export const getHistory = (sessionId: string) => request<HistoryResponse>(`/api/sessions/${sessionId}/messages`);
export const sendMessage = (sessionId: string, message: string) => request<MessageResponse>(`/api/sessions/${sessionId}/messages`, post({ message }));
export const getSession = (sessionId: string) => request<SessionState>(`/api/sessions/${sessionId}`);
export const editEntities = (sessionId: string, values: Record<string, unknown>) =>
  request<{ entities: Entities; missing_fields: string[]; profile_complete: boolean; errors: Record<string, string> }>(`/api/sessions/${sessionId}/entities`, {
    method: "PATCH",
    body: JSON.stringify({ values }),
  });
export const assess = (sessionId: string) => request<Assessment>(`/api/sessions/${sessionId}/assess`, { method: "POST" });
export const sendDocumentChecks = (sessionId: string, checks: { doc_id: string; has_document: boolean }[]) =>
  request<{ recorded: number }>(`/api/sessions/${sessionId}/document-checks`, post({ checks }));
export const sendSms = (sessionId: string, phone: string) =>
  request<{ status: string; masked_recipient: string; message: string }>(`/api/sessions/${sessionId}/sms`, post({ phone }));
export const sendEmail = (sessionId: string, email: string) =>
  request<{ status: string; masked_recipient: string }>(`/api/sessions/${sessionId}/email`, post({ email }));
/** Which ways the checklist can be sent right now (set up by the System Administrator). */
export const getChannels = () => request<{ sms: boolean; email: boolean }>("/api/channels");
/** Every active program, for browsing without the chat ("Search Hyperlocal Assistance Programs"). */
export type CatalogProgram = {
  program_id: string;
  program_name: string;
  agency: string;
  scope: string | null;
  who_can_apply: { label: string; requirement: string }[];
  documents: { document_name: string; is_mandatory: boolean; notes: string | null; only_if: string | null }[];
  schedules: Omit<ScheduleItem, "schedule_id">[];
};
export type Catalog = {
  programs: CatalogProgram[];
  offices: {
    office_name: string;
    address: string | null;
    contact_number: string | null;
    operating_hours: string | null;
    barangay_code: string | null;
    barangay_name: string | null;
    /** Only shown once the citizen picks that barangay. */
    is_barangay_hall: boolean;
  }[];
  barangays: { barangay_code: string; barangay_name: string }[];
  /** Verified NGOs / civil society groups and the help they currently offer. */
  partners: {
    name: string;
    org_type: string;
    services: string | null;
    address: string | null;
    barangay_name: string | null;
    contact: string | null;
    resources: { title: string; details: string | null; barangay_name: string | null; starts_on: string | null; ends_on: string | null }[];
  }[];
};
/** Every Cebu City barangay, for picking one instead of typing it. */
export const getBarangays = () => request<{ barangay_code: string; barangay_name: string }[]>("/api/barangays");
export const getCatalog = (lang: Lang) => request<Catalog>(`/api/catalog?lang=${lang}`);
export type CitizenAccount = {
  display_name: string | null;
  username: string | null;
  email: string | null;
  signed_in_with: "google" | "password";
  member_since: string;
  profile: { language: Lang | null; entities: Entities; updated_at: string } | null;
  history: { assessment_id: string; tier: Tier | null; score: number | null; programs: { program_name: string; status: ProgramResult["status"] }[]; created_at: string }[];
};
type CitizenSession = { token: string; display_name: string | null };
const kept = (s: CitizenSession) => {
  keepCitizen(s);
  return s;
};
export const getCitizenConfig = () => request<{ google_client_id: string | null }>("/api/citizen/config");
export const citizenSignup = (username: string, password: string, display_name: string, consent: boolean) =>
  request<CitizenSession>("/api/citizen/signup", post({ username, password, display_name, consent })).then(kept);
export const citizenLogin = (username: string, password: string) =>
  request<CitizenSession>("/api/citizen/login", post({ username, password })).then(kept);
export const citizenGoogle = (credential: string, consent: boolean) =>
  request<CitizenSession>("/api/citizen/google", post({ credential, consent })).then(kept);
/** Keep this (anonymous) chat in the account the citizen just signed in to. */
export const claimSession = (sessionId: string) => request<{ saved: boolean }>(`/api/sessions/${sessionId}/claim`, { method: "POST" });
/** Step-by-step Action Plan for the programs the household can or may apply for. */
export type ActionPlan = {
  urgent: UrgentContact[];
  urgent_title: string;
  labels: { docs: string; docs_all: string; go: string; there: string; dates: string };
  programs: {
    program_id: string;
    program_name: string;
    status: ProgramResult["status"];
    documents: { document_name: string; have: boolean; how: string | null; is_mandatory: boolean }[];
    all_documents_ready: boolean;
    office: { name: string; address: string | null; hours: string | null; phone: string | null } | null;
    office_note: string | null;
    what_happens: string;
    schedules: { start_date: string; end_date: string; notes: string | null; office_name: string }[];
  }[];
};
export const getPlan = (sessionId: string, have: string[]) => request<ActionPlan>(`/api/sessions/${sessionId}/plan`, post({ have }));
/** Where the results page keeps the "I have this" ticks for the Action Plan (this tab only). */
export const haveKey = (sessionId: string) => `have-${sessionId}`;
export const getMyAccount = () => request<CitizenAccount>("/api/citizen/me");
export const deleteMyAccount = () => request<void>("/api/citizen/me", { method: "DELETE" }).then(citizenLogout);

export const endSession = (sessionId: string) => request<{ purged: boolean }>(`/api/sessions/${sessionId}`, { method: "DELETE" });
export const submitFeedback = (answers: number[], comment: string) => request<{ sus_score: number }>("/api/feedback", post({ answers, comment }));