"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Btn, Card, ErrorText, Field, fmtNum, inputClass, Loading, Modal, PageTitle, StatCard, Table, td, th } from "@/components/admin/ui";
import { CacheStats, DatabaseInfo, getCacheStats, getDatabaseInfo, getSystemHealth, purgeCache, ServiceStatus, setCacheTtl } from "@/lib/adminApi";

// System Administrator (Fig. 11): Monitor System Health, Manage Database
// Configuration, Manage Session Cache (Redis).

export default function SystemPage() {
  const [health, setHealth] = useState<ServiceStatus[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [db, setDb] = useState<DatabaseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [purge, setPurge] = useState<"idle" | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [ttl, setTtl] = useState("");

  const refreshHealth = useCallback(() => {
    getSystemHealth()
      .then((h) => {
        setHealth(h);
        setCheckedAt(new Date());
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refreshHealth();
    getCacheStats()
      .then((c) => {
        setCache(c);
        setTtl(String(c.ttl_minutes));
      })
      .catch((e) => setError(e.message));
    getDatabaseInfo().then(setDb).catch((e) => setError(e.message));
    const t = setInterval(refreshHealth, 30000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  async function doPurge() {
    if (!purge) return;
    setBusy(true);
    try {
      const c = await purgeCache(purge);
      setCache(c);
      setNotice(`${c.purged ?? 0} chat session${c.purged === 1 ? "" : "s"} purged.`);
      setPurge(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purge failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveTtl() {
    const n = Number(ttl);
    if (!Number.isInteger(n) || n < 5 || n > 240) {
      setError("Session timeout must be a whole number between 5 and 240 minutes.");
      return;
    }
    try {
      await setCacheTtl(n);
      setCache((c) => (c ? { ...c, ttl_minutes: n } : c));
      setError(null);
      setNotice("Idle session timeout saved. It applies to new and active chats from their next message.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  const up = health?.filter((h) => h.status === "up").length ?? 0;

  return (
    <>
      <PageTitle title="System Health" description="Status of the backend services, the PostgreSQL database and the Redis session cache." actions={<Btn variant="secondary" onClick={refreshHealth}>Re-check now</Btn>} />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {notice && <p className="mb-4 rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">{notice}</p>}

      <div className="space-y-4">
        <Card
          title="Services"
          subtitle={checkedAt ? `Checked ${checkedAt.toLocaleTimeString("en-PH")} · refreshes every 30 s` : undefined}
          actions={health ? <Badge tone={up === health.length ? "green" : "amber"} dot>{up}/{health.length} healthy</Badge> : undefined}
        >
          {!health ? (
            <Loading label="Checking services…" />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {health.map((s) => (
                <div key={s.name} className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{s.name}</p>
                    <Badge tone={s.status === "up" ? "green" : s.status === "degraded" ? "amber" : "red"} dot>
                      {s.status === "up" ? "Operational" : s.status === "degraded" ? "Degraded" : "Down"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{s.detail}</p>
                  {s.latency_ms !== undefined && <p className="mt-2 text-xs tabular-nums text-gray-400">{s.latency_ms != null ? `${s.latency_ms} ms response` : "No response"}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-2" title="Redis session cache" subtitle="Chat answers live here only while a citizen is active, then are purged (RA 10173).">
            {!cache ? (
              <Loading />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Active chat sessions" value={fmtNum(cache.active_sessions)} />
                  <StatCard label="Keys in cache" value={fmtNum(cache.keys)} hint={cache.memory_mb != null ? `${cache.memory_mb} MB used` : undefined} tone="gray" />
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="Idle session timeout (minutes)" hint="Inactive chats are wiped after this long.">
                      {(id) => <input id={id} type="number" min={5} max={240} className={inputClass} value={ttl} onChange={(e) => setTtl(e.target.value)} />}
                    </Field>
                  </div>
                  <Btn variant="secondary" className="mb-[22px]" onClick={saveTtl} disabled={ttl === String(cache.ttl_minutes)}>Save</Btn>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                  <Btn variant="secondary" onClick={() => setPurge("idle")}>Purge idle sessions</Btn>
                  <Btn variant="danger" onClick={() => setPurge("all")}>End all chat sessions</Btn>
                </div>
              </>
            )}
          </Card>

          <Card className="xl:col-span-3" title="PostgreSQL" subtitle={db ? `${db.version} · ${db.size_mb} MB · connection pool ${db.pool_size - db.pool_idle}/${db.pool_size} in use` : undefined}>
            {!db ? (
              <Loading />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Table</th>
                    <th className={th}>Module</th>
                    <th className={`${th} text-right`}>Rows</th>
                    <th className={`${th} text-right`}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {[...db.tables].sort((a, b) => a.module.localeCompare(b.module) || a.table.localeCompare(b.table)).map((t) => (
                    <tr key={t.table}>
                      <td className={td}><code className="font-mono text-[12px]">{t.table}</code></td>
                      <td className={`${td} text-gray-500`}>{t.module}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtNum(t.rows)}</td>
                      <td className={`${td} text-right tabular-nums text-gray-500`}>{t.size_kb >= 1024 ? `${(t.size_kb / 1024).toFixed(1)} MB` : `${t.size_kb} KB`}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-3 text-[11px] text-gray-400">Row counts are PostgreSQL&apos;s live estimates (pg_stat_user_tables).</p>
          </Card>
        </div>
      </div>

      <Modal
        open={!!purge}
        onClose={() => setPurge(null)}
        title={purge === "all" ? "End every active chat session?" : "Purge idle sessions?"}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setPurge(null)}>Cancel</Btn>
            <Btn variant={purge === "all" ? "danger" : "primary"} onClick={doPurge} disabled={busy}>{busy ? "Working…" : purge === "all" ? "End all sessions" : "Purge"}</Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {purge === "all"
            ? `This immediately ends all ${cache?.active_sessions ?? 0} active citizen chats and deletes their answers. They'll need to start again. This can't be undone.`
            : "Deletes chats nobody has touched for more than half the idle timeout. Active chats are not affected."}
        </p>
      </Modal>
    </>
  );
}
