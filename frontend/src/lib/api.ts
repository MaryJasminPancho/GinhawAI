// Small helpers for talking to the GinhawAI backend.
// NEXT_PUBLIC_API_URL should be http://localhost:8000 (no /api, no /v1).
//
// MOCK MODE: set NEXT_PUBLIC_USE_MOCK=true in .env.local to use fake data
// (no backend needed). Set it to false (or delete it) and restart
// `npm.cmd run dev` to talk to the real backend.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ---------------------------------------------------------------------------
// ASSUMED RESPONSE SHAPES
// The setup guide only says: POST /api/sessions -> "returns a session_id",
// POST /api/sessions/{id}/messages -> "returns a reply + extracted data", and
// GET /api/sessions/{id} -> "current session state".
// The exact field names below are guesses. Check http://localhost:8000/docs
// (or ask Jasmin) and edit these types, the mock below, and the lines marked
// CHECK to match the real backend.
// ---------------------------------------------------------------------------
export type SessionResponse = {
  session_id: string;
};

export type MessageResponse = {
  reply: string; // CHECK: could be "response" / "message" / "bot_reply"
  extracted_data?: Record<string, unknown>;
  is_complete?: boolean; // CHECK: whatever the backend uses to say "assessment done"
};

export type SessionState = {
  session_id: string;
  extracted_data?: Record<string, unknown>; // CHECK: field name for the collected answers
  vulnerability_score?: number; // CHECK: field name, and is it 0-100? The guide lists no score endpoint.
};

// ---------------------------------------------------------------------------
// MOCK IMPLEMENTATION (delete this whole section once the backend is wired up)
// ---------------------------------------------------------------------------
const MOCK_SCRIPT = [
  "Hello! I'm GinhawAI. I'll ask a few questions to see which welfare programs may help you. What is your full name?",
  "Thank you. Which barangay do you live in?",
  "How many people are in your household, including you?",
  "What is your household's approximate monthly income in pesos?",
  "Thanks, that's everything I need. Please review your answers on the next screen.",
];

// The user's message at step N answers the question asked in reply N-1.
const MOCK_FIELDS = ["full_name", "barangay", "household_size", "monthly_income"];

// Shown on /confirm if the page is refreshed (the mock's memory is lost on refresh).
const MOCK_SAMPLE_DATA: Record<string, unknown> = {
  full_name: "Juan Dela Cruz",
  barangay: "Barangay Sample",
  household_size: "5",
  monthly_income: "8000",
};

const mockProgress = new Map<string, number>();
const mockData = new Map<string, Record<string, unknown>>();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mockStartSession(): Promise<SessionResponse> {
  await wait(300);
  const id = `mock-${Date.now()}`;
  mockProgress.set(id, 0);
  mockData.set(id, {});
  return { session_id: id };
}

async function mockSendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  await wait(700);
  const step = mockProgress.get(sessionId) ?? 0;
  mockProgress.set(sessionId, step + 1);

  const data = mockData.get(sessionId) ?? {};
  if (step >= 1 && step - 1 < MOCK_FIELDS.length) {
    data[MOCK_FIELDS[step - 1]] = message;
    mockData.set(sessionId, data);
  }

  return {
    reply: MOCK_SCRIPT[Math.min(step, MOCK_SCRIPT.length - 1)],
    extracted_data: { ...data },
    is_complete: step >= MOCK_SCRIPT.length - 1,
  };
}

// Fake scoring so the score page changes with your answers. NOT the real formula.
function mockScore(data: Record<string, unknown>): number {
  const num = (v: unknown) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;
  const income = num(data.monthly_income);
  const household = Math.max(num(data.household_size), 1);
  let score = 20;
  if (income > 0 && income <= 12000) score += 40;
  else if (income <= 25000) score += 20;
  score += Math.min(household, 8) * 5;
  return Math.min(score, 100);
}

async function mockGetSession(sessionId: string): Promise<SessionState> {
  await wait(300);
  const stored = mockData.get(sessionId);
  const data = stored && Object.keys(stored).length > 0 ? { ...stored } : MOCK_SAMPLE_DATA;
  return {
    session_id: sessionId,
    extracted_data: data,
    vulnerability_score: mockScore(data),
  };
}

// ---------------------------------------------------------------------------
// REAL IMPLEMENTATION
// ---------------------------------------------------------------------------
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Request to ${path} failed (${res.status}) ${detail}`);
  }
  return res.json() as Promise<T>;
}

export function startSession(language: string): Promise<SessionResponse> {
  if (USE_MOCK) return mockStartSession();
  return request<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ language }),
  });
}

export function sendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  if (USE_MOCK) return mockSendMessage(sessionId, message);
  return request<MessageResponse>(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function getSession(sessionId: string): Promise<SessionState> {
  if (USE_MOCK) return mockGetSession(sessionId);
  return request<SessionState>(`/api/sessions/${sessionId}`);
}

// ===========================================================================
// PROGRAMS (used by /recommendations)
// CHECK: field names below are guesses. Compare with http://localhost:8000/docs.
// ===========================================================================
export type Program = {
  program_id: string | number; // CHECK: might be "id"
  name: string; // CHECK: might be "program_name"
  description?: string;
};

// Eligibility / document rows may be plain strings or objects; the page copes with both.
export type ListItem = string | Record<string, unknown>;

const MOCK_PROGRAMS: Program[] = [
  {
    program_id: 1,
    name: "4Ps (Pantawid Pamilyang Pilipino Program)",
    description: "Cash grants for poor households to support children's health and education.",
  },
  {
    program_id: 2,
    name: "AICS (Assistance to Individuals in Crisis Situations)",
    description: "One-time help for people in crisis, such as medical, burial or food needs.",
  },
  {
    program_id: 3,
    name: "TUPAD",
    description: "Short-term emergency employment for displaced or disadvantaged workers.",
  },
];

// Placeholder rows so the UI has something to show. Not real program rules.
const MOCK_ELIGIBILITY: ListItem[] = [
  "Sample: household income below the local poverty threshold",
  "Sample: resident of the barangay",
];
const MOCK_DOCUMENTS: ListItem[] = [
  "Sample: Barangay certificate of indigency",
  "Sample: Valid ID",
];

export async function getPrograms(): Promise<Program[]> {
  if (USE_MOCK) {
    await wait(300);
    return MOCK_PROGRAMS;
  }
  return request<Program[]>("/api/programs");
}

export async function getProgramEligibility(programId: string | number): Promise<ListItem[]> {
  if (USE_MOCK) {
    await wait(300);
    return MOCK_ELIGIBILITY;
  }
  return request<ListItem[]>(`/api/programs/${programId}/eligibility`);
}

export async function getProgramDocuments(programId: string | number): Promise<ListItem[]> {
  if (USE_MOCK) {
    await wait(300);
    return MOCK_DOCUMENTS;
  }
  return request<ListItem[]>(`/api/programs/${programId}/documents`);
}