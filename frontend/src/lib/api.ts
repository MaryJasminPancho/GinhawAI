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
  can_do_physical_work?: boolean;
  crisis_type?: string;
  help_needed?: string;
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

/** note: a warning on a rule the chat doesn't ask about (e.g. the office can still turn down government employees). */
export type CriterionResult = { attribute: string; label: string; status: "pass" | "fail" | "unknown"; actual: string | null; requirement: string; explanation: string; note?: string | null };
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
const CITIZEN_NOTICE = "citizenNotice";
const AUTH_EVENT = "citizen-auth";

// Security: the sign-in is kept in sessionStorage, so closing the tab signs the citizen out
// (safer on shared or barangay computers), and the token itself stops working after 30 minutes
// (backend: TOKEN_MINUTES in routers/citizens.py). After that the citizen has to log in again.

/** When a login token stops working (ms since epoch), read from the token's own "exp" claim. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const exp = JSON.parse(atob(payload)).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}
function removeCitizen() {
  try {
    sessionStorage.removeItem(CITIZEN_KEY);
    sessionStorage.removeItem(CITIZEN_NAME);
    // Older versions kept the login in localStorage for 30 days; make sure none is left behind.
    localStorage.removeItem(CITIZEN_KEY);
    localStorage.removeItem(CITIZEN_NAME);
  } catch {
    // nothing stored
  }
}
export function getCitizenToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const token = sessionStorage.getItem(CITIZEN_KEY);
    if (!token) return null;
    const exp = tokenExpiry(token);
    if (exp !== null && exp <= Date.now()) {
      removeCitizen();
      sessionStorage.setItem(CITIZEN_NOTICE, "expired"); // the login page tells the citizen why
      return null;
    }
    return token;
  } catch {
    return null;
  }
}
export function getCitizenName(): string | null {
  try {
    return typeof window === "undefined" ? null : sessionStorage.getItem(CITIZEN_NAME);
  } catch {
    return null;
  }
}
/** One-time message for the login page: true if the last login ended because the 30 minutes ran out. */
export function takeSessionEndedNotice(): boolean {
  try {
    const ended = sessionStorage.getItem(CITIZEN_NOTICE) === "expired";
    sessionStorage.removeItem(CITIZEN_NOTICE);
    return ended;
  } catch {
    return false;
  }
}
/** For useSyncExternalStore: re-check the login on sign in / sign out and every 15 seconds (to catch expiry). */
export function subscribeCitizen(cb: () => void) {
  window.addEventListener(AUTH_EVENT, cb);
  const timer = setInterval(cb, 15000);
  return () => {
    window.removeEventListener(AUTH_EVENT, cb);
    clearInterval(timer);
  };
}
function keepCitizen(s: { token: string; display_name: string | null }) {
  try {
    sessionStorage.removeItem(CITIZEN_NOTICE);
    sessionStorage.setItem(CITIZEN_KEY, s.token);
    sessionStorage.setItem(CITIZEN_NAME, s.display_name ?? "");
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    // Storage blocked (private mode): the account works for this page only.
  }
}
export function citizenLogout() {
  removeCitizen();
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    // not in a browser
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
/** "My document checklist" (signed-in citizens): documents ticked as "I have this", saved to the account. */
export type ChecklistProgram = {
  program_name: string;
  ready: number;
  total: number;
  documents: { doc_id: string; document_name: string; is_mandatory: boolean; notes: string | null; have: boolean }[];
};
export const getMyChecklist = () => request<{ checked_on: string | null; programs: ChecklistProgram[] }>("/api/citizen/checklist");
export const getMyDocuments = () => request<{ have: string[] }>("/api/citizen/documents");
export const setMyDocument = (docId: string, have: boolean) =>
  request<void>(`/api/citizen/documents/${docId}`, { ...post({ have }), method: "PUT" });
/** Application tracker (signed-in citizens): where they are with each program they may qualify for. */
export type AppStatus = "not_started" | "papers_ready" | "applied" | "approved";
export type TrackedProgram = {
  program_id: string;
  program_name: string;
  status: AppStatus;
  valid_until: string | null;
  ready: number;
  total: number;
  next_schedule: { start_date: string; end_date: string; office_name: string; address: string | null } | null;
};
/** reasons: "old" (no check for 90 days), "age60" (the applicant may have turned 60 since). */
export type Tracker = { programs: TrackedProgram[]; recheck: { checked_on: string | null; days_since: number | null; reasons: ("old" | "age60")[] } };
export const getMyTracker = () => request<Tracker>("/api/citizen/tracker");
export const setMyApplication = (programId: string, status: AppStatus, valid_until: string | null) =>
  request<void>(`/api/citizen/tracker/${programId}`, { ...post({ status, valid_until }), method: "PUT" });
/** Email reminders (opt-in): visit dates, renewals, "check again". */
export type Reminders = { on: boolean; email: string | null; account_email: string | null; email_ready: boolean };
export const getMyReminders = () => request<Reminders>("/api/citizen/reminders");
export const setMyReminders = (on: boolean, email: string | null) =>
  request<{ on: boolean; email: string | null }>("/api/citizen/reminders", { ...post({ on, email }), method: "PUT" });
export const deleteMyAccount = () => request<void>("/api/citizen/me", { method: "DELETE" }).then(citizenLogout);

export const endSession = (sessionId: string) => request<{ purged: boolean }>(`/api/sessions/${sessionId}`, { method: "DELETE" });
export const submitFeedback = (answers: number[], comment: string) => request<{ sus_score: number }>("/api/feedback", post({ answers, comment }));