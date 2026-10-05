"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/AdminShell";
import { SMS_ENABLED } from "@/lib/features";
import Avatar from "@/components/admin/Avatar";
import PasswordChecklist, { passwordOk } from "@/components/admin/PasswordChecklist";
import { Badge, Btn, Card, ErrorText, Field, fmtDateTime, inputClass, Loading, PageTitle, smallButton } from "@/components/admin/ui";
import {
  cancelPasswordRequest,
  clearAdminSession,
  getMyPasswordRequest,
  MyPasswordRequest,
  OWN_AVATAR_PATH,
  photoToAvatarDataUrl,
  removeAvatar,
  removeEmail,
  removeMobile,
  requestPasswordChange,
  sendEmailCode,
  sendMobileCode,
  verifyEmailCode,
  verifyMobileCode,
  updateProfileName,
  uploadAvatar,
} from "@/lib/adminApi";

// "Change Account Password" (Appendix R module 5) + "Manage Profile Dashboard".
// Every password change, including the first one after receiving a temporary
// password, waits for a System Administrator's approval. Until then the current
// password keeps working.

export default function AccountPage() {
  const { session, group } = useAdmin();
  const router = useRouter();
  const [mustChange, setMustChange] = useState(!!session.must_change_password);
  const [req, setReq] = useState<MyPasswordRequest | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const load = useCallback(() => {
    getMyPasswordRequest()
      .then((r) => {
        setMustChange(r.must_change_password);
        setReq(r.request);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // While waiting, check now and then. Once approved, the session ends and the
  // console returns to the sign-in screen with an explanation.
  useEffect(() => {
    if (req?.status !== "pending") return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [req?.status, load]);

  async function cancel() {
    try {
      await cancelPasswordRequest();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    }
  }

  function signInAgain() {
    clearAdminSession();
    router.replace("/admin/login");
  }

  const pending = req?.status === "pending";
  // System Administrators change their own password with the backend script,
  // so they only get the password section while on a temporary password.
  const showPassword = group !== "sysadmin" || mustChange;

  return (
    <>
      <PageTitle
        title="My Account"
        description={showPassword ? "Your profile and sign-in details. Password changes are approved by a System Administrator before they take effect." : "Your name and profile picture."}
      />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      {mustChange && !applied && (
        <div className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
          <strong className="font-semibold">You&apos;re using a temporary password.</strong>{" "}
          {pending
            ? "Your new password is waiting for approval. You'll get access to the console once a System Administrator approves it."
            : "Choose your own password below. A System Administrator will approve it, then you can use the console."}
        </div>
      )}

      <div className={showPassword ? "grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]" : "max-w-xl"}>
        {mustChange ? (
          <Card title="Your account" className="h-fit">
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Username</dt>
                <dd className="font-semibold text-gray-900 dark:text-white">{session.username}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Role</dt>
                <dd className="font-semibold text-gray-900 dark:text-white">{session.role}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Password</dt>
                <dd><Badge tone="amber" dot>Temporary</Badge></dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">You can add your name and photo once your new password is approved.</p>
          </Card>
        ) : (
          <ProfileCard />
        )}

        {showPassword && <Card title="Change password">
          {req === undefined && !error && <Loading />}

          {applied && (
            <div className="space-y-3">
              <p className="rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
                Your password was changed right away, because there&apos;s no other System Administrator to approve it. Sign in again with your new password.
              </p>
              <Btn onClick={signInAgain}>Sign in again</Btn>
            </div>
          )}

          {!applied && req !== undefined && (
            <div className="space-y-5">
              {req && <RequestStatus req={req} />}
              {pending ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Btn variant="secondary" onClick={load}>Check status</Btn>
                  <Btn variant="ghost" onClick={cancel}>Cancel this request</Btn>
                </div>
              ) : (
                <PasswordForm
                  temporary={mustChange}
                  onSubmitted={(r) => {
                    if (r.applied) setApplied(true);
                    else setReq(r.request);
                  }}
                />
              )}
            </div>
          )}
        </Card>}
      </div>
    </>
  );
}

/** Name and profile picture (Manage Profile Dashboard). */
function ProfileCard() {
  const { session, profile, setProfile, profileError, reloadProfile } = useAdmin();
  const [name, setName] = useState<string | null>(null); // null = show saved value
  const [busy, setBusy] = useState<"name" | "photo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!profile) {
    return (
      <Card title="Profile" className="h-fit">
        {profileError ? (
          <div className="space-y-3">
            <ErrorText>Couldn&apos;t load your profile: {profileError}</ErrorText>
            <Btn variant="secondary" onClick={reloadProfile}>Try again</Btn>
          </div>
        ) : (
          <Loading />
        )}
      </Card>
    );
  }
  const shownName = name ?? profile.full_name ?? "";
  const display = profile.full_name || session.username;
  const nameChanged = shownName.trim().replace(/\s+/g, " ") !== (profile.full_name ?? "");

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy("name");
    setError(null);
    try {
      setProfile(await updateProfileName(shownName));
      setName(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your name");
    } finally {
      setBusy(null);
    }
  }

  async function choosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setBusy("photo");
    setError(null);
    try {
      setProfile(await uploadAvatar(await photoToAvatarDataUrl(file)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the photo");
    } finally {
      setBusy(null);
    }
  }

  async function deletePhoto() {
    setBusy("photo");
    setError(null);
    try {
      setProfile(await removeAvatar());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the photo");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Profile" className="h-fit">
      <div className="flex items-center gap-4">
        <Avatar path={profile.has_avatar ? OWN_AVATAR_PATH : null} version={profile.avatar_updated_at} name={display} size="lg" />
        <div className="min-w-0 space-y-2">
          <p className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">{display}</p>
          <div className="flex flex-wrap gap-1.5">
            <label className={`${smallButton("secondary")} cursor-pointer ${busy === "photo" ? "pointer-events-none opacity-50" : ""}`}>
              {busy === "photo" ? "Saving…" : profile.has_avatar ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} />
            </label>
            {profile.has_avatar && <Btn variant="ghost" onClick={deletePhoto} disabled={busy === "photo"}>Remove</Btn>}
          </div>
          <p className="text-[11px] text-gray-400">JPG, PNG or WebP. It&apos;s cropped to a square automatically.</p>
        </div>
      </div>

      <form onSubmit={saveName} className="mt-5 space-y-2">
        <Field label="Full name" hint="Shown to other staff instead of your username. You still sign in with your username.">
          {(id) => (
            <div className="flex gap-2">
              <input id={id} maxLength={100} autoComplete="name" placeholder="e.g. Juan Dela Cruz" className={inputClass} value={shownName} onChange={(e) => setName(e.target.value)} />
              <Btn type="submit" disabled={!nameChanged || busy === "name"}>{busy === "name" ? "Saving…" : "Save"}</Btn>
            </div>
          )}
        </Field>
        {saved && <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">Saved ✓</p>}
      </form>
      {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}

      <ContactSection kind="email" />
      {SMS_ENABLED && <ContactSection kind="mobile" />}

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-[13px] dark:border-white/10">
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Username</dt>
          <dd className="font-semibold text-gray-900 dark:text-white">{profile.username}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Role</dt>
          <dd className="font-semibold text-gray-900 dark:text-white">{profile.role_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Office</dt>
          <dd className="font-semibold text-gray-900 dark:text-white">{profile.office_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Last sign-in</dt>
          <dd className="font-semibold text-gray-900 dark:text-white">{profile.last_login ? fmtDateTime(profile.last_login) : "—"}</dd>
        </div>
      </dl>
    </Card>
  );
}

// Where "forgot password" codes go, confirmed with a 6-digit code. Email for now;
// the mobile-number section returns when SMS does (see lib/features.ts).
const CONTACT = {
  email: {
    label: "Email address",
    empty: "Not added. You need it to reset a forgotten password.",
    add: "Add email",
    placeholder: "name@gmail.com",
    inputMode: "email",
    autoComplete: "email",
    width: "max-w-[280px]",
    sendLabel: "Email me a code",
    sentVerb: "emailed",
    other: "Use a different email",
    removeConfirm: "Remove your email address? You won't be able to reset a forgotten password by email.",
    send: sendEmailCode,
    verify: verifyEmailCode,
    remove: removeEmail,
  },
  mobile: {
    label: "Mobile number (optional)",
    empty: "Not added. Only needed if your LGU sends codes by SMS.",
    add: "Add number",
    placeholder: "09XX XXX XXXX",
    inputMode: "tel",
    autoComplete: "tel",
    width: "max-w-[200px]",
    sendLabel: "Text me a code",
    sentVerb: "texted",
    other: "Use a different number",
    removeConfirm: "Remove your mobile number? You won't be able to reset a forgotten password by SMS.",
    send: sendMobileCode,
    verify: verifyMobileCode,
    remove: removeMobile,
  },
} as const;

function ContactSection({ kind }: { kind: keyof typeof CONTACT }) {
  const c = CONTACT[kind];
  const { profile, setProfile } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;
  const current = kind === "email" ? profile.email_masked : profile.mobile_masked;

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSentTo((await c.send(value)).sent_to);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setProfile(await c.verify(code));
      setEditing(false);
      setSentTo(null);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(c.removeConfirm)) return;
    try {
      setProfile(await c.remove());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove it");
    }
  }

  return (
    <div className="mt-5 space-y-2 border-t border-gray-100 pt-4 dark:border-white/10">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{c.label}</p>
      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          {current ? (
            <>
              <span className="font-mono text-[13px] text-gray-900 dark:text-white">{current}</span>
              <Badge tone="green" dot>Verified</Badge>
              <Btn variant="ghost" onClick={() => { setEditing(true); setError(null); }}>Change</Btn>
              <Btn variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={remove}>Remove</Btn>
            </>
          ) : (
            <>
              <span className="text-[13px] text-gray-500 dark:text-gray-400">{c.empty}</span>
              <Btn variant="secondary" onClick={() => { setEditing(true); setError(null); }}>{c.add}</Btn>
            </>
          )}
        </div>
      )}

      {editing && !sentTo && (
        <form onSubmit={send} className="flex flex-wrap gap-2">
          <input aria-label={c.label} type={kind === "email" ? "email" : "text"} inputMode={c.inputMode} autoComplete={c.autoComplete} placeholder={c.placeholder} className={`${inputClass} ${c.width}`} value={value} onChange={(e) => setValue(e.target.value)} />
          <Btn type="submit" disabled={busy || !value.trim()}>{busy ? "Sending…" : c.sendLabel}</Btn>
          <Btn variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
        </form>
      )}

      {editing && sentTo && (
        <form onSubmit={verify} className="space-y-2">
          <p className="text-[13px] text-gray-600 dark:text-gray-300">
            We {c.sentVerb} a 6-digit code to {sentTo}. It expires in 10 minutes.{kind === "email" ? " Check your spam folder if you don't see it." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={`${inputClass} w-32 text-center font-mono tracking-[0.3em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <Btn type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</Btn>
            <Btn variant="ghost" onClick={() => setSentTo(null)}>{c.other}</Btn>
          </div>
        </form>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function RequestStatus({ req }: { req: MyPasswordRequest }) {
  if (req.status === "pending")
    return (
      <div className="rounded-2xl bg-sky-50 px-4 py-3 text-[13px] leading-relaxed text-sky-900 ring-1 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/20">
        <p className="font-semibold">Waiting for a System Administrator&apos;s approval</p>
        <p className="mt-0.5">
          Requested {fmtDateTime(req.requested_at)}. Keep using your current password until then. Once it&apos;s approved you&apos;ll be signed out, and you can sign in with your new password.
        </p>
      </div>
    );
  if (req.status === "rejected")
    return (
      <div className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/20">
        <p className="font-semibold">Your last request was not approved{req.decided_at ? ` (${fmtDateTime(req.decided_at)})` : ""}</p>
        {req.decision_note && <p className="mt-0.5">Reason: {req.decision_note}</p>}
        <p className="mt-0.5">Your current password still works. You can submit a new one below.</p>
      </div>
    );
  return (
    <p className="text-[13px] text-gray-500 dark:text-gray-400">
      Your last password change was approved{req.decided_at ? ` on ${fmtDateTime(req.decided_at)}` : ""}.
    </p>
  );
}

function PasswordForm({ temporary, onSubmitted }: { temporary: boolean; onSubmitted: (r: { request: MyPasswordRequest; applied: boolean }) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordOk(next, confirm)) {
      setError("Your new password doesn't meet all the rules yet.");
      return;
    }
    setBusy(true);
    try {
      onSubmitted(await requestPasswordChange(current, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";
  const allPass = passwordOk(next, confirm);
  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <Field label={temporary ? "Temporary password" : "Current password"} hint={temporary ? "The one the System Administrator gave you." : undefined}>
        {(id) => <input id={id} type={type} required autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />}
      </Field>
      <Field label="New password">
        {(id) => <input id={id} type={type} required autoComplete="new-password" aria-describedby="pw-rules" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Field label="Type the new password again">
        {(id) => <input id={id} type={type} required autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      <PasswordChecklist id="pw-rules" password={next} confirm={confirm} />
      <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        Show passwords
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <Btn type="submit" disabled={busy || !current || !allPass}>{busy ? "Submitting…" : "Submit for approval"}</Btn>
    </form>
  );
}
