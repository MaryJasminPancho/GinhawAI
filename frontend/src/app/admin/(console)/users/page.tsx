"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import Avatar from "@/components/admin/Avatar";
import { Badge, Btn, Card, ErrorText, Field, fmtDateTime, inputClass, Loading, Modal, PageTitle, Segmented, Table, td, th } from "@/components/admin/ui";
import {
  approvePasswordRequest,
  createStaff,
  getRevealPin,
  listOffices,
  listPasswordRequests,
  listRoles,
  listStaff,
  Office,
  PasswordRequestRow,
  rejectPasswordRequest,
  resetStaffPassword,
  revealRequestedPassword,
  Role,
  RoleName,
  roleGroup,
  setRevealPin,
  setStaffActive,
  staffAvatarPath,
  StaffUser,
  updateStaff,
} from "@/lib/adminApi";

// "Provision Staff Access Credentials" (Fig. 11) + User Account & Access
// Management modules: RBAC, activate / deactivate profile, reset password.

const ROLE_TONE = { sysadmin: "red", welfare: "brand", executive: "blue" } as const;

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export default function UsersPage() {
  const { session } = useAdmin();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);
  const [tempPassword, setTempPassword] = useState<{ username: string; password: string } | null>(null);
  const [requests, setRequests] = useState<PasswordRequestRow[]>([]);

  useEffect(() => {
    Promise.all([listStaff(), listRoles(), listOffices(), listPasswordRequests("pending")])
      .then(([u, r, o, pr]) => {
        setUsers(u);
        setRoles(r);
        setOffices(o);
        setRequests(pr);
      })
      .catch((e) => setError(e.message));
  }, []);

  function decided(req: PasswordRequestRow, approved: boolean) {
    setRequests((rs) => rs.filter((r) => r.request_id !== req.request_id));
    if (approved) setUsers((us) => us?.map((u) => (u.user_id === req.user_id ? { ...u, must_change_password: false } : u)) ?? null);
  }

  const visible = (users ?? []).filter((u) => status === "all" || (status === "active" ? u.is_active : !u.is_active));
  const officeName = (id?: string | null) => offices.find((o) => o.office_id === id)?.office_name ?? "—";

  async function toggle(u: StaffUser) {
    const action = u.is_active ? "Deactivate" : "Reactivate";
    if (!confirm(`${action} ${u.username}?${u.is_active ? " They'll be signed out immediately and can't sign in until reactivated." : ""}`)) return;
    try {
      await setStaffActive(u.user_id, !u.is_active);
      setUsers((us) => us!.map((x) => (x.user_id === u.user_id ? { ...x, is_active: !u.is_active } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function reset(u: StaffUser) {
    if (!confirm(`Reset the password for ${u.username}? They'll be signed out everywhere.`)) return;
    try {
      setTempPassword({ username: u.username, password: await resetStaffPassword(u.user_id) });
      setUsers((us) => us?.map((x) => (x.user_id === u.user_id ? { ...x, must_change_password: true } : x)) ?? null);
      setRequests((rs) => rs.filter((r) => r.user_id !== u.user_id)); // a reset cancels any pending request
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  }

  return (
    <>
      <PageTitle
        title="Staff Credentials"
        description="Create accounts for LGU personnel, assign their role and office, and remove access when someone leaves. Accounts are deactivated, never deleted, so the audit trail stays intact."
        actions={<Btn onClick={() => setEditing("new")}>+ New staff account</Btn>}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      {requests.length > 0 && <PasswordRequests requests={requests} selfId={session.user_id} onDecided={decided} />}

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
                      <Avatar path={u.has_avatar ? staffAvatarPath(u.user_id) : null} version={u.avatar_updated_at} name={u.full_name || u.username} />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {u.full_name || u.username} {u.user_id === session.user_id && <span className="text-xs font-normal text-gray-400">(you)</span>}
                        </p>
                        {u.full_name && <p className="text-xs text-gray-500 dark:text-gray-400">@{u.username}</p>}
                        <div className="flex flex-wrap gap-1">
                          {!u.is_active && <Badge>Deactivated</Badge>}
                          {u.is_active && u.must_change_password && <Badge tone="amber">Temporary password</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={td}><Badge tone={ROLE_TONE[roleGroup(u.role_name)]}>{u.role_name}</Badge></td>
                  <td className={`${td} text-gray-500`}>{officeName(u.office_id)}</td>
                  <td className={`${td} tabular-nums text-gray-500`}>{u.last_login ? fmtDateTime(u.last_login) : "Never"}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Btn variant="ghost" onClick={() => setEditing(u)}>Edit</Btn>
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

      <Card className="mt-4" title="Roles and what they can do" subtitle="Role-based access control (RBAC) — enforced by the backend">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { g: "welfare" as const, roles: "LGU Administrator · Social Worker", can: "Program rules, aid schedules, office directory, blind validation and audit logs" },
            { g: "executive" as const, roles: "LGU Executive · Partner Organization", can: "Anonymized heatmap and policy reports only — no access to rules or accounts" },
            { g: "sysadmin" as const, roles: "System Administrator", can: "Everything above plus system health, credentials, email gateway and security policy" },
          ].map((r) => (
            <div key={r.g} className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04]">
              <Badge tone={ROLE_TONE[r.g]}>{r.roles}</Badge>
              <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">{r.can}</p>
            </div>
          ))}
        </div>
      </Card>

      <StaffModal
        value={editing}
        roles={roles}
        offices={offices}
        selfId={session.user_id}
        onClose={() => setEditing(null)}
        onSaved={(u, pw) => {
          setUsers((us) => (us!.some((x) => x.user_id === u.user_id) ? us!.map((x) => (x.user_id === u.user_id ? u : x)) : [...us!, u]));
          setEditing(null);
          if (pw) setTempPassword({ username: u.username, password: pw });
        }}
      />

      <Modal open={!!tempPassword} onClose={() => setTempPassword(null)} title="Temporary password" footer={<Btn onClick={() => setTempPassword(null)}>Done</Btn>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Give this to <strong>{tempPassword?.username}</strong> in person or through an official channel. It is shown only once — only a scrambled (hashed) version is stored.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          The first time they sign in, they&apos;ll have to choose their own password. It will appear here under <strong>Password requests</strong> for you to approve.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-center font-mono text-lg font-bold tracking-wider dark:bg-white/10">{tempPassword?.password}</code>
          <Btn variant="secondary" onClick={() => tempPassword && navigator.clipboard?.writeText(tempPassword.password)}>Copy</Btn>
        </div>
      </Modal>
    </>
  );
}

function StaffModal({
  value,
  roles,
  offices,
  selfId,
  onClose,
  onSaved,
}: {
  value: StaffUser | "new" | null;
  roles: Role[];
  offices: Office[];
  selfId: string;
  onClose: () => void;
  onSaved: (u: StaffUser, password?: string) => void;
}) {
  const isNew = value === "new";
  const [form, setForm] = useState<{ username: string; full_name: string; role_name: RoleName; office_id: string }>({ username: "", full_name: "", role_name: "Social Worker", office_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      setForm(
        value === "new"
          ? { username: "", full_name: "", role_name: "Social Worker", office_id: "" }
          : { username: value.username, full_name: value.full_name ?? "", role_name: value.role_name, office_id: value.office_id ?? "" }
      );
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        if (!/^[a-z0-9._-]{3,32}$/.test(form.username)) throw new Error("Username: 3–32 lowercase letters, numbers, dots, dashes or underscores.");
        const password = generatePassword();
        onSaved(await createStaff({ username: form.username, password, role_name: form.role_name, office_id: form.office_id || null, full_name: form.full_name || null }), password);
      } else if (value) {
        onSaved(await updateStaff(value.user_id, { role_name: form.role_name, office_id: form.office_id || null, full_name: form.full_name || null }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const editingSelf = !!value && value !== "new" && value.user_id === selfId;

  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={isNew ? "New staff account" : `Edit ${typeof value === "object" && value ? value.username : ""}`}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" form="staff-form" disabled={busy}>{busy ? "Saving…" : isNew ? "Create account" : "Save"}</Btn>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} className="space-y-4">
        {isNew && (
          <Field label="Username">{(id) => <input id={id} required autoComplete="off" className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="e.g. jdelacruz" />}</Field>
        )}
        <Field label="Full name (optional)" hint="The person can also set or change this themselves on My Account.">
          {(id) => <input id={id} maxLength={100} autoComplete="off" className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Juan Dela Cruz" />}
        </Field>
        <Field label="Role" hint={editingSelf ? "You can't change your own role." : undefined}>
          {(id) => (
            <select id={id} disabled={editingSelf} className={`${inputClass} disabled:opacity-60`} value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value as RoleName })}>
              {roles.map((r) => <option key={r.role_id} value={r.role_name}>{r.role_name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Office" hint="Partner organizations may leave this blank.">
          {(id) => (
            <select id={id} className={inputClass} value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value })}>
              <option value="">— None —</option>
              {offices.map((o) => <option key={o.office_id} value={o.office_id}>{o.office_name}</option>)}
            </select>
          )}
        </Field>
        {isNew && <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">A strong temporary password is generated and shown once after the account is created.</p>}
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}

/** Pending password changes. A System Administrator can't decide on their own request. */
function PasswordRequests({ requests, selfId, onDecided }: { requests: PasswordRequestRow[]; selfId: string; onDecided: (r: PasswordRequestRow, approved: boolean) => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PasswordRequestRow | null>(null);
  const [viewing, setViewing] = useState<PasswordRequestRow | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve(r: PasswordRequestRow) {
    if (!confirm(`Approve the new password for ${r.username}? They'll be signed out and must sign in with it.`)) return;
    setBusyId(r.request_id);
    setError(null);
    try {
      await approvePasswordRequest(r.request_id);
      onDecided(r, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    setBusyId(rejecting.request_id);
    setError(null);
    try {
      await rejectPasswordRequest(rejecting.request_id, note);
      onDecided(rejecting, false);
      setRejecting(null);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      className="mb-4 ring-amber-300/70 dark:ring-amber-500/30"
      title={`Password requests (${requests.length})`}
      subtitle="New passwords waiting for your approval. The person's current password keeps working until you approve."
    >
      {error && <div className="mb-3"><ErrorText>{error}</ErrorText></div>}
      <ul className="divide-y divide-gray-100 dark:divide-white/5">
        {requests.map((r) => {
          const own = r.user_id === selfId;
          return (
            <li key={r.request_id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
                  {r.username} <span className="font-normal text-gray-500 dark:text-gray-400">· {r.role_name}</span>
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Badge tone={r.reason === "first_login" ? "amber" : r.reason === "forgot_password" ? "red" : "blue"}>
                    {r.reason === "first_login" ? "First sign-in" : r.reason === "forgot_password" ? "Forgot password (code-verified)" : "Requested change"}
                  </Badge>
                  <span>{fmtDateTime(r.requested_at)}</span>
                </div>
              </div>
              {own ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">Your own request. Another System Administrator must decide.</span>
              ) : (
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Btn variant="secondary" onClick={() => setViewing(r)}>View password</Btn>
                  <Btn onClick={() => approve(r)} disabled={busyId === r.request_id}>Approve</Btn>
                  <Btn variant="danger" onClick={() => { setRejecting(r); setNote(""); }} disabled={busyId === r.request_id}>Reject</Btn>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.username ?? ""}'s new password?`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRejecting(null)}>Cancel</Btn>
            <Btn type="submit" form="reject-form" variant="danger" disabled={!note.trim() || !!busyId}>Reject</Btn>
          </>
        }
      >
        <form id="reject-form" onSubmit={reject} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">They&apos;ll see your reason on their My Account page and can submit a different password. Their current password keeps working.</p>
          <Field label="Reason">
            {(id) => <textarea id={id} rows={3} required maxLength={500} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please don't reuse your old password." />}
          </Field>
        </form>
      </Modal>

      {viewing && <RevealModal req={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}

const pinInput = `${inputClass} w-32 text-center font-mono text-lg tracking-[0.5em]`;
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

/** Shows a requested password after the System Administrator enters their 4-digit PIN.
 * The password is hidden behind a visibility toggle and forgotten when the window closes. */
function RevealModal({ req, onClose }: { req: PasswordRequestRow; onClose: () => void }) {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // PIN entry
  const [pin, setPin] = useState("");
  // First-time PIN setup
  const [account, setAccount] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");

  useEffect(() => {
    getRevealPin()
      .then((s) => setHasPin(s.has_pin))
      .catch((e) => setError(e.message));
  }, []);

  // Hide it again automatically after 30 seconds.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 30000);
    return () => clearTimeout(t);
  }, [visible]);

  async function savePin(e: FormEvent) {
    e.preventDefault();
    if (newPin !== newPin2) {
      setError("The two PINs don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setRevealPin(account, newPin);
      setHasPin(true);
      setAccount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the PIN");
    } finally {
      setBusy(false);
    }
  }

  async function reveal(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setPassword((await revealRequestedPassword(req.request_id, pin)).password);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not show the password");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setPassword(null); // don't keep it in memory once the window is closed
    onClose();
  }

  return (
    <Modal open onClose={close} title={`${req.username}'s requested password`} footer={<Btn variant="secondary" onClick={close}>Close</Btn>}>
      {hasPin === null && !error && <Loading />}

      {hasPin === false && (
        <form onSubmit={savePin} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Set a 4-digit PIN first. You&apos;ll enter it every time you view a requested password. Confirm it&apos;s you with your account password.
          </p>
          <Field label="Your account password">
            {(id) => <input id={id} type="password" required autoComplete="current-password" className={inputClass} value={account} onChange={(e) => setAccount(e.target.value)} />}
          </Field>
          <div className="flex flex-wrap gap-4">
            <Field label="New PIN">
              {(id) => <input id={id} type="password" inputMode="numeric" autoComplete="off" required className={pinInput} value={newPin} onChange={(e) => setNewPin(onlyDigits(e.target.value))} />}
            </Field>
            <Field label="Repeat PIN">
              {(id) => <input id={id} type="password" inputMode="numeric" autoComplete="off" required className={pinInput} value={newPin2} onChange={(e) => setNewPin2(onlyDigits(e.target.value))} />}
            </Field>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <Btn type="submit" disabled={busy || !account || newPin.length !== 4 || newPin2.length !== 4}>{busy ? "Saving…" : "Save PIN"}</Btn>
        </form>
      )}

      {hasPin && password === null && (
        <form onSubmit={reveal} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Enter your 4-digit PIN. This view is recorded in the audit log.</p>
          <Field label="PIN">
            {(id) => <input id={id} type="password" inputMode="numeric" autoComplete="off" autoFocus required className={pinInput} value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} />}
          </Field>
          {error && <ErrorText>{error}</ErrorText>}
          <Btn type="submit" disabled={busy || pin.length !== 4}>{busy ? "Checking…" : "Unlock"}</Btn>
        </form>
      )}

      {password !== null && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Make sure nobody can see your screen before you show it.</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              type={visible ? "text" : "password"}
              aria-label="Requested password"
              value={password}
              className={`${inputClass} flex-1 font-mono text-base`}
            />
            <Btn variant="secondary" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
              {visible ? "Hide" : "Show"}
            </Btn>
          </div>
          <p className="text-xs text-gray-400">It hides again after 30 seconds and is cleared when you close this window.</p>
        </div>
      )}
    </Modal>
  );
}
