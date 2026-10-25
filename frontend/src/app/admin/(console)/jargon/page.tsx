"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { Btn, Card, ErrorText, inputClass, Loading, PageTitle, ViewOnly } from "@/components/admin/ui";
import { addJargon, deleteJargon, JargonData, JargonSlot, JargonTerm, listJargon, tryJargon, updateJargon } from "@/lib/adminApi";

// Knowledge Base Manager: "Edit Regional Bureaucratic Jargon Sets" (Appendix R #60)
// and "Cross-Reference Code-Switched Jargon" (#21). Staff teach the chat the
// local words citizens actually use ("arawan", "nag-abang", "nasunogan"…).
// Changes take effect immediately, for the built-in parser and the AI alike.

export default function JargonPage() {
  const { canEditWelfare: canEdit } = useAdmin();
  const [data, setData] = useState<JargonData | null>(null);
  const [slot, setSlot] = useState<JargonSlot>("employment_status");
  const [error, setError] = useState<string | null>(null);

  const reload = () => listJargon().then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  const current = data?.slots.find((s) => s.slot === slot);
  const byValue = useMemo(() => {
    const m: Record<string, JargonTerm[]> = {};
    for (const t of data?.terms ?? []) if (t.slot === slot) (m[t.value] ??= []).push(t);
    return m;
  }, [data, slot]);
  const total = data?.terms.filter((t) => t.slot === slot).length ?? 0;

  return (
    <>
      <PageTitle
        title="Local Terms"
        description="The everyday words citizens use for their situation, in Filipino, Bisaya or English. When an answer contains one of these words, the chat understands it, and the AI is told about them too. Changes apply right away."
        actions={canEdit ? undefined : <ViewOnly />}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!data && !error && <Loading />}

      {data && current && (
        <div className="space-y-4">
          <div role="tablist" aria-label="Question" className="inline-flex flex-wrap gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/5">
            {data.slots.map((s) => (
              <button
                key={s.slot}
                type="button"
                role="tab"
                aria-selected={slot === s.slot}
                onClick={() => setSlot(s.slot)}
                className={`rounded-xl px-3.5 py-1.5 text-[13px] font-semibold ${slot === s.slot ? "bg-white text-brand-800 shadow-sm dark:bg-white/15 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <TryPhrase slot={slot} label={current.label} />

          <Card title={`${current.label}: words the chat understands`} subtitle={`${total} words. When several match, the longest (most specific) one wins.`}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {current.values.map((v) => (
                <ValueGroup key={v.value} slot={slot} value={v.value} label={v.label} terms={byValue[v.value] ?? []} options={current.values} onChanged={reload} />
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function ValueGroup({
  slot, value, label, terms, options, onChanged,
}: { slot: JargonSlot; value: string; label: string; terms: JargonTerm[]; options: { value: string; label: string }[]; onChanged: () => void }) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<JargonTerm | null>(null);
  const { canEditWelfare: canEdit } = useAdmin();

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addJargon({ slot, value, term: word });
      setWord("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the word");
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: JargonTerm) {
    if (!confirm(`Remove "${t.term}"? The chat will no longer recognise it as "${label}".`)) return;
    try {
      await deleteJargon(t.term_id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the word");
    }
  }

  return (
    <div className="rounded-2xl bg-gray-50 p-3 dark:bg-white/4">
      <p className="mb-2 text-[13px] font-semibold text-gray-900 dark:text-white">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {terms.length === 0 && <span className="text-xs text-gray-400">No words yet.</span>}
        {terms.map((t) => (
          <span key={t.term_id} className="inline-flex items-center gap-1 rounded-full bg-white py-0.5 pl-2.5 pr-1 text-xs text-gray-800 ring-1 ring-black/5 dark:bg-white/10 dark:text-gray-100 dark:ring-white/10">
            {canEdit ? (
              <>
                <button type="button" onClick={() => setEditing(t)} className="hover:underline" title="Edit">{t.term}</button>
                <button type="button" onClick={() => remove(t)} aria-label={`Remove ${t.term}`} className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">×</button>
              </>
            ) : (
              <span className="pr-1.5">{t.term}</span>
            )}
          </span>
        ))}
      </div>
      {canEdit && (
        <form onSubmit={add} className="mt-2.5 flex gap-2">
          <input aria-label={`Add a word for ${label}`} maxLength={60} placeholder="Add a word or phrase…" className={`${inputClass} py-1.5 text-[13px]`} value={word} onChange={(e) => setWord(e.target.value)} />
          <Btn type="submit" variant="secondary" disabled={busy || word.trim().length < 2}>{busy ? "Adding…" : "Add"}</Btn>
        </form>
      )}
      {error && <div className="mt-2"><ErrorText>{error}</ErrorText></div>}
      {editing && <EditTerm term={editing} slot={slot} options={options} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}

function EditTerm({ term, slot, options, onClose, onSaved }: { term: JargonTerm; slot: JargonSlot; options: { value: string; label: string }[]; onClose: () => void; onSaved: () => void }) {
  const [word, setWord] = useState(term.term);
  const [value, setValue] = useState(term.value);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await updateJargon(term.term_id, { slot, value, term: word });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <form onSubmit={save} className="mt-2.5 space-y-2 rounded-xl bg-white p-2.5 ring-1 ring-brand-200 dark:bg-white/5 dark:ring-brand-500/30">
      <div className="flex flex-wrap gap-2">
        <input aria-label="Word" maxLength={60} className={`${inputClass} flex-1 py-1.5 text-[13px]`} value={word} onChange={(e) => setWord(e.target.value)} />
        <select aria-label="Means" className={`${inputClass} w-auto py-1.5 text-[13px]`} value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>means: {o.label}</option>)}
        </select>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn type="submit" disabled={word.trim().length < 2}>Save</Btn>
      </div>
    </form>
  );
}

function TryPhrase({ slot, label }: { slot: JargonSlot; label: string }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ value: string | null; label: string | null } | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setResult(await tryJargon(slot, text).catch(() => ({ value: null, label: null })));
  }

  return (
    <Card title="Try an answer" subtitle={`Type something a citizen might say about their ${label.toLowerCase()}, and see how the chat reads it.`}>
      <form onSubmit={run} className="flex gap-2">
        <input aria-label="Citizen's answer" placeholder="e.g. nag-arawan ko sa construction" className={inputClass} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} />
        <Btn type="submit" disabled={!text.trim()}>Try</Btn>
      </form>
      {result && (
        <p className={`mt-2 text-[13px] font-medium ${result.value ? "text-brand-700 dark:text-brand-300" : "text-amber-700 dark:text-amber-300"}`}>
          {result.value ? `Understood as: ${result.label}` : "Not understood by the word list. Add a word above, or the AI will try to read it."}
        </p>
      )}
    </Card>
  );
}
