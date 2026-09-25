"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Btn, Card, EmptyState, ErrorText, Field, inputClass, Loading, Modal, PageTitle, Segmented, Table, td, th } from "@/components/admin/ui";
import { Barangay, deleteOffice, listBarangays, listOffices, Office, saveBarangay, saveOffice } from "@/lib/adminApi";

// "Update Municipal Office Directories" (Fig. 9). Offices appear on the
// citizen's Document Checklist & Office Directory screen (Fig. 21) and in the
// SMS sent through Semaphore. Barangays are the geographic reference for the
// chat (citizens name their barangay) and for the heatmap (map coordinates).

type Tab = "offices" | "barangays";

export default function OfficesPage() {
  const [tab, setTab] = useState<Tab>("offices");
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Office> | null>(null);
  const [editingBrgy, setEditingBrgy] = useState<{ value: Barangay; isNew: boolean } | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([listOffices(), listBarangays()])
      .then(([o, b]) => {
        setOffices(o);
        setBarangays(b);
      })
      .catch((e) => setError(e.message));
  }, []);

  const bName = (code: string | null) => (code ? barangays.find((b) => b.barangay_code === code)?.barangay_name ?? code : "City-wide");
  const q = query.toLowerCase();
  const visible = (offices ?? []).filter((o) => `${o.office_name} ${o.address} ${bName(o.barangay_code)}`.toLowerCase().includes(q));
  const visibleBrgy = barangays.filter((b) => `${b.barangay_name} ${b.barangay_code}`.toLowerCase().includes(q));

  async function remove(o: Office) {
    if (!confirm(`Remove ${o.office_name} from the directory? Its aid schedules will be removed too.`)) return;
    try {
      await deleteOffice(o.office_id);
      setOffices((os) => os!.filter((x) => x.office_id !== o.office_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <>
      <PageTitle
        title="Office Directory"
        description="Where citizens go to apply, and the barangays they can choose from. Offices are shown on the checklist screen and included in the SMS citizens receive."
        actions={
          tab === "offices" ? (
            <Btn onClick={() => setEditing({})}>+ Add office</Btn>
          ) : (
            <Btn onClick={() => setEditingBrgy({ value: { barangay_code: "", barangay_name: "", city_municipality: "Cebu City", latitude: null, longitude: null }, isNew: true })}>+ Add barangay</Btn>
          )
        }
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "offices", label: `Offices${offices ? ` (${offices.length})` : ""}` },
            { value: "barangays", label: `Barangays (${barangays.length})` },
          ]}
        />
        <input type="search" aria-label="Search" placeholder={tab === "offices" ? "Search by name, address or barangay…" : "Search barangays…"} value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} sm:max-w-sm`} />
      </div>

      {!offices && !error && <Loading />}

      {tab === "offices" && offices && (
        <>
          {visible.length === 0 && <EmptyState title="No offices yet">Add the offices where citizens apply for assistance.</EmptyState>}
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">{o.barangay_code ? `Brgy. ${bName(o.barangay_code)}` : "City-wide"}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5 text-[13px]">
                  <Row icon="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z" value={o.address} />
                  <Row icon="M12 7v5l3 2M3 12a9 9 0 1018 0 9 9 0 00-18 0z" value={o.operating_hours} />
                  <Row icon="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" value={o.contact_number} />
                </dl>
                <div className="mt-auto flex justify-end gap-1 pt-3">
                  <Btn variant="ghost" onClick={() => setEditing(o)}>Edit</Btn>
                  <Btn variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={() => remove(o)}>Remove</Btn>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "barangays" && offices && (
        <Card>
          {visibleBrgy.length === 0 ? (
            <EmptyState title="No barangays">Add the barangays citizens can choose in the chat.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>Barangay</th>
                  <th className={th}>PSA code</th>
                  <th className={th}>City / municipality</th>
                  <th className={th}>Map location</th>
                  <th className={`${th} text-right`}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleBrgy.map((b) => (
                  <tr key={b.barangay_code}>
                    <td className={`${td} font-medium`}>{b.barangay_name}</td>
                    <td className={td}>
                      <code className="font-mono text-[12px]">{b.barangay_code}</code>
                      {b.barangay_code.startsWith("DEV-") && <span className="ml-2"><Badge tone="amber">Placeholder code</Badge></span>}
                    </td>
                    <td className={`${td} text-gray-500`}>{b.city_municipality}</td>
                    <td className={`${td} tabular-nums text-gray-500`}>
                      {b.latitude != null && b.longitude != null ? `${b.latitude.toFixed(4)}, ${b.longitude.toFixed(4)}` : <Badge tone="amber">Not on map</Badge>}
                    </td>
                    <td className={`${td} text-right`}>
                      <Btn variant="ghost" onClick={() => setEditingBrgy({ value: b, isNew: false })}>Edit</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="mt-3 text-[11px] text-gray-400">Tip: find coordinates by right-clicking the barangay centre in Google Maps or OpenStreetMap and copying the latitude/longitude.</p>
        </Card>
      )}

      <OfficeModal
        value={editing}
        barangays={barangays}
        onClose={() => setEditing(null)}
        onSaved={(o) => {
          setOffices((os) => (os!.some((x) => x.office_id === o.office_id) ? os!.map((x) => (x.office_id === o.office_id ? o : x)) : [...os!, o]));
          setEditing(null);
        }}
      />
      <BarangayModal
        value={editingBrgy}
        onClose={() => setEditingBrgy(null)}
        onSaved={(b) => {
          setBarangays((bs) => (bs.some((x) => x.barangay_code === b.barangay_code) ? bs.map((x) => (x.barangay_code === b.barangay_code ? b : x)) : [...bs, b].sort((x, y) => x.barangay_name.localeCompare(y.barangay_name))));
          setEditingBrgy(null);
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
        barangay_code: value.barangay_code ?? "",
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

  const smsPreview = `Go to: ${form.office_name || "Office name"}${form.operating_hours ? `, ${form.operating_hours}` : ""}${form.contact_number ? `, ${form.contact_number}` : ""}`;

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
          <Field label="Barangay" hint="Citizens from this barangay see this office first.">
            {(id) => (
              <select id={id} className={inputClass} value={form.barangay_code} onChange={(e) => setForm({ ...form, barangay_code: e.target.value })}>
                <option value="">City-wide (no specific barangay)</option>
                {barangays.map((b) => (
                  <option key={b.barangay_code} value={b.barangay_code}>{b.barangay_name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Contact number">{(id) => <input id={id} className={inputClass} value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="(032) 000-0000" />}</Field>
        </div>
        <Field label="Operating hours">{(id) => <input id={id} className={inputClass} value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} />}</Field>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">How it appears in the SMS</p>
          <p className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3 text-[13px] leading-relaxed text-gray-800 dark:bg-white/[0.06] dark:text-gray-100">{smsPreview}</p>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}

function BarangayModal({ value, onClose, onSaved }: { value: { value: Barangay; isNew: boolean } | null; onClose: () => void; onSaved: (b: Barangay) => void }) {
  const [form, setForm] = useState({ barangay_code: "", barangay_name: "", city_municipality: "Cebu City", latitude: "", longitude: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      const b = value.value;
      setForm({ barangay_code: b.barangay_code, barangay_name: b.barangay_name, city_municipality: b.city_municipality, latitude: b.latitude?.toString() ?? "", longitude: b.longitude?.toString() ?? "" });
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const lat = form.latitude ? Number(form.latitude) : null;
    const lng = form.longitude ? Number(form.longitude) : null;
    if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) {
      setError("Latitude and longitude must be numbers, e.g. 10.3157 and 123.8854.");
      return;
    }
    setBusy(true);
    try {
      onSaved(await saveBarangay({ ...form, latitude: lat, longitude: lng }, value!.isNew));
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
      title={value?.isNew ? "Add barangay" : "Edit barangay"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="brgy-form" disabled={busy}>{busy ? "Saving…" : "Save barangay"}</Btn>
        </>
      }
    >
      <form id="brgy-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Barangay name">{(id) => <input id={id} required className={inputClass} value={form.barangay_name} onChange={(e) => setForm({ ...form, barangay_name: e.target.value })} />}</Field>
          <Field label="PSA code (PSGC)" hint={value?.isNew ? "Can't be changed later." : undefined}>
            {(id) => <input id={id} required disabled={!value?.isNew} className={`${inputClass} font-mono disabled:opacity-60`} value={form.barangay_code} onChange={(e) => setForm({ ...form, barangay_code: e.target.value.trim() })} placeholder="0730600034" />}
          </Field>
        </div>
        <Field label="City / municipality">{(id) => <input id={id} required className={inputClass} value={form.city_municipality} onChange={(e) => setForm({ ...form, city_municipality: e.target.value })} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">{(id) => <input id={id} inputMode="decimal" className={`${inputClass} tabular-nums`} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="10.3157" />}</Field>
          <Field label="Longitude">{(id) => <input id={id} inputMode="decimal" className={`${inputClass} tabular-nums`} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="123.8854" />}</Field>
        </div>
        <p className="text-[11px] text-gray-400">Coordinates place the barangay on the vulnerability heatmap. Leave blank to keep it off the map.</p>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
