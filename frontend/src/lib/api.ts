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
  has_pwd?: boolean;
  is_solo_parent?: boolean;
  crisis_type?: string;
};

export type StartResponse = { session_id: string; language: Lang; messages: string[]; asking: string | null; quick_replies: QuickReply[] };

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
  likelihood: number;
  criteria: CriterionResult[];
  documents: DocumentItem[];
  schedules: ScheduleItem[];
};

export type Assessment = {
  vulnerability: { score: number; tier: Tier; message: string; top_factors: string[]; engine: string };
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // Give up after 20 s so the screen never sits on "Loading…" forever.
    res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
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
export const endSession = (sessionId: string) => request<{ purged: boolean }>(`/api/sessions/${sessionId}`, { method: "DELETE" });
export const submitFeedback = (answers: number[], comment: string) => request<{ sus_score: number }>("/api/feedback", post({ answers, comment }));