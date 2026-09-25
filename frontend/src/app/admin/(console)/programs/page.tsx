"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Btn, Card, EmptyState, ErrorText, Field, inputClass, Loading, Modal, PageTitle, Segmented, Table, td, th, Toggle } from "@/components/admin/ui";
import {
  AdminProgram,
  AttributeMeta,
  createProgram,
  Criterion,
  deleteCriterion,
  deleteDocument,
  DocumentReq,
  listAttributes,
  listCriteria,
  listDocuments,
  listPrograms,
  OPERATORS,
  saveCriterion,
  saveDocument,
  updateProgram,
} from "@/lib/adminApi";

// "Manage Program Rules Matrix" (Fig. 9) + Knowledge Base Manager modules:
// Modify Eligibility Filter Boundaries, Manage Welfare Program Listings,
// Manage Document Requirement Templates.

type Tab = "criteria" | "documents";

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<AdminProgram[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    listPrograms()
      .then((p) => {
        setPrograms(p);
        setSelected((cur) => cur ?? p[0]?.program_id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function toggleActive(p: AdminProgram, v: boolean) {
    setPrograms((ps) => ps!.map((x) => (x.program_id === p.program_id ? { ...x, is_active: v } : x)));
    try {
      await updateProgram(p.program_id, { is_active: v });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      load();
    }
  }

  const filtered = programs?.filter((p) => `${p.program_name} ${p.agency}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  const current = programs?.find((p) => p.program_id === selected) ?? null;

  return (
    <>
      <PageTitle
        title="Program Rules Matrix"
        description="The eligibility rules and document checklists the assessment uses to match citizens with programs. Changes apply to new assessments right away and are recorded in the audit log."
        actions={<Btn onClick={() => setAdding(true)}>+ Add program</Btn>}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!programs && !error && <Loading />}

      {programs && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit !p-3">
            <input type="search" placeholder="Search programs…" aria-label="Search programs" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} mb-2`} />
            <ul className="space-y-1">
              {filtered.map((p) => (
                <li key={p.program_id}>
                  <div
                    className={`flex items-start gap-2 rounded-2xl p-3 transition ${selected === p.program_id ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}
                  >
                    <button type="button" onClick={() => setSelected(p.program_id)} className="min-w-0 flex-1 text-left focus:outline-none focus-visible:underline">
                      <p className={`text-[13px] font-semibold leading-snug ${p.is_active ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>{p.program_name}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge tone="gray">{p.agency}</Badge>
                        <Badge tone={p.scope === "National" ? "blue" : "brand"}>{p.scope}</Badge>
                      </div>
                    </button>
                    <Toggle checked={p.is_active} onChange={(v) => toggleActive(p, v)} label={`${p.program_name} active`} />
                  </div>
                </li>
              ))}
              {filtered.length === 0 && <li className="p-3 text-[13px] text-gray-500">No programs match.</li>}
            </ul>
          </Card>

          {current ? <ProgramDetail key={current.program_id} program={current} /> : <EmptyState title="Select a program" />}
        </div>
      )}

      <AddProgramModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(p) => {
          setPrograms((ps) => [...(ps ?? []), p]);
          setSelected(p.program_id);
          setAdding(false);
        }}
      />
    </>
  );
}

function ProgramDetail({ program }: { program: AdminProgram }) {
  const [tab, setTab] = useState<Tab>("criteria");
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [docs, setDocs] = useState<DocumentReq[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editCriterion, setEditCriterion] = useState<Partial<Criterion> | null>(null);
  const [editDoc, setEditDoc] = useState<Partial<DocumentReq> | null>(null);
  const [attributes, setAttributes] = useState<AttributeMeta[]>([]);

  useEffect(() => {
    Promise.all([listCriteria(program.program_id), listDocuments(program.program_id), listAttributes()])
      .then(([c, d, a]) => {
        setCriteria(c);
        setDocs(d);
        setAttributes(a);
      })
      .catch((e) => setError(e.message));
  }, [program.program_id]);

  const totalWeight = criteria?.reduce((a, c) => a + Number(c.weight), 0) ?? 0;

  async function removeCriterion(c: Criterion) {
    if (!confirm(`Delete the rule "${c.attribute} ${c.operator} ${c.threshold_value}"?`)) return;
    try {
      await deleteCriterion(program.program_id, c.criteria_id);
      setCriteria((cs) => cs!.filter((x) => x.criteria_id !== c.criteria_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }
  async function removeDoc(d: DocumentReq) {
    if (!confirm(`Remove "${d.document_name}" from the checklist?`)) return;
    try {
      await deleteDocument(program.program_id, d.doc_id);
      setDocs((ds) => ds!.filter((x) => x.doc_id !== d.doc_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-snug text-gray-900 dark:text-white">{program.program_name}</h2>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            {program.agency} · {program.scope} scope ·{" "}
            {program.is_active ? <span className="text-brand-700 dark:text-brand-300">Open for eligibility checks</span> : <span>Hidden from citizens</span>}
          </p>
        </div>
        <Segmented
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "criteria", label: `Eligibility rules${criteria ? ` (${criteria.length})` : ""}` },
            { value: "documents", label: `Documents${docs ? ` (${docs.length})` : ""}` },
          ]}
        />
      </div>

      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {(!criteria || !docs) && !error && <Loading />}

      {tab === "criteria" && criteria && (
        <>
          {criteria.length === 0 ? (
            <EmptyState title="No eligibility rules yet">Add a rule so the assessment can evaluate this program.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>Household attribute</th>
                  <th className={th}>Rule</th>
                  <th className={th}>Weight</th>
                  <th className={`${th} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <tr key={c.criteria_id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                    <td className={td}>
                      <p className="text-[13px] text-gray-900 dark:text-gray-100">{attributes.find((a) => a.attribute === c.attribute)?.label ?? c.attribute}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <code className="font-mono text-[11px] text-gray-400">{c.attribute}</code>
                        {attributes.length > 0 && !attributes.find((a) => a.attribute === c.attribute)?.computed && <Badge tone="amber">Verified at office</Badge>}
                      </div>
                    </td>
                    <td className={td}>
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] dark:bg-white/10">{c.operator}</span>{" "}
                      <span className="font-medium">{c.threshold_value}</span>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(1, Number(c.weight)) * 100}%` }} />
                        </div>
                        <span className="tabular-nums">{Number(c.weight).toFixed(2)}</span>
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <Btn variant="ghost" onClick={() => setEditCriterion(c)}>Edit</Btn>
                      <Btn variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={() => removeCriterion(c)}>Delete</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs ${Math.abs(totalWeight - 1) < 0.001 || criteria.length === 0 ? "text-gray-500 dark:text-gray-400" : "font-semibold text-amber-700 dark:text-amber-300"}`}>
              Total weight: {totalWeight.toFixed(2)} {criteria.length > 0 && Math.abs(totalWeight - 1) >= 0.001 && "— weights usually add up to 1.00"}
            </p>
            <Btn variant="secondary" onClick={() => setEditCriterion({})}>+ Add rule</Btn>
          </div>
        </>
      )}

      {tab === "documents" && docs && (
        <>
          {docs.length === 0 ? (
            <EmptyState title="No documents listed">Citizens will see an empty checklist for this program.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.doc_id} className="flex items-start gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.04]">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-black/5 dark:bg-white/5 dark:text-brand-300 dark:ring-white/10">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{d.document_name}</p>
                      {d.is_mandatory ? <Badge tone="brand">Required</Badge> : <Badge>Optional</Badge>}
                    </div>
                    {d.notes && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{d.notes}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <Btn variant="ghost" onClick={() => setEditDoc(d)}>Edit</Btn>
                    <Btn variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={() => removeDoc(d)}>Remove</Btn>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end">
            <Btn variant="secondary" onClick={() => setEditDoc({ is_mandatory: true })}>+ Add document</Btn>
          </div>
        </>
      )}

      <CriterionModal
        programId={program.program_id}
        attributes={attributes}
        value={editCriterion}
        onClose={() => setEditCriterion(null)}
        onSaved={(c) => {
          setCriteria((cs) => (cs!.some((x) => x.criteria_id === c.criteria_id) ? cs!.map((x) => (x.criteria_id === c.criteria_id ? c : x)) : [...cs!, c]));
          setEditCriterion(null);
        }}
      />
      <DocumentModal
        programId={program.program_id}
        value={editDoc}
        onClose={() => setEditDoc(null)}
        onSaved={(d) => {
          setDocs((ds) => (ds!.some((x) => x.doc_id === d.doc_id) ? ds!.map((x) => (x.doc_id === d.doc_id ? d : x)) : [...ds!, d]));
          setEditDoc(null);
        }}
      />
    </Card>
  );
}

function AddProgramModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: AdminProgram) => void }) {
  const [form, setForm] = useState({ program_name: "", agency: "", scope: "Municipal", is_active: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await createProgram(form));
      setForm({ program_name: "", agency: "", scope: "Municipal", is_active: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add welfare program"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="add-program" disabled={busy}>{busy ? "Saving…" : "Add program"}</Btn>
        </>
      }
    >
      <form id="add-program" onSubmit={submit} className="space-y-4">
        <Field label="Program name">{(id) => <input id={id} required className={inputClass} value={form.program_name} onChange={(e) => setForm({ ...form, program_name: e.target.value })} placeholder="e.g. Livelihood Seed Capital Fund" />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Administering agency">{(id) => <input id={id} required className={inputClass} value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} placeholder="DSWD, DOLE, LGU…" />}</Field>
          <Field label="Scope">
            {(id) => (
              <select id={id} className={inputClass} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option>National</option>
                <option>Municipal</option>
                <option>Barangay</option>
              </select>
            )}
          </Field>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Open for eligibility checks now</span>
          <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Active" />
        </label>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}

function CriterionModal({ programId, attributes, value, onClose, onSaved }: { programId: string; attributes: AttributeMeta[]; value: Partial<Criterion> | null; onClose: () => void; onSaved: (c: Criterion) => void }) {
  const [form, setForm] = useState({ attribute: "monthly_income", operator: "<=", threshold_value: "", weight: "0.25" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  // Reset the form whenever a different rule is opened.
  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      setForm({
        attribute: value.attribute ?? "monthly_income",
        operator: value.operator ?? "<=",
        threshold_value: value.threshold_value ?? "",
        weight: String(value.weight ?? "0.25"),
      });
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const w = Number(form.weight);
    if (Number.isNaN(w) || w < 0 || w > 1) {
      setError("Weight must be between 0 and 1.");
      return;
    }
    setBusy(true);
    try {
      onSaved(await saveCriterion(programId, { ...form, weight: w, criteria_id: value?.criteria_id }));
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
      title={value?.criteria_id ? "Edit eligibility rule" : "Add eligibility rule"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="criterion-form" disabled={busy}>{busy ? "Saving…" : "Save rule"}</Btn>
        </>
      }
    >
      <form id="criterion-form" onSubmit={submit} className="space-y-4">
        <Field
          label="Household attribute"
          hint={
            attributes.find((a) => a.attribute === form.attribute)?.computed === false
              ? "The chat can't check this one — citizens will see it as “to be verified at the office”."
              : "Checked automatically from the citizen's chat answers."
          }
        >
          {(id) => (
            <select id={id} className={inputClass} value={form.attribute} onChange={(e) => setForm({ ...form, attribute: e.target.value })}>
              {!attributes.some((a) => a.attribute === form.attribute) && <option value={form.attribute}>{form.attribute}</option>}
              <optgroup label="Checked from the chat">
                {attributes.filter((a) => a.computed).map((a) => (
                  <option key={a.attribute} value={a.attribute}>{a.label}</option>
                ))}
              </optgroup>
              <optgroup label="Verified at the office">
                {attributes.filter((a) => !a.computed).map((a) => (
                  <option key={a.attribute} value={a.attribute}>{a.label}</option>
                ))}
              </optgroup>
            </select>
          )}
        </Field>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="Operator">
            {(id) => (
              <select id={id} className={`${inputClass} font-mono`} value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}>
                {OPERATORS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Threshold value" hint={form.operator === "in" ? "Comma-separated, e.g. unemployed,displaced" : "Use true / false for yes-no answers"}>
            {(id) => <input id={id} required className={inputClass} value={form.threshold_value} onChange={(e) => setForm({ ...form, threshold_value: e.target.value })} />}
          </Field>
        </div>
        <Field label="Weight (0–1)" hint="How much this rule counts toward the program's match score.">
          {(id) => <input id={id} type="number" step="0.05" min="0" max="1" required className={inputClass} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />}
        </Field>
        <div className="rounded-xl bg-gray-50 px-3 py-2 font-mono text-[12px] text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
          qualifies if <strong>{form.attribute}</strong> {form.operator} <strong>{form.threshold_value || "…"}</strong>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}

function DocumentModal({ programId, value, onClose, onSaved }: { programId: string; value: Partial<DocumentReq> | null; onClose: () => void; onSaved: (d: DocumentReq) => void }) {
  const [form, setForm] = useState({ document_name: "", is_mandatory: true, notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      setForm({ document_name: value.document_name ?? "", is_mandatory: value.is_mandatory ?? true, notes: value.notes ?? "" });
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await saveDocument(programId, { ...form, notes: form.notes || null, doc_id: value?.doc_id }));
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
      title={value?.doc_id ? "Edit document requirement" : "Add document requirement"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="doc-form" disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
        </>
      }
    >
      <form id="doc-form" onSubmit={submit} className="space-y-4">
        <Field label="Document name">{(id) => <input id={id} required className={inputClass} value={form.document_name} onChange={(e) => setForm({ ...form, document_name: e.target.value })} placeholder="e.g. Certificate of Indigency" />}</Field>
        <Field label="Notes for citizens" hint="Plain language — this is shown in the checklist and sent via SMS.">
          {(id) => <textarea id={id} rows={3} className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Where to get it, what to bring…" />}
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Required (missing it disqualifies the applicant)</span>
          <Toggle checked={form.is_mandatory} onChange={(v) => setForm({ ...form, is_mandatory: v })} label="Required" />
        </label>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
