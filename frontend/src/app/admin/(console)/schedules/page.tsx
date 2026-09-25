"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Btn, Card, EmptyState, ErrorText, Field, fmtDate, inputClass, Loading, Modal, PageTitle, SampleDataNotice, Segmented } from "@/components/admin/ui";
import { AdminProgram, deleteSchedule, LIVE, listOffices, listPrograms, listSchedules, Office, saveSchedule, Schedule } from "@/lib/adminApi";

// "Insert Local Barangay Aid Schedules" (Fig. 9) — seasonal barangay livelihood
// tracks, health-center feeding calendars, registration drives, etc. Citizens
// see active schedules for their barangay in their program recommendations.

type Filter = "current" | "past" | "all";
const today = () => new Date().toISOString().slice(0, 10);

function status(s: Schedule) {
  const t = today();
  if (s.end_date < t) return { label: "Ended", tone: "gray" as const };
  if (s.start_date <= t) return { label: "Ongoing", tone: "green" as const };
  const days = Math.ceil((new Date(s.start_date).getTime() - Date.now()) / 864e5);
  return { label: days <= 7 ? `Starts in ${days}d` : "Upcoming", tone: days <= 7 ? ("amber" as const) : ("blue" as const) };
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("current");
  const [programFilter, setProgramFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<Schedule> | null>(null);

  useEffect(() => {
    Promise.all([listSchedules(), listPrograms(), listOffices()])
      .then(([s, p, o]) => {
        setSchedules(s);
        setPrograms(p);
        setOffices(o);
      })
      .catch((e) => setError(e.message));
  }, []);

  const programName = (id: string) => programs.find((p) => p.program_id === id)?.program_name ?? "Unknown program";
  const office = (id: string) => offices.find((o) => o.office_id === id);

  const t = today();
  const visible = (schedules ?? [])
    .filter((s) => (filter === "current" ? s.end_date >= t : filter === "past" ? s.end_date < t : true))
    .filter((s) => programFilter === "all" || s.program_id === programFilter)
    .sort((a, b) => (filter === "past" ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date)));

  async function remove(s: Schedule) {
    if (!confirm(`Delete the ${programName(s.program_id)} schedule (${fmtDate(s.start_date)})?`)) return;
    try {
      await deleteSchedule(s.schedule_id);
      setSchedules((ss) => ss!.filter((x) => x.schedule_id !== s.schedule_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <>
      <PageTitle
        title="Barangay Aid Schedules"
        description="Local distribution and registration dates. Active schedules appear in citizens' recommendations and SMS checklists for the matching program."
        actions={<Btn onClick={() => setEditing({})}>+ Add schedule</Btn>}
      />
      {!LIVE.schedules && <SampleDataNotice what="Barangay schedules" />}
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "current", label: "Ongoing & upcoming" },
            { value: "past", label: "Ended" },
            { value: "all", label: "All" },
          ]}
        />
        <select aria-label="Filter by program" className={`${inputClass} sm:w-64`} value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
          <option value="all">All programs</option>
          {programs.map((p) => (
            <option key={p.program_id} value={p.program_id}>
              {p.program_name}
            </option>
          ))}
        </select>
      </div>

      {!schedules && !error && <Loading />}
      {schedules && visible.length === 0 && <EmptyState title="No schedules here">Add one so citizens know when and where to go.</EmptyState>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((s) => {
          const st = status(s);
          const o = office(s.office_id);
          return (
            <Card key={s.schedule_id} className="flex flex-col !p-4">
              <div className="flex items-start gap-3">
                <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-brand-50 py-2 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
                  <span className="text-[10px] font-semibold uppercase">{new Date(s.start_date).toLocaleDateString("en-PH", { month: "short" })}</span>
                  <span className="text-xl font-bold leading-none">{new Date(s.start_date).getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Badge tone={st.tone} dot>{st.label}</Badge>
                  <p className="mt-1.5 text-[13px] font-semibold leading-snug text-gray-900 dark:text-white">{programName(s.program_id)}</p>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex gap-2">
                  <dt className="w-12 shrink-0 text-gray-400 dark:text-gray-500">When</dt>
                  <dd>{fmtDate(s.start_date)} – {fmtDate(s.end_date)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-12 shrink-0 text-gray-400 dark:text-gray-500">Where</dt>
                  <dd>{o?.office_name ?? "—"}</dd>
                </div>
              </dl>
              {s.notes && <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">{s.notes}</p>}
              <div className="mt-auto flex justify-end gap-1 pt-3">
                <Btn variant="ghost" onClick={() => setEditing(s)}>Edit</Btn>
                <Btn variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={() => remove(s)}>Delete</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      <ScheduleModal
        value={editing}
        programs={programs}
        offices={offices}
        onClose={() => setEditing(null)}
        onSaved={(s) => {
          setSchedules((ss) => (ss!.some((x) => x.schedule_id === s.schedule_id) ? ss!.map((x) => (x.schedule_id === s.schedule_id ? s : x)) : [...ss!, s]));
          setEditing(null);
        }}
      />
    </>
  );
}

function ScheduleModal({ value, programs, offices, onClose, onSaved }: { value: Partial<Schedule> | null; programs: AdminProgram[]; offices: Office[]; onClose: () => void; onSaved: (s: Schedule) => void }) {
  const blank = { program_id: "", office_id: "", start_date: today(), end_date: today(), notes: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      setForm({
        program_id: value.program_id ?? programs.find((p) => p.is_active)?.program_id ?? "",
        office_id: value.office_id ?? offices[0]?.office_id ?? "",
        start_date: value.start_date ?? today(),
        end_date: value.end_date ?? today(),
        notes: value.notes ?? "",
      });
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.end_date < form.start_date) {
      setError("The end date can't be before the start date.");
      return;
    }
    setBusy(true);
    try {
      onSaved(await saveSchedule({ ...form, notes: form.notes || null, schedule_id: value?.schedule_id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={value?.schedule_id ? "Edit aid schedule" : "Add aid schedule"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="schedule-form" disabled={busy}>{busy ? "Saving…" : "Save schedule"}</Btn>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit} className="space-y-4">
        <Field label="Program">
          {(id) => (
            <select id={id} required className={inputClass} value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
              {programs.map((p) => (
                <option key={p.program_id} value={p.program_id}>
                  {p.program_name}
                  {p.is_active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Host office / venue">
          {(id) => (
            <select id={id} required className={inputClass} value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value })}>
              {offices.map((o) => (
                <option key={o.office_id} value={o.office_id}>
                  {o.office_name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">{(id) => <input id={id} type="date" required className={inputClass} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />}</Field>
          <Field label="End date">{(id) => <input id={id} type="date" required className={inputClass} value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />}</Field>
        </div>
        <Field label="Notes for citizens" hint="Time, who can join, what to bring. Keep it short — this may be sent by SMS.">
          {(id) => <textarea id={id} rows={3} maxLength={300} className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
