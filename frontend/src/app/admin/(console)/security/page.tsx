"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, ErrorText, Field, inputClass, Loading, Modal, PageTitle, Toggle } from "@/components/admin/ui";
import { getSecurityPolicy, revokeAllSessions, SecurityPolicy, updateSecurityPolicy } from "@/lib/adminApi";

// "Manage Infrastructure Security Policy" (Fig. 11): JWT lifetime, password
// rules, lockout, API rate limit, CORS origins, and the privacy-first
// session purge required by RA 10173.

export default function SecurityPage() {
  const router = useRouter();
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [saved, setSaved] = useState<SecurityPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    getSecurityPolicy()
      .then((p) => {
        setPolicy(p);
        setSaved(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  const dirty = JSON.stringify(policy) !== JSON.stringify(saved);
  const set = <K extends keyof SecurityPolicy>(k: K, v: SecurityPolicy[K]) => setPolicy((p) => (p ? { ...p, [k]: v } : p));
  const num = (k: keyof SecurityPolicy, min: number, max: number) => ({
    type: "number" as const,
    min,
    max,
    className: inputClass,
    value: String(policy?.[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never),
  });

  async function save() {
    if (!policy) return;
    const bad =
      policy.jwt_expire_minutes < 5 || policy.jwt_expire_minutes > 720 ? "Token lifetime must be 5–720 minutes." :
      policy.password_min_length < 8 ? "Minimum password length should be at least 8." :
      policy.max_failed_logins < 3 ? "Allow at least 3 attempts before lockout." : null;
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    try {
      const p = await updateSecurityPolicy(policy);
      setPolicy(p);
      setSaved(p);
      setError(null);
      setNotice("Security policy saved and recorded in the audit log.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function addOrigin() {
    try {
      const u = new URL(origin.trim());
      if (policy && !policy.allowed_origins.includes(u.origin)) set("allowed_origins", [...policy.allowed_origins, u.origin]);
      setOrigin("");
    } catch {
      setError("Enter a full origin, e.g. https://ginhawai.ph");
    }
  }

  return (
    <>
      <PageTitle
        title="Security Policy"
        description="Authentication, access and privacy settings for the whole platform."
        actions={
          <>
            <Btn variant="secondary" disabled={!dirty || busy} onClick={() => setPolicy(saved)}>Discard</Btn>
            <Btn disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save policy"}</Btn>
          </>
        }
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {notice && !dirty && <p className="mb-4 rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">{notice}</p>}
      {!policy && !error && <Loading />}

      {policy && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Staff authentication" subtitle="JSON Web Token (JWT) sessions">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Token lifetime (minutes)" hint="Staff are signed out after this. Applies to new sign-ins.">{(id) => <input id={id} {...num("jwt_expire_minutes", 5, 720)} />}</Field>
              <Field label="Minimum password length">{(id) => <input id={id} {...num("password_min_length", 8, 64)} />}</Field>
              <Field label="Failed attempts before lockout">{(id) => <input id={id} {...num("max_failed_logins", 3, 20)} />}</Field>
              <Field label="Lockout duration (minutes)">{(id) => <input id={id} {...num("lockout_minutes", 1, 1440)} />}</Field>
            </div>
            <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <p className="text-xs text-gray-500 dark:text-gray-400">Suspect a leaked credential? Force every staff member to sign in again.</p>
              <Btn variant="danger" onClick={() => setRevoking(true)}>Revoke all sessions</Btn>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Citizen privacy" subtitle="Data Privacy Act of 2012 (RA 10173)">
              <label className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04]">
                <span>
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-white">Purge chat data when a session ends</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Wipes the Redis session and keeps only an anonymized demand log entry.</span>
                </span>
                <Toggle checked={policy.purge_on_session_end} onChange={(v) => set("purge_on_session_end", v)} label="Purge on session end" />
              </label>
              {!policy.purge_on_session_end && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  Turning this off keeps citizens&apos; household details after they leave, which goes against the platform&apos;s privacy commitment. Only do this for short, supervised debugging.
                </p>
              )}
            </Card>

            <Card title="API protection">
              <Field label="Rate limit (requests per minute, per client)">{(id) => <input id={id} {...num("rate_limit_per_minute", 10, 1000)} />}</Field>
              <p className="mb-1.5 mt-5 text-xs font-semibold text-gray-600 dark:text-gray-300">Allowed origins (CORS)</p>
              <p className="mb-2 text-[11px] text-gray-400">Web addresses allowed to call the API — the citizen app and this console. Changes apply immediately.</p>
              <ul className="space-y-1.5">
                {policy.allowed_origins.map((o) => (
                  <li key={o} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                    <code className="truncate font-mono text-[12px]">{o}</code>
                    <button
                      type="button"
                      onClick={() => set("allowed_origins", policy.allowed_origins.filter((x) => x !== o))}
                      disabled={policy.allowed_origins.length === 1}
                      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input aria-label="New origin" placeholder="https://ginhawai.ph" className={`${inputClass} font-mono text-xs`} value={origin} onChange={(e) => setOrigin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOrigin())} />
                <Btn variant="secondary" onClick={addOrigin} disabled={!origin}>Add</Btn>
              </div>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={revoking}
        onClose={() => setRevoking(false)}
        title="Revoke all staff sessions?"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRevoking(false)}>Cancel</Btn>
            <Btn
              variant="danger"
              onClick={async () => {
                try {
                  await revokeAllSessions();
                } catch {}
                // This also signs the current user out; the console will return to the sign-in page.
                router.replace("/admin/login");
              }}
            >
              Revoke all
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">Every staff member — including you — will need to sign in again. Citizen chats are not affected.</p>
      </Modal>
    </>
  );
}
