"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { Badge, Btn, Card, EmptyState, ErrorText, Field, inputClass, Loading, Modal, PageTitle, ViewOnly } from "@/components/admin/ui";
import {
  Barangay,
  deletePartner,
  deleteResource,
  listBarangays,
  listPartners,
  PartnerOrg,
  PartnerOrgIn,
  PartnerRegistry,
  PartnerResource,
  PartnerResourceIn,
  savePartner,
  saveResource,
  verifyPartner,
} from "@/lib/adminApi";

// Partner registry: "Maintain Local Civil Society Registries" (Appendix R #40) and
// "Track Neighborhood NGO Resource Tracks" (#38). LGU staff manage everything;
// Partner Organization accounts manage only their own entries, which citizens see
// only after LGU staff verify them.

export default function PartnersPage() {
  const { group } = useAdmin();
  const [data, setData] = useState<PartnerRegistry | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartnerOrg | "new" | null>(null);

  const reload = () => listPartners().then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
    listBarangays().then(setBarangays).catch(() => {});
  }, []);

  const pending = data?.organizations.filter((o) => !o.is_verified).length ?? 0;

  return (
    <>
      <PageTitle
        title="Partner Registry"
        description="NGOs, faith-based and community groups in Cebu City, and the help they offer. Citizens see verified, active entries on the Browse programs page."
        actions={data?.can_create ? <Btn onClick={() => setEditing("new")}>+ Add organization</Btn> : group === "sysadmin" ? <ViewOnly /> : undefined}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {!data && !error && <Loading />}

      {data && (
        <div className="space-y-4">
          {data.can_verify && pending > 0 && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
              <strong>{pending} waiting for verification.</strong> Check the details, then press Verify so citizens can see them.
            </div>
          )}
          {!data.can_verify && data.can_create && (
            <p className="text-[13px] text-gray-500 dark:text-gray-400">Anything you add or change is checked by LGU staff before citizens can see it.</p>
          )}
          {data.organizations.length === 0 ? (
            <EmptyState title="No organizations yet">{data.can_create ? "Add the first one with “Add organization”." : "Nothing has been added yet."}</EmptyState>
          ) : (
            data.organizations.map((o) => (
              <OrgCard key={o.org_id} org={o} canVerify={data.can_verify} barangays={barangays} onEdit={() => setEditing(o)} onChanged={reload} />
            ))
          )}
        </div>
      )}

      {data && editing && (
        <OrgModal
          org={editing === "new" ? null : editing}
          types={data.org_types}
          barangays={barangays}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function OrgCard({ org, canVerify, barangays, onEdit, onChanged }: { org: PartnerOrg; canVerify: boolean; barangays: Barangay[]; onEdit: () => void; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [addingRes, setAddingRes] = useState<PartnerResource | "new" | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Card
      title={org.name}
      subtitle={[org.org_type_label, org.barangay_name && `Brgy. ${org.barangay_name}`].filter(Boolean).join(" · ")}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {org.is_verified ? <Badge tone="green" dot>Verified</Badge> : <Badge tone="amber" dot>Awaiting verification</Badge>}
          {!org.is_active && <Badge tone="gray">Inactive</Badge>}
        </div>
      }
    >
      {org.services && <p className="text-[13px] text-gray-700 dark:text-gray-300">{org.services}</p>}
      {(org.address || org.contact) && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{[org.address, org.contact].filter(Boolean).join(" · ")}</p>}

      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-white/10">
        <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Help they offer</p>
        {org.resources.length === 0 && <p className="text-xs text-gray-400">None listed yet.</p>}
        <ul className="space-y-1.5">
          {org.resources.map((r) => (
            <li key={r.resource_id} className="flex items-start justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[13px] dark:bg-white/4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">{r.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[r.starts_on && (r.ends_on && r.ends_on !== r.starts_on ? `${r.starts_on} – ${r.ends_on}` : r.starts_on), r.barangay_code && `Brgy. ${barangays.find((b) => b.barangay_code === r.barangay_code)?.barangay_name ?? r.barangay_code}`, r.details].filter(Boolean).join(" · ") || "Ongoing"}
                </p>
              </div>
              {org.can_edit && (
                <div className="flex shrink-0">
                  <Btn variant="ghost" onClick={() => setAddingRes(r)}>Edit</Btn>
                  <Btn variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={() => confirm(`Remove "${r.title}"?`) && act(() => deleteResource(r.resource_id))}>Remove</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
      <div className="mt-3 flex flex-wrap justify-end gap-1.5">
        {org.can_edit && <Btn variant="secondary" onClick={() => setAddingRes("new")}>+ Add help offered</Btn>}
        {org.can_edit && <Btn variant="secondary" onClick={onEdit}>Edit details</Btn>}
        {canVerify && !org.is_verified && <Btn onClick={() => act(() => verifyPartner(org.org_id, true))}>Verify</Btn>}
        {canVerify && org.is_verified && <Btn variant="ghost" onClick={() => act(() => verifyPartner(org.org_id, false))}>Unverify</Btn>}
        {org.can_edit && (
          <Btn variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={() => confirm(`Remove ${org.name} and everything it offers?`) && act(() => deletePartner(org.org_id))}>
            Remove
          </Btn>
        )}
      </div>

      {addingRes && (
        <ResourceModal
          orgId={org.org_id}
          resource={addingRes === "new" ? null : addingRes}
          barangays={barangays}
          onClose={() => setAddingRes(null)}
          onSaved={() => {
            setAddingRes(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function BarangaySelect({ id, value, onChange, barangays }: { id: string; value: string; onChange: (v: string) => void; barangays: Barangay[] }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not specific to one barangay</option>
      {barangays.map((b) => <option key={b.barangay_code} value={b.barangay_code}>{b.barangay_name}</option>)}
    </select>
  );
}

function OrgModal({ org, types, barangays, onClose, onSaved }: { org: PartnerOrg | null; types: { value: string; label: string }[]; barangays: Barangay[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: org?.name ?? "",
    org_type: org?.org_type ?? "ngo",
    services: org?.services ?? "",
    address: org?.address ?? "",
    barangay_code: org?.barangay_code ?? "",
    contact: org?.contact ?? "",
    is_active: org?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: PartnerOrgIn = { ...form, services: form.services || null, address: form.address || null, barangay_code: form.barangay_code || null, contact: form.contact || null };
    try {
      await savePartner(body, org?.org_id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={org ? "Edit organization" : "Add organization"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="org-form" disabled={busy || form.name.trim().length < 2}>{busy ? "Saving…" : "Save"}</Btn>
        </>
      }
    >
      <form id="org-form" onSubmit={submit} className="space-y-4">
        <Field label="Name">{(id) => <input id={id} required maxLength={200} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Type">
          {(id) => (
            <select id={id} className={inputClass} value={form.org_type} onChange={(e) => setForm({ ...form, org_type: e.target.value })}>
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="What they offer" hint="Plain language, shown to citizens.">
          {(id) => <textarea id={id} rows={3} maxLength={2000} className={inputClass} value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="e.g. Free medicines for senior citizens, school supplies…" />}
        </Field>
        <Field label="Barangay">{(id) => <BarangaySelect id={id} value={form.barangay_code} onChange={(v) => setForm({ ...form, barangay_code: v })} barangays={barangays} />}</Field>
        <Field label="Address">{(id) => <input id={id} maxLength={500} className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}</Field>
        <Field label="Contact">{(id) => <input id={id} maxLength={100} className={inputClass} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Phone, email or Facebook page" />}</Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-brand-600" />
          Active (shown to citizens once verified)
        </label>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}

function ResourceModal({ orgId, resource, barangays, onClose, onSaved }: { orgId: string; resource: PartnerResource | null; barangays: Barangay[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: resource?.title ?? "",
    details: resource?.details ?? "",
    barangay_code: resource?.barangay_code ?? "",
    starts_on: resource?.starts_on ?? "",
    ends_on: resource?.ends_on ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) {
      setError("The end date can't be before the start date.");
      return;
    }
    setBusy(true);
    setError(null);
    const body: PartnerResourceIn = {
      title: form.title,
      details: form.details || null,
      barangay_code: form.barangay_code || null,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
    };
    try {
      await saveResource(orgId, body, resource?.resource_id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={resource ? "Edit help offered" : "Add help offered"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="res-form" disabled={busy || form.title.trim().length < 2}>{busy ? "Saving…" : "Save"}</Btn>
        </>
      }
    >
      <form id="res-form" onSubmit={submit} className="space-y-4">
        <Field label="What" hint="e.g. Free rice distribution, Medical mission, Scholarship slots">
          {(id) => <input id={id} required maxLength={200} className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
        </Field>
        <Field label="Details" hint="Who can get it, what to bring, time and place.">
          {(id) => <textarea id={id} rows={3} maxLength={2000} className={inputClass} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />}
        </Field>
        <Field label="Barangay">{(id) => <BarangaySelect id={id} value={form.barangay_code} onChange={(v) => setForm({ ...form, barangay_code: v })} barangays={barangays} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From (optional)">{(id) => <input id={id} type="date" className={inputClass} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />}</Field>
          <Field label="Until (optional)">{(id) => <input id={id} type="date" className={inputClass} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />}</Field>
        </div>
        <p className="text-[11px] text-gray-400">Leave both dates empty for help that&apos;s always available. It&apos;s hidden from citizens after the end date.</p>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
