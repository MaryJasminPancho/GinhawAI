"use client";

import { FormEvent, useEffect, useState } from "react";
import { Btn, Card, EmptyState, ErrorText, Field, inputClass, Loading, Modal, PageTitle } from "@/components/admin/ui";
import { Barangay, listBarangays, listOffices, Office, saveOffice } from "@/lib/adminApi";

// "Update Municipal Office Directories" (Fig. 9). These details appear on the
// citizen's Document Checklist & Office Directory screen (Fig. 21) and in the
// SMS sent through Semaphore, so they're kept as short plain text.

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Office> | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([listOffices(), listBarangays()])
      .then(([o, b]) => {
        setOffices(o);
        setBarangays(b);
      })
      .catch((e) => setError(e.message));
  }, []);

  const bName = (code: string | null) => barangays.find((b) => b.barangay_code === code)?.barangay_name ?? code ?? "City-wide";
  const visible = (offices ?? []).filter((o) => `${o.office_name} ${o.address} ${bName(o.barangay_code)}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <PageTitle
        title="Office Directory"
        description="Where citizens go to apply. Shown on the checklist screen and included in the SMS they receive."
        actions={<Btn onClick={() => setEditing({})}>+ Add office</Btn>}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      <input type="search" aria-label="Search offices" placeholder="Search by name, address or barangay…" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} mb-4 sm:max-w-sm`} />
      {!offices && !error && <Loading />}
      {offices && visible.length === 0 && <EmptyState title="No offices found" />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((o) => (
          <Card key={o.office_id} className="flex flex-col !p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4M2 21h20" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-snug text-gray-900 dark:text-white">{o.office_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Brgy. {bName(o.barangay_code)}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <Row icon="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" value={o.address} />
              <Row icon="M12 7v5l3 2M3 12a9 9 0 1018 0 9 9 0 00-18 0z" value={o.operating_hours} />
              <Row icon="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" value={o.contact_number} />
            </dl>
            <div className="mt-auto flex justify-end pt-3">
              <Btn variant="ghost" onClick={() => setEditing(o)}>Edit</Btn>
            </div>
          </Card>
        ))}
      </div>

      <OfficeModal
        value={editing}
        barangays={barangays}
        onClose={() => setEditing(null)}
        onSaved={(o) => {
          setOffices((os) => (os!.some((x) => x.office_id === o.office_id) ? os!.map((x) => (x.office_id === o.office_id ? o : x)) : [...os!, o]));
          setEditing(null);
        }}
      />
    </>
  );
}

function Row({ icon, value }: { icon: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <svg className="mt-0.5 shrink-0 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d={icon} />
      </svg>
      <dd className={value ? "text-gray-700 dark:text-gray-300" : "italic text-gray-400 dark:text-gray-500"}>{value || "Not set"}</dd>
    </div>
  );
}

function OfficeModal({ value, barangays, onClose, onSaved }: { value: Partial<Office> | null; barangays: Barangay[]; onClose: () => void; onSaved: (o: Office) => void }) {
  const [form, setForm] = useState({ office_name: "", address: "", barangay_code: "", contact_number: "", operating_hours: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      setForm({
        office_name: value.office_name ?? "",
        address: value.address ?? "",
        barangay_code: value.barangay_code ?? barangays[0]?.barangay_code ?? "",
        contact_number: value.contact_number ?? "",
        operating_hours: value.operating_hours ?? "Mon–Fri, 8:00 AM – 5:00 PM",
      });
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(
        await saveOffice({
          office_id: value?.office_id,
          office_name: form.office_name,
          address: form.address || null,
          barangay_code: form.barangay_code || null,
          contact_number: form.contact_number || null,
          operating_hours: form.operating_hours || null,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const smsPreview = `${form.office_name || "Office name"}\n${form.address || "Address"}\n${form.operating_hours || ""}${form.contact_number ? `\nTel: ${form.contact_number}` : ""}`;

  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={value?.office_id ? "Edit office" : "Add office"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="office-form" disabled={busy}>{busy ? "Saving…" : "Save office"}</Btn>
        </>
      }
    >
      <form id="office-form" onSubmit={submit} className="space-y-4">
        <Field label="Office name">{(id) => <input id={id} required className={inputClass} value={form.office_name} onChange={(e) => setForm({ ...form, office_name: e.target.value })} />}</Field>
        <Field label="Address">{(id) => <textarea id={id} rows={2} className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}</Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Barangay">
            {(id) => (
              <select id={id} className={inputClass} value={form.barangay_code} onChange={(e) => setForm({ ...form, barangay_code: e.target.value })}>
                {barangays.map((b) => (
                  <option key={b.barangay_code} value={b.barangay_code}>
                    {b.barangay_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Contact number">{(id) => <input id={id} className={inputClass} value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="(032) 000-0000" />}</Field>
        </div>
        <Field label="Operating hours">{(id) => <input id={id} className={inputClass} value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} />}</Field>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">SMS preview</p>
          <pre className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3 font-sans text-[13px] leading-relaxed text-gray-800 dark:bg-white/[0.06] dark:text-gray-100">{smsPreview}</pre>
          <p className="mt-1 text-[11px] text-gray-400">{smsPreview.length} characters · the office block is appended to the document checklist SMS</p>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
