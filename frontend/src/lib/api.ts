// Small helpers for talking to the GinhawAI backend.
//
// NEXT_PUBLIC_API_URL (in .env.local, see .env.example) is the backend's base
// URL, e.g. http://localhost:8000 — no trailing slash, no /api. Every route
// path below already starts with /api. NEXT_PUBLIC_* values are baked in when
// `npm.cmd run dev` / `next build` starts, so restart after changing them.
//
// MOCK MODE: set NEXT_PUBLIC_USE_MOCK=true in .env.local to use fake data
// (no backend needed).

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ---------------------------------------------------------------------------
// RESPONSE SHAPES — these mirror backend/app/routers/*.py
// ---------------------------------------------------------------------------

// Fields the backend's slot-filling collects (see REQUIRED_FIELDS in routers/sessions.py).
export type Entities = {
  monthly_income?: number | null;
  number_of_dependents?: number | null;
  is_unemployed?: boolean | null;
  has_pwd?: boolean | null;
  [key: string]: unknown;
};

// POST /api/sessions
export type SessionResponse = {
  session_id: string;
  expires_in_seconds: number;
};

// POST /api/sessions/{id}/messages
export type MessageResponse = {
  session_id: string;
  entities: Entities;
  missing_fields: string[];
  profile_complete: boolean;
  system_message: string;
};

// GET /api/sessions/{id}
export type SessionState = {
  session_id: string;
  state: {
    messages: { from: "citizen" | "system"; text: string }[];
    entities?: Entities;
    // Not produced by the backend yet — there is no scoring endpoint. Only mock mode sets it.
    vulnerability_score?: number;
  };
};

// GET /api/programs
export type Program = {
  program_id: string;
  program_name: string;
  agency: string;
  scope: string;
  is_active: boolean;
};

// GET /api/programs/{id}/eligibility
export type EligibilityCriterion = {
  criteria_id: string;
  attribute: string;
  operator: string;
  threshold_value: string;
  weight: number;
};

// GET /api/programs/{id}/documents
export type DocumentRequirement = {
  doc_id: string;
  document_name: string;
  is_mandatory: boolean;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// ERRORS
// ---------------------------------------------------------------------------

// status is 0 when the request never reached the backend (server down, CORS, bad URL).
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

// FastAPI errors look like {"detail": "..."} or, for validation errors,
// {"detail": [{"msg": "...", ...}]}.
function detailFrom(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : String(d))).join("; ");
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the server at ${BASE}. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.`,
      0,
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(detailFrom(body) ?? `Request failed (${res.status} ${res.statusText})`, res.status);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// MOCK IMPLEMENTATION (delete this whole section once the backend is always available)
// ---------------------------------------------------------------------------
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOCK_FIELDS = ["monthly_income", "number_of_dependents", "is_unemployed", "has_pwd"] as const;

// Shown on /confirm if the page is refreshed (the mock's memory is lost on refresh).
const MOCK_SAMPLE_ENTITIES: Entities = {
  monthly_income: 8000,
  number_of_dependents: 3,
  is_unemployed: false,
  has_pwd: false,
};

const mockEntities = new Map<string, Entities>();

async function mockStartSession(): Promise<SessionResponse> {
  await wait(300);
  const id = `mock-${Date.now()}`;
  mockEntities.set(id, {});
  return { session_id: id, expires_in_seconds: 1800 };
}

// Fills one missing field per message, in order, so the flow can be clicked through.
async function mockSendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  await wait(700);
  const entities = mockEntities.get(sessionId) ?? {};
  const next = MOCK_FIELDS.find((f) => entities[f] == null);
  if (next === "monthly_income" || next === "number_of_dependents") {
    entities[next] = Number(message.replace(/[^0-9.]/g, "")) || 0;
  } else if (next) {
    entities[next] = /^(y|yes|oo|opo|true)\b/i.test(message.trim());
  }
  mockEntities.set(sessionId, entities);

  const missing_fields = MOCK_FIELDS.filter((f) => entities[f] == null);
  const profile_complete = missing_fields.length === 0;
  return {
    session_id: sessionId,
    entities: { ...entities },
    missing_fields,
    profile_complete,
    system_message: profile_complete
      ? "All required information collected — ready for vulnerability scoring."
      : `Still need: ${missing_fields.join(", ")}`,
  };
}

// Fake scoring so the score page changes with your answers. NOT the real formula.
function mockScore(e: Entities): number {
  let score = 20;
  const income = Number(e.monthly_income ?? 0);
  if (income > 0 && income <= 12000) score += 40;
  else if (income <= 25000) score += 20;
  score += Math.min(Number(e.number_of_dependents ?? 0), 6) * 5;
  if (e.is_unemployed) score += 10;
  if (e.has_pwd) score += 10;
  return Math.min(score, 100);
}

async function mockGetSession(sessionId: string): Promise<SessionState> {
  await wait(300);
  const stored = mockEntities.get(sessionId);
  const entities = stored && Object.keys(stored).length > 0 ? { ...stored } : MOCK_SAMPLE_ENTITIES;
  return {
    session_id: sessionId,
    state: { messages: [], entities, vulnerability_score: mockScore(entities) },
  };
}

const MOCK_PROGRAMS: Program[] = [
  { program_id: "mock-1", program_name: "4Ps (Pantawid Pamilyang Pilipino Program)", agency: "DSWD", scope: "National", is_active: true },
  { program_id: "mock-2", program_name: "AICS (Assistance to Individuals in Crisis Situations)", agency: "DSWD", scope: "National", is_active: true },
  { program_id: "mock-3", program_name: "TUPAD", agency: "DOLE", scope: "National", is_active: true },
];

// Placeholder rows so the UI has something to show. Not real program rules.
const MOCK_ELIGIBILITY: EligibilityCriterion[] = [
  { criteria_id: "mock-c1", attribute: "monthly_income", operator: "<=", threshold_value: "12000", weight: 1 },
];
const MOCK_DOCUMENTS: DocumentRequirement[] = [
  { doc_id: "mock-d1", document_name: "Barangay certificate of indigency", is_mandatory: true, notes: null },
  { doc_id: "mock-d2", document_name: "Valid ID", is_mandatory: true, notes: "Sample data" },
];

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export function startSession(language: string): Promise<SessionResponse> {
  if (USE_MOCK) return mockStartSession();
  // The backend ignores the body for now; language is sent so it can be picked up later.
  return request<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ language }),
  });
}

export function sendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  if (USE_MOCK) return mockSendMessage(sessionId, message);
  return request<MessageResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function getSession(sessionId: string): Promise<SessionState> {
  if (USE_MOCK) return mockGetSession(sessionId);
  return request<SessionState>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export async function getPrograms(): Promise<Program[]> {
  if (USE_MOCK) {
    await wait(300);
    return MOCK_PROGRAMS;
  }
  return request<Program[]>("/api/programs");
}

export async function getProgramEligibility(programId: string): Promise<EligibilityCriterion[]> {
  if (USE_MOCK) {
    await wait(300);
    return MOCK_ELIGIBILITY;
  }
  return request<EligibilityCriterion[]>(`/api/programs/${encodeURIComponent(programId)}/eligibility`);
}

export async function getProgramDocuments(programId: string): Promise<DocumentRequirement[]> {
  if (USE_MOCK) {
    await wait(300);
    return MOCK_DOCUMENTS;
  }
  return request<DocumentRequirement[]>(`/api/programs/${encodeURIComponent(programId)}/documents`);
}
