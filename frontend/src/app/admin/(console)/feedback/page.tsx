"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Btn, Card, EmptyState, ErrorText, fmtDateTime, inputClass, Loading, PageTitle, PrivacyChip, StatCard } from "@/components/admin/ui";
import { Feedback, FeedbackStatus, getFeedback, updateFeedbackStatus } from "@/lib/adminApi";
import { susGrade } from "@/lib/adminAnalytics";

// "Track Feedback Resolution Status" (Appendix R #70). Citizens' feedback is
// anonymous; staff only mark what they've read and what they did about it.

const STATUS: Record<FeedbackStatus, { label: string; tone: "blue" | "amber" | "green" }> = {
  new: { label: "New", tone: "blue" },
  seen: { label: "Seen", tone: "amber" },
  acted_on: { label: "Acted on", tone: "green" },
};
type Filter = FeedbackStatus | "all";

export default function FeedbackPage() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("new");
  const [commentsOnly, setCommentsOnly] = useState(true);

  useEffect(() => {
    getFeedback(12).then(setItems).catch((e) => setError(e.message));
  }, []);

  const counts = useMemo(() => {
    const c = { new: 0, seen: 0, acted_on: 0 };
    for (const f of items ?? []) if (!commentsOnly || f.qualitative_feedback) c[f.status]++;
    return c;
  }, [items, commentsOnly]);
  const shown = (items ?? []).filter((f) => (filter === "all" || f.status === filter) && (!commentsOnly || f.qualitative_feedback));

  function replace(f: Feedback) {
    setItems((all) => all?.map((x) => (x.feedback_id === f.feedback_id ? f : x)) ?? null);
  }

  return (
    <>
      <PageTitle
        title="Citizen Feedback"
        description="What citizens said after their assessment (last 12 months). Mark each one as seen, and as acted on once something was done about it. Feedback is anonymous."
        actions={<PrivacyChip />}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!items && !error && <Loading />}

      {items && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="New" value={counts.new} hint="Not read yet" tone={counts.new ? "amber" : "gray"} />
            <StatCard label="Seen" value={counts.seen} hint="Read, nothing done yet" tone="gray" />
            <StatCard label="Acted on" value={counts.acted_on} hint="Something was done about it" tone="brand" />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Status" className="inline-flex flex-wrap gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/5">
              {(["new", "seen", "acted_on", "all"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold ${filter === f ? "bg-white text-brand-800 shadow-sm dark:bg-white/15 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {f === "all" ? "All" : STATUS[f].label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={commentsOnly} onChange={(e) => setCommentsOnly(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Only feedback with a written comment
            </label>
          </div>

          {shown.length === 0 ? (
            <EmptyState title="Nothing here">No feedback matches this filter.</EmptyState>
          ) : (
            <div className="space-y-3">
              {shown.map((f) => <FeedbackItem key={f.feedback_id} f={f} onSaved={replace} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FeedbackItem({ f, onSaved }: { f: Feedback; onSaved: (f: Feedback) => void }) {
  const [note, setNote] = useState(f.staff_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(status: FeedbackStatus) {
    setBusy(true);
    setError(null);
    try {
      const r = await updateFeedbackStatus(f.feedback_id, status, note.trim() || null);
      onSaved({ ...f, status: r.status, staff_note: r.staff_note, status_updated_at: r.status_updated_at, status_updated_by: "you" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const st = STATUS[f.status];
  return (
    <Card title={`SUS ${f.sus_score} · ${susGrade(f.sus_score)}`} subtitle={fmtDateTime(f.submitted_at)} actions={<Badge tone={st.tone} dot>{st.label}</Badge>}>
      {f.qualitative_feedback ? (
        <blockquote className="rounded-xl bg-gray-50 px-3 py-2 text-[14px] leading-relaxed text-gray-800 dark:bg-white/4 dark:text-gray-100">&ldquo;{f.qualitative_feedback}&rdquo;</blockquote>
      ) : (
        <p className="text-xs text-gray-400">No written comment, only the usability score.</p>
      )}
      <div className="mt-3 space-y-2">
        <textarea
          aria-label="Staff note"
          rows={2}
          maxLength={1000}
          placeholder="What was done about it? (optional, staff only)"
          className={`${inputClass} text-[13px]`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400">
            {f.status_updated_at ? `Updated ${fmtDateTime(f.status_updated_at)}${f.status_updated_by ? ` by ${f.status_updated_by}` : ""}` : "Not handled yet"}
          </p>
          <div className="flex gap-1.5">
            {f.status !== "seen" && <Btn variant="secondary" disabled={busy} onClick={() => set("seen")}>Mark seen</Btn>}
            {f.status !== "acted_on" && <Btn disabled={busy} onClick={() => set("acted_on")}>Mark acted on</Btn>}
            {f.status === "acted_on" && note.trim() !== (f.staff_note ?? "") && <Btn disabled={busy} onClick={() => set("acted_on")}>Save note</Btn>}
            {f.status !== "new" && <Btn variant="ghost" disabled={busy} onClick={() => set("new")}>Reopen</Btn>}
          </div>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Card>
  );
}
