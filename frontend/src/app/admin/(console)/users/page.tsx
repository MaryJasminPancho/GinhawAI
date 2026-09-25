"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { Badge, Btn, Card, ErrorText, Field, fmtDateTime, inputClass, Loading, Modal, PageTitle, Segmented, Table, td, th } from "@/components/admin/ui";
import { ALL_ROLES, createStaff, listOffices, listStaff, Office, resetStaffPassword, RoleName, roleGroup, setStaffActive, StaffUser } from "@/lib/adminApi";

// "Provision Staff Access Credentials" (Fig. 11) + User Account & Access
// Management modules: RBAC, activate / deactivate profile, reset password.

const ROLE_TONE = { sysadmin: "red", welfare: "brand", executive: "blue" } as const;

export default function UsersPage() {
  const { session } = useAdmin();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [adding, setAdding] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ username: string; password: string } | null>(null);

  useEffect(() => {
    Promise.all([listStaff(), listOffices()])
      .then(([u, o]) => {
        setUsers(u);
        setOffices(o);
      })
      .catch((e) => setError(e.message));
  }, []);

  const visible = (users ?? []).filter((u) => status === "all" || (status === "active" ? u.is_active : !u.is_active));
  const officeName = (id?: string | null) => offices.find((o) => o.office_id === id)?.office_name ?? "—";

  async function toggle(u: StaffUser) {
    const action = u.is_active ? "Deactivate" : "Reactivate";
    if (!confirm(`${action} ${u.username}? ${u.is_active ? "They will be signed out and can't sign in until reactivated." : ""}`)) return;
    try {
      await setStaffActive(u.user_id, !u.is_active);
      setUsers((us) => us!.map((x) => (x.user_id === u.user_id ? { ...x, is_active: !u.is_active } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function reset(u: StaffUser) {
    if (!confirm(`Reset the password for ${u.username}? Their current sessions will be revoked.`)) return;
    try {
      setTempPassword({ username: u.username, password: await resetStaffPassword(u.user_id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  }

  return (
    <>
      <PageTitle
        title="Staff Credentials"
        description="Create accounts for LGU personnel, assign their role and office, and remove access when someone leaves. Accounts can be deactivated but never deleted, so the audit trail stays intact."
        actions={<Btn onClick={() => setAdding(true)}>+ New staff account</Btn>}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      <Card>
        <div className="mb-4">
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: `Active${users ? ` (${users.filter((u) => u.is_active).length})` : ""}` },
              { value: "inactive", label: "Deactivated" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        {!users && !error && <Loading />}
        {users && (
          <Table>
            <thead>
              <tr>
                <th className={th}>User</th>
                <th className={th}>Role</th>
                <th className={th}>Office</th>
                <th className={th}>Last sign-in</th>
                <th className={`${th} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.user_id} className={u.is_active ? "" : "opacity-60"}>
                  <td className={td}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">{u.username.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {u.username} {u.user_id === session.user_id && <span className="text-xs font-normal text-gray-400">(you)</span>}
                        </p>
                        {!u.is_active && <Badge>Deactivated</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className={td}><Badge tone={ROLE_TONE[roleGroup(u.role_name)]}>{u.role_name}</Badge></td>
                  <td className={`${td} text-gray-500`}>{officeName(u.office_id)}</td>
                  <td className={`${td} tabular-nums text-gray-500`}>{u.last_login ? fmtDateTime(u.last_login) : "Never"}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Btn variant="ghost" onClick={() => reset(u)} disabled={!u.is_active}>Reset password</Btn>
                    <Btn variant="ghost" className={u.is_active ? "!text-red-600 dark:!text-red-400" : ""} onClick={() => toggle(u)} disabled={u.user_id === session.user_id}>
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4" title="Roles and what they can do" subtitle="Role-based access control (RBAC)">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { g: "welfare" as const, roles: "LGU Administrator · Social Worker", can: "Program rules, aid schedules, office directory, blind validation, audit logs" },
            { g: "executive" as const, roles: "LGU Executive · Partner Organization", can: "Anonymized heatmap and policy reports only — no access to rules or accounts" },
            { g: "sysadmin" as const, roles: "System Administrator", can: "Everything above plus system health, credentials, SMS gateway and security policy" },
          ].map((r) => (
            <div key={r.g} className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04]">
              <Badge tone={ROLE_TONE[r.g]}>{r.roles}</Badge>
              <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">{r.can}</p>
            </div>
          ))}
        </div>
      </Card>

      <AddStaffModal
        open={adding}
        offices={offices}
        onClose={() => setAdding(false)}
        onCreated={(u, pw) => {
          setUsers((us) => [...(us ?? []), u]);
          setAdding(false);
          setTempPassword({ username: u.username, password: pw });
        }}
      />

      <Modal open={!!tempPassword} onClose={() => setTempPassword(null)} title="Temporary password" footer={<Btn onClick={() => setTempPassword(null)}>Done</Btn>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Give this to <strong>{tempPassword?.username}</strong> in person or through an official channel. It is shown only once, and they&apos;ll be asked to change it on first sign-in.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-center font-mono text-lg font-bold tracking-wider dark:bg-white/10">{tempPassword?.password}</code>
          <Btn variant="secondary" onClick={() => tempPassword && navigator.clipboard?.writeText(tempPassword.password)}>Copy</Btn>
        </div>
      </Modal>
    </>
  );
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

function AddStaffModal({ open, offices, onClose, onCreated }: { open: boolean; offices: Office[]; onClose: () => void; onCreated: (u: StaffUser, password: string) => void }) {
  const [form, setForm] = useState<{ username: string; role_name: RoleName; office_id: string }>({ username: "", role_name: "Social Worker", office_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[a-z0-9._-]{3,32}$/.test(form.username)) {
      setError("Username: 3–32 lowercase letters, numbers, dots, dashes or underscores.");
      return;
    }
    setBusy(true);
    setError(null);
    const password = generatePassword();
    try {
      const u = await createStaff({ ...form, password, office_id: form.office_id || null });
      onCreated(u, password);
      setForm({ username: "", role_name: "Social Worker", office_id: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New staff account"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="staff-form" disabled={busy}>{busy ? "Creating…" : "Create account"}</Btn>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} className="space-y-4">
        <Field label="Username">{(id) => <input id={id} required autoComplete="off" className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="e.g. jdelacruz" />}</Field>
        <Field label="Role">
          {(id) => (
            <select id={id} className={inputClass} value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value as RoleName })}>
              {ALL_ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          )}
        </Field>
        <Field label="Office" hint="Every staff account belongs to an LGU office. Partner organizations may leave this blank.">
          {(id) => (
            <select id={id} className={inputClass} value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value })}>
              <option value="">— None —</option>
              {offices.map((o) => <option key={o.office_id} value={o.office_id}>{o.office_name}</option>)}
            </select>
          )}
        </Field>
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">A strong temporary password is generated for you and shown once after the account is created.</p>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
