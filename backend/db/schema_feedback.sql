-- Citizen Feedback & Satisfaction Management module
-- Deliberately has NO foreign keys and NO citizen identifier of any kind —
-- feedback is fully anonymous by design, matching the manuscript's privacy requirements.

CREATE TABLE feedback_logs (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- same ID pattern as every other table
    sus_score INTEGER NOT NULL,                               -- System Usability Scale rating (e.g. 1-5)
    qualitative_feedback TEXT,                                -- optional freeform comment, nullable = citizen can skip it
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()           -- when the feedback came in
);