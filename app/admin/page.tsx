"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Counts = { users: number; images: number; captions: number };
type DailyPoint = { day: string; count: number };

export default function AdminPage() {
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState<string>("");
  const [counts, setCounts] = useState<Counts>({ users: 0, images: 0, captions: 0 });

  const [last7, setLast7] = useState<DailyPoint[]>([]);
  const [topImages, setTopImages] = useState<{ image_id: string; url?: string; caption_count: number }[]>([]);
  const [topUsers, setTopUsers] = useState<{ user_id: string; email?: string; caption_count: number }[]>([]);
  const [longest, setLongest] = useState<{ id: string; image_id: string; content: string; len: number }[]>([]);
  const [health, setHealth] = useState<{ pctLong: number; avgLen: number; medianLen: number }>({
    pctLong: 0,
    avgLen: 0,
    medianLen: 0,
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      setEmail(sessionData.session?.user.email ?? "");

      const [u, i, c] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("images").select("*", { count: "exact", head: true }),
        supabase.from("captions").select("*", { count: "exact", head: true }),
      ]);

      setCounts({
        users: u.count ?? 0,
        images: i.count ?? 0,
        captions: c.count ?? 0,
      });

      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data: recentCaps } = await supabase
        .from("captions")
        .select("id,image_id,content,created_at,created_by")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);

      const caps = (recentCaps ?? []) as any[];

      const byDay = new Map<string, number>();
      for (const row of caps) {
        const day = new Date(row.created_at).toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }

      const points: DailyPoint[] = [];
      for (let d = 6; d >= 0; d--) {
        const date = new Date(Date.now() - d * 24 * 3600 * 1000);
        const day = date.toISOString().slice(0, 10);
        points.push({ day, count: byDay.get(day) ?? 0 });
      }
      setLast7(points);

      const lens = caps
        .map((x) => (x.content?.length ?? 0))
        .filter((n) => n > 0)
        .sort((a, b) => a - b);

      const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
      const medianLen = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
      const longThreshold = 80;
      const pctLong = lens.length ? (lens.filter((n) => n >= longThreshold).length / lens.length) * 100 : 0;
      setHealth({ pctLong, avgLen, medianLen });

      const imgCounts = new Map<string, number>();
      for (const row of caps) imgCounts.set(row.image_id, (imgCounts.get(row.image_id) ?? 0) + 1);
      const topImgIds = [...imgCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

      if (topImgIds.length) {
        const { data: imgs } = await supabase.from("images").select("id,url").in(
          "id",
          topImgIds.map(([id]) => id)
        );
        const urlById = new Map((imgs ?? []).map((x: any) => [x.id, x.url]));
        setTopImages(
          topImgIds.map(([image_id, caption_count]) => ({
            image_id,
            caption_count,
            url: urlById.get(image_id),
          }))
        );
      } else {
        setTopImages([]);
      }

      const userCounts = new Map<string, number>();
      for (const row of caps) if (row.created_by) userCounts.set(row.created_by, (userCounts.get(row.created_by) ?? 0) + 1);
      const topUserIds = [...userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

      if (topUserIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,email").in(
          "id",
          topUserIds.map(([id]) => id)
        );
        const emailById = new Map((profs ?? []).map((x: any) => [x.id, x.email]));
        setTopUsers(
          topUserIds.map(([user_id, caption_count]) => ({
            user_id,
            caption_count,
            email: emailById.get(user_id) ?? undefined,
          }))
        );
      } else {
        setTopUsers([]);
      }

      const longestLocal = [...caps]
        .map((x) => ({
          id: x.id as string,
          image_id: x.image_id as string,
          content: (x.content ?? "") as string,
          len: ((x.content ?? "") as string).length,
        }))
        .sort((a, b) => b.len - a.len)
        .slice(0, 6);
      setLongest(longestLocal);

      setLoading(false);
    };

    run();
  }, []);

  const maxY = useMemo(() => Math.max(1, ...last7.map((p) => p.count)), [last7]);

  return (
    <main style={ui.shell}>
      <Background />

      <div style={ui.wrap}>
        <header style={ui.header}>
          <div>
            <div style={ui.kickerRow}>
              <span style={ui.kicker}>ADMIN</span>
              <span style={ui.pill}>Live stats</span>
            </div>

            <h1 style={ui.h1}>Admin Panel</h1>
            <div style={ui.subline}>
              Signed in as <b style={{ opacity: 0.95 }}>{email || "unknown"}</b>
            </div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace("/");
            }}
            style={ui.signout}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
          >
            Sign out <span style={{ opacity: 0.7 }}>→</span>
          </button>
        </header>

        {loading ? (
          <div style={ui.loadingCard}>
            <div style={ui.loadingTitle}>Loading dashboard…</div>
            <div style={ui.loadingSub}>Fetching counts and last-7-day activity.</div>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <section style={ui.kpiGrid}>
              <KpiCard title="Users" value={counts.users.toLocaleString()} subtitle="Profiles in DB" />
              <KpiCard title="Images" value={counts.images.toLocaleString()} subtitle="Uploaded assets" />
              <KpiCard title="Captions" value={counts.captions.toLocaleString()} subtitle="Total caption rows" />
            </section>

            {/* Velocity + top users */}
            <section style={ui.twoCol}>
              <div style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Caption velocity</div>
                    <div style={ui.cardSub}>Last 7 days</div>
                  </div>
                  <span style={ui.pill}>Trend</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18, marginTop: 10 }}>
                  <SparkBars points={last7} maxY={maxY} />
                  <div style={ui.metrics}>
                    <Metric label="Avg length" value={`${Math.round(health.avgLen)} chars`} />
                    <Metric label="Median" value={`${Math.round(health.medianLen)} chars`} />
                    <Metric label="% ≥ 80 chars" value={`${health.pctLong.toFixed(1)}%`} />
                    <div style={ui.miniNote}>
                      Length-based “quality proxy” until vote-scoring exists.
                    </div>
                  </div>
                </div>
              </div>

              <div style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Top captioners</div>
                    <div style={ui.cardSub}>Last 7 days</div>
                  </div>
                  <span style={ui.pill}>Leaders</span>
                </div>

                {topUsers.length ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {topUsers.map((u, idx) => (
                      <div key={u.user_id} style={ui.row}>
                        <div style={ui.rank}>{idx + 1}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={ui.rowTitle}>{u.email ?? u.user_id.slice(0, 8)}</div>
                          <div style={ui.rowSub}><code style={ui.code}>{u.user_id.slice(0, 10)}…</code></div>
                        </div>
                        <div style={ui.rowRight}>
                          <div style={ui.rowValue}>{u.caption_count}</div>
                          <div style={ui.rowSub}>captions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No recent activity" body="No captions were created in the last 7 days." />
                )}
              </div>
            </section>

            {/* Images + longest */}
            <section style={ui.twoCol}>
              <div style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Most captioned images</div>
                    <div style={ui.cardSub}>Last 7 days</div>
                  </div>
                  <span style={ui.pill}>Hot</span>
                </div>

                {topImages.length ? (
                  <div style={ui.imageGrid}>
                    {topImages.map((img) => (
                      <div key={img.image_id} style={ui.imageTile} title={img.image_id}>
                        <div style={ui.imageFrame}>
                          {img.url ? (
                            <img src={img.url} alt="" style={ui.img} />
                          ) : (
                            <div style={ui.imagePlaceholder}>No URL</div>
                          )}
                        </div>
                        <div style={ui.imageMeta}>
                          <div style={ui.imageCount}>
                            <b>{img.caption_count}</b> captions
                          </div>
                          <div style={ui.imageId}><code style={ui.code}>{img.image_id.slice(0, 10)}…</code></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No recent data" body="Once users create captions, this will populate automatically." />
                )}
              </div>

              <div style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Longest captions</div>
                    <div style={ui.cardSub}>Last 7 days</div>
                  </div>
                  <span style={ui.pill}>Fun</span>
                </div>

                {longest.length ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                    {longest.map((c) => (
                      <div key={c.id} style={ui.longRow}>
                        <div style={ui.longBadge}>{c.len} chars</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={ui.longText}>
                            {c.content.slice(0, 150)}
                            {c.content.length > 150 ? "…" : ""}
                          </div>
                          <div style={ui.longMeta}>
                            image <code style={ui.code}>{c.image_id.slice(0, 10)}…</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No recent captions" body="Create a few captions to unlock this section." />
                )}
              </div>
            </section>
          </>
        )}

        <footer style={ui.footer}>
          <div style={{ opacity: 0.6 }}>© Admin · internal use</div>
        </footer>
      </div>
    </main>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div style={ui.kpiCard}>
      <div style={ui.kpiTitle}>{title}</div>
      <div style={ui.kpiValue}>{value}</div>
      <div style={ui.kpiSub}>{subtitle}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={ui.metricRow}>
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function SparkBars({ points, maxY }: { points: DailyPoint[]; maxY: number }) {
  return (
    <div style={ui.sparkWrap}>
      {points.map((p) => {
        const h = Math.round((p.count / maxY) * 100);
        return (
          <div key={p.day} style={ui.sparkCol} title={`${p.day}: ${p.count}`}>
            <div style={ui.sparkTrack}>
              <div style={{ ...ui.sparkFill, height: `${Math.max(4, h)}%` }} />
            </div>
            <div style={ui.sparkLabel}>{p.day.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div style={ui.empty}>
      <div style={ui.emptyTitle}>{title}</div>
      <div style={ui.emptyBody}>{body}</div>
    </div>
  );
}

function Background() {
  return (
    <>
      <div style={ui.bgGradient} />
      <div style={ui.bgGlowA} />
      <div style={ui.bgGlowB} />
      <div style={ui.bgNoise} />
    </>
  );
}

const ui: Record<string, React.CSSProperties> & { fontFamily: string } = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',

  shell: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    color: "white",
    background: "#06070a",
  },

  wrap: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 22px 36px",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },

  kickerRow: { display: "flex", gap: 10, alignItems: "center" },

  kicker: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: 2,
    opacity: 0.95,
  },

  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.85,
  },

  h1: {
    fontSize: 62,
    lineHeight: 0.95,
    letterSpacing: -2,
    margin: "14px 0 10px",
    fontWeight: 1000 as any,
  },

  subline: { opacity: 0.8, fontSize: 15 },

  signout: {
    height: 44,
    padding: "12px 16px",
    borderRadius: 14,
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.08))",
    color: "white",
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
    transform: "translateY(0px)",
    transition: "transform 120ms ease",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginTop: 18,
  },

  kpiCard: {
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },

  kpiTitle: { opacity: 0.75, fontWeight: 900, fontSize: 14 },
  kpiValue: { fontSize: 40, fontWeight: 1000 as any, marginTop: 8, letterSpacing: -1 },
  kpiSub: { opacity: 0.7, marginTop: 4 },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: 14,
    marginTop: 14,
  },

  card: {
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: { fontWeight: 950, fontSize: 16 },
  cardSub: { opacity: 0.7, fontSize: 12, marginTop: 4 },

  metrics: { paddingTop: 6 },
  metricRow: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 },

  miniNote: { marginTop: 10, opacity: 0.62, fontSize: 12, lineHeight: 1.45 },

  sparkWrap: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    height: 150,
    padding: "6px 4px",
  },

  sparkCol: { flex: 1, minWidth: 30 },

  sparkTrack: {
    height: 110,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
  },

  sparkFill: {
    width: "100%",
    borderRadius: 14,
    background: "rgba(255,255,255,0.20)",
  },

  sparkLabel: {
    marginTop: 8,
    fontSize: 11,
    opacity: 0.6,
    textAlign: "center",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },

  rank: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    opacity: 0.9,
  },

  rowTitle: {
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  rowRight: { textAlign: "right" },
  rowValue: { fontWeight: 1000 as any, fontSize: 18, letterSpacing: -0.5 },
  rowSub: { opacity: 0.6, fontSize: 12 },

  imageGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  imageTile: {
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
  },

  imageFrame: { aspectRatio: "1 / 1", background: "rgba(255,255,255,0.06)" },

  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },

  imagePlaceholder: { height: "100%", display: "grid", placeItems: "center", opacity: 0.7 },

  imageMeta: { padding: 10 },
  imageCount: { fontSize: 12, opacity: 0.9 },
  imageId: { marginTop: 6, opacity: 0.7, fontSize: 12 },

  longRow: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 12,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },

  longBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 950,
    fontSize: 12,
    opacity: 0.92,
    whiteSpace: "nowrap",
  },

  longText: { fontWeight: 800, opacity: 0.95, lineHeight: 1.35 },
  longMeta: { marginTop: 6, opacity: 0.65, fontSize: 12 },

  code: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    opacity: 0.85,
  },

  empty: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },

  emptyTitle: { fontWeight: 950 },
  emptyBody: { marginTop: 6, opacity: 0.7, fontSize: 13, lineHeight: 1.45 },

  loadingCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },

  loadingTitle: { fontWeight: 950, fontSize: 16 },
  loadingSub: { marginTop: 6, opacity: 0.7 },

  footer: { marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" },

  // background
  bgGradient: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1200px 700px at 10% 10%, rgba(120,140,255,0.22), transparent 55%), radial-gradient(900px 650px at 90% 20%, rgba(255,140,200,0.14), transparent 60%), radial-gradient(900px 650px at 30% 110%, rgba(0,255,180,0.10), transparent 55%)",
  },

  bgGlowA: {
    position: "absolute",
    width: 900,
    height: 900,
    left: -320,
    top: -340,
    background: "radial-gradient(circle, rgba(130,120,255,0.18), transparent 60%)",
    filter: "blur(2px)",
  },

  bgGlowB: {
    position: "absolute",
    width: 900,
    height: 900,
    right: -320,
    bottom: -380,
    background: "radial-gradient(circle, rgba(255,120,200,0.14), transparent 60%)",
    filter: "blur(2px)",
  },

  bgNoise: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22 x=%220%22 y=%220%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.08%22/></svg>')",
    opacity: 0.22,
    mixBlendMode: "overlay",
    pointerEvents: "none",
  },
};