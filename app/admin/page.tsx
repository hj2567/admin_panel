"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

/** ===== Types that match YOUR schema ===== */

type Counts = { users: number; images: number; captions: number };
type DailyPoint = { day: string; count: number };

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  is_superadmin: boolean | null;
  is_in_study: boolean | null;
  is_matrix_admin: boolean | null;
  created_datetime_utc: string | null;
  modified_datetime_utc: string | null;
};

type CaptionRow = {
  id: string;
  content: string | null;
  like_count: number | null;
  is_public: boolean | null;
  profile_id: string | null;
  image_id: string | null;
  created_datetime_utc: string | null;
  modified_datetime_utc: string | null;
};

type ImageRow = {
  id: string;
  url: string | null;
  is_public: boolean | null;
  is_common_use: boolean | null;
  profile_id: string | null;
  created_datetime_utc: string | null;
  modified_datetime_utc: string | null;
};

type Tab = "dashboard" | "users" | "captions" | "images";

export default function AdminPage() {
  const supabase = getSupabaseBrowserClient();

  const [tab, setTab] = useState<Tab>("dashboard");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const [email, setEmail] = useState<string>("");
  const [myProfileId, setMyProfileId] = useState<string>("");

  /** ===== Dashboard state ===== */
  const [counts, setCounts] = useState<Counts>({ users: 0, images: 0, captions: 0 });
  const [last7, setLast7] = useState<DailyPoint[]>([]);
  const [topImages, setTopImages] = useState<{ image_id: string; url?: string; caption_count: number }[]>([]);
  const [topUsers, setTopUsers] = useState<{ profile_id: string; email?: string; caption_count: number }[]>([]);
  const [longest, setLongest] = useState<{ id: string; image_id: string; content: string; len: number }[]>([]);
  const [health, setHealth] = useState<{ pctLong: number; avgLen: number; medianLen: number }>({
    pctLong: 0,
    avgLen: 0,
    medianLen: 0,
  });

  /** ===== Users (READ) ===== */
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [usersPage, setUsersPage] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const USERS_PAGE_SIZE = 25;

  /** ===== Captions (READ) ===== */
  const [captions, setCaptions] = useState<CaptionRow[]>([]);
  const [capPage, setCapPage] = useState(0);
  const [hasMoreCaps, setHasMoreCaps] = useState(false);
  const CAPS_PAGE_SIZE = 25;

  const [capQuery, setCapQuery] = useState("");
  const [capProfileFilter, setCapProfileFilter] = useState("");
  const [capImageFilter, setCapImageFilter] = useState("");

  /** ===== Images (CRUD) ===== */
  const [images, setImages] = useState<ImageRow[]>([]);
  const [imgPage, setImgPage] = useState(0);
  const [hasMoreImages, setHasMoreImages] = useState(false);
  const IMAGES_PAGE_SIZE = 25;

  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageIsPublic, setNewImageIsPublic] = useState(true);
  const [newImageCommonUse, setNewImageCommonUse] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [editingIsPublic, setEditingIsPublic] = useState<boolean>(true);
  const [editingCommonUse, setEditingCommonUse] = useState<boolean>(false);

  /** ===== Initial load: session + dashboard ===== */
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        setError(sessErr.message);
        setLoading(false);
        return;
      }

      const session = sessionData.session;
      setEmail(session?.user.email ?? "");
      setMyProfileId(session?.user.id ?? "");

      // counts (head:true)
      const [u, i, c] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("images").select("*", { count: "exact", head: true }),
        supabase.from("captions").select("*", { count: "exact", head: true }),
      ]);

      if (u.error || i.error || c.error) {
        setError(u.error?.message || i.error?.message || c.error?.message || "Failed to load counts.");
        setLoading(false);
        return;
      }

      setCounts({
        users: u.count ?? 0,
        images: i.count ?? 0,
        captions: c.count ?? 0,
      });

      // Dashboard: last 7 days caption activity
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const { data: recentCaps, error: capsErr } = await supabase
        .from("captions")
        .select("id,image_id,content,created_datetime_utc,profile_id")
        .gte("created_datetime_utc", since)
        .order("created_datetime_utc", { ascending: true })
        .limit(5000);

      if (capsErr) {
        setError(capsErr.message);
        setLoading(false);
        return;
      }

      const caps = (recentCaps ?? []) as Array<{
        id: string;
        image_id: string | null;
        content: string | null;
        created_datetime_utc: string | null;
        profile_id: string | null;
      }>;

      // by day
      const byDay = new Map<string, number>();
      for (const row of caps) {
        if (!row.created_datetime_utc) continue;
        const day = new Date(row.created_datetime_utc).toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }

      const points: DailyPoint[] = [];
      for (let d = 6; d >= 0; d--) {
        const date = new Date(Date.now() - d * 24 * 3600 * 1000);
        const day = date.toISOString().slice(0, 10);
        points.push({ day, count: byDay.get(day) ?? 0 });
      }
      setLast7(points);

      // caption length stats
      const lens = caps
        .map((x) => (x.content?.length ?? 0))
        .filter((n) => n > 0)
        .sort((a, b) => a - b);

      const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
      const medianLen = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
      const longThreshold = 80;
      const pctLong = lens.length ? (lens.filter((n) => n >= longThreshold).length / lens.length) * 100 : 0;
      setHealth({ pctLong, avgLen, medianLen });

      // top images by captions (from recent caps)
      const imgCounts = new Map<string, number>();
      for (const row of caps) {
        if (!row.image_id) continue;
        imgCounts.set(row.image_id, (imgCounts.get(row.image_id) ?? 0) + 1);
      }
      const topImgIds = [...imgCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

      if (topImgIds.length) {
        const { data: imgs, error: imgsErr } = await supabase
          .from("images")
          .select("id,url")
          .in(
            "id",
            topImgIds.map(([id]) => id)
          );

        if (!imgsErr) {
          const urlById = new Map((imgs ?? []).map((x: any) => [x.id, x.url]));
          setTopImages(
            topImgIds.map(([image_id, caption_count]) => ({
              image_id,
              caption_count,
              url: urlById.get(image_id),
            }))
          );
        } else {
          // if RLS blocks images read, still show counts
          setTopImages(topImgIds.map(([image_id, caption_count]) => ({ image_id, caption_count })));
        }
      } else {
        setTopImages([]);
      }

      // top users (profiles) by captions (from recent caps)
      const userCounts = new Map<string, number>();
      for (const row of caps) {
        if (!row.profile_id) continue;
        userCounts.set(row.profile_id, (userCounts.get(row.profile_id) ?? 0) + 1);
      }
      const topUserIds = [...userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

      if (topUserIds.length) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id,email")
          .in(
            "id",
            topUserIds.map(([id]) => id)
          );

        if (!profErr) {
          const emailById = new Map((profs ?? []).map((x: any) => [x.id, x.email]));
          setTopUsers(
            topUserIds.map(([profile_id, caption_count]) => ({
              profile_id,
              caption_count,
              email: emailById.get(profile_id) ?? undefined,
            }))
          );
        } else {
          // if RLS blocks profiles read, still show ids
          setTopUsers(topUserIds.map(([profile_id, caption_count]) => ({ profile_id, caption_count })));
        }
      } else {
        setTopUsers([]);
      }

      // longest captions (recent)
      const longestLocal = [...caps]
        .map((x) => ({
          id: x.id,
          image_id: x.image_id ?? "",
          content: x.content ?? "",
          len: (x.content ?? "").length,
        }))
        .sort((a, b) => b.len - a.len)
        .slice(0, 6);
      setLongest(longestLocal);

      setLoading(false);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ===== Lazy-load lists on tab open / paging / filtering ===== */
  useEffect(() => {
    if (loading) return;
    setError("");

    if (tab === "users") void loadUsers();
    if (tab === "captions") void loadCaptions();
    if (tab === "images") void loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, usersPage, capPage, capQuery, capProfileFilter, capImageFilter, imgPage]);

  const maxY = useMemo(() => Math.max(1, ...last7.map((p) => p.count)), [last7]);

  async function refreshCountsOnly() {
    const [u, i, c] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("images").select("*", { count: "exact", head: true }),
      supabase.from("captions").select("*", { count: "exact", head: true }),
    ]);

    setCounts({
      users: u.count ?? counts.users,
      images: i.count ?? counts.images,
      captions: c.count ?? counts.captions,
    });
  }

  /** ===== Users (READ) - RLS-aware pagination ===== */
  async function loadUsers() {
    setError("");
    const from = usersPage * USERS_PAGE_SIZE;
    const to = from + USERS_PAGE_SIZE; // fetch 1 extra row

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,first_name,last_name,is_superadmin,is_in_study,is_matrix_admin,created_datetime_utc,modified_datetime_utc")
      .order("created_datetime_utc", { ascending: false })
      .range(from, to);

    if (error) {
      setError(error.message);
      setUsers([]);
      setHasMoreUsers(false);
      return;
    }

    const rows = (data ?? []) as ProfileRow[];
    setHasMoreUsers(rows.length > USERS_PAGE_SIZE);
    setUsers(rows.slice(0, USERS_PAGE_SIZE));
  }

  /** ===== Captions (READ) - RLS-aware pagination ===== */
  async function loadCaptions() {
    setError("");
    const from = capPage * CAPS_PAGE_SIZE;
    const to = from + CAPS_PAGE_SIZE; // fetch 1 extra row

    let q = supabase
      .from("captions")
      .select("id,content,like_count,is_public,profile_id,image_id,created_datetime_utc,modified_datetime_utc")
      .order("created_datetime_utc", { ascending: false });

    if (capProfileFilter.trim()) q = q.eq("profile_id", capProfileFilter.trim());
    if (capImageFilter.trim()) q = q.eq("image_id", capImageFilter.trim());
    if (capQuery.trim()) q = q.ilike("content", `%${capQuery.trim()}%`);

    const { data, error } = await q.range(from, to);

    if (error) {
      setError(error.message);
      setCaptions([]);
      setHasMoreCaps(false);
      return;
    }

    const rows = (data ?? []) as CaptionRow[];
    setHasMoreCaps(rows.length > CAPS_PAGE_SIZE);
    setCaptions(rows.slice(0, CAPS_PAGE_SIZE));
  }

  /** ===== Images (CRUD) - RLS-aware pagination ===== */
  async function loadImages() {
    setError("");
    const from = imgPage * IMAGES_PAGE_SIZE;
    const to = from + IMAGES_PAGE_SIZE; // fetch 1 extra row

    const { data, error } = await supabase
      .from("images")
      .select("id,url,is_public,is_common_use,profile_id,created_datetime_utc,modified_datetime_utc")
      .order("created_datetime_utc", { ascending: false })
      .range(from, to);

    if (error) {
      setError(error.message);
      setImages([]);
      setHasMoreImages(false);
      return;
    }

    const rows = (data ?? []) as ImageRow[];
    setHasMoreImages(rows.length > IMAGES_PAGE_SIZE);
    setImages(rows.slice(0, IMAGES_PAGE_SIZE));
  }

  async function createImage() {
    setBusy(true);
    setError("");
    try {
      const url = newImageUrl.trim();
      if (!url) throw new Error("URL is required.");

      const payload = {
        url,
        is_public: newImageIsPublic,
        is_common_use: newImageCommonUse,
        profile_id: myProfileId || null,
      };

      const { error } = await supabase.from("images").insert(payload);
      if (error) throw error;

      setNewImageUrl("");
      setNewImageIsPublic(true);
      setNewImageCommonUse(false);

      await refreshCountsOnly();
      await loadImages();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create image.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(img: ImageRow) {
    setEditingId(img.id);
    setEditingUrl(img.url ?? "");
    setEditingIsPublic(!!img.is_public);
    setEditingCommonUse(!!img.is_common_use);
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    setError("");
    try {
      const url = editingUrl.trim();
      if (!url) throw new Error("URL cannot be empty.");

      const { error } = await supabase
        .from("images")
        .update({
          url,
          is_public: editingIsPublic,
          is_common_use: editingCommonUse,
        })
        .eq("id", editingId);

      if (error) throw error;

      setEditingId(null);
      setEditingUrl("");
      await loadImages();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update image.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage(id: string) {
    const ok = confirm("Delete this image row? (This deletes the DB row, not any external storage objects.)");
    if (!ok) return;

    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.from("images").delete().eq("id", id);
      if (error) throw error;

      await refreshCountsOnly();
      await loadImages();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={ui.shell}>
      <Background />

      <div style={ui.wrap}>
        <header style={ui.header}>
          <div>
            <div style={ui.kickerRow}>
              <span style={ui.kicker}>ADMIN</span>
              <span style={ui.pill}>Manage + stats</span>
            </div>

            <h1 style={ui.h1}>Admin Panel</h1>
            <div style={ui.subline}>
              Signed in as <b style={{ opacity: 0.95 }}>{email || "unknown"}</b>
            </div>

            <nav style={ui.tabs}>
              <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
                Dashboard
              </TabButton>
              <TabButton
                active={tab === "users"}
                onClick={() => {
                  setUsersPage(0);
                  setTab("users");
                }}
              >
                Users (READ)
              </TabButton>
              <TabButton
                active={tab === "captions"}
                onClick={() => {
                  setCapPage(0);
                  setTab("captions");
                }}
              >
                Captions (READ)
              </TabButton>
              <TabButton
                active={tab === "images"}
                onClick={() => {
                  setImgPage(0);
                  setTab("images");
                }}
              >
                Images (CRUD)
              </TabButton>
            </nav>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace("/");
            }}
            style={ui.signout}
            disabled={busy}
          >
            Sign out <span style={{ opacity: 0.7 }}>→</span>
          </button>
        </header>

        {error ? (
          <div style={ui.errorCard}>
            <div style={{ fontWeight: 950 }}>Error</div>
            <div style={{ marginTop: 6, opacity: 0.85, lineHeight: 1.4 }}>{error}</div>
            <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12, lineHeight: 1.4 }}>
              If this is an RLS error, the code is fine — your policies are blocking access for this user.
              (You said we can’t change RLS, so the only fix would be logging in as a role/user that has access.)
            </div>
          </div>
        ) : null}

        {loading ? (
          <div style={ui.loadingCard}>
            <div style={ui.loadingTitle}>Loading…</div>
            <div style={ui.loadingSub}>Fetching counts and activity.</div>
          </div>
        ) : (
          <>
            {/* KPI row always visible */}
            <section style={ui.kpiGrid}>
              <KpiCard title="Users" value={counts.users.toLocaleString()} subtitle="profiles rows" />
              <KpiCard title="Images" value={counts.images.toLocaleString()} subtitle="images rows" />
              <KpiCard title="Captions" value={counts.captions.toLocaleString()} subtitle="captions rows" />
            </section>

            {tab === "dashboard" ? (
              <>
                <section style={ui.twoCol}>
                  <div style={ui.card}>
                    <div style={ui.cardHeader}>
                      <div>
                        <div style={ui.cardTitle}>Caption velocity</div>
                        <div style={ui.cardSub}>Last 7 days (created_datetime_utc)</div>
                      </div>
                      <span style={ui.pill}>Trend</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18, marginTop: 10 }}>
                      <SparkBars points={last7} maxY={maxY} />
                      <div style={ui.metrics}>
                        <Metric label="Avg length" value={`${Math.round(health.avgLen)} chars`} />
                        <Metric label="Median" value={`${Math.round(health.medianLen)} chars`} />
                        <Metric label="% ≥ 80 chars" value={`${health.pctLong.toFixed(1)}%`} />
                        <div style={ui.miniNote}>Length-based “quality proxy”.</div>
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
                          <div key={u.profile_id} style={ui.row}>
                            <div style={ui.rank}>{idx + 1}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={ui.rowTitle}>{u.email ?? u.profile_id.slice(0, 8)}</div>
                              <div style={ui.rowSub}>
                                <code style={ui.code}>{u.profile_id.slice(0, 10)}…</code>
                              </div>
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
                                <div style={ui.imagePlaceholder}>No URL (maybe RLS)</div>
                              )}
                            </div>
                            <div style={ui.imageMeta}>
                              <div style={ui.imageCount}>
                                <b>{img.caption_count}</b> captions
                              </div>
                              <div style={ui.imageId}>
                                <code style={ui.code}>{img.image_id.slice(0, 10)}…</code>
                              </div>
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
                                image <code style={ui.code}>{(c.image_id || "").slice(0, 10)}…</code>
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
            ) : null}

            {tab === "users" ? (
              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Users / Profiles</div>
                    <div style={ui.cardSub}>READ-only</div>
                  </div>
                  <Pager
                    page={usersPage}
                    onPrev={() => setUsersPage((p) => Math.max(0, p - 1))}
                    onNext={() => setUsersPage((p) => p + 1)}
                    canPrev={usersPage > 0}
                    canNext={hasMoreUsers}
                  />
                </div>

                <Table>
                  <thead>
                    <tr>
                      <Th>Email</Th>
                      <Th>Name</Th>
                      <Th>Flags</Th>
                      <Th>Created</Th>
                      <Th>ID</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length ? (
                      users.map((u) => (
                        <tr key={u.id}>
                          <Td>{u.email ?? <span style={{ opacity: 0.6 }}>—</span>}</Td>
                          <Td>
                            {u.first_name || u.last_name ? (
                              <span>
                                {u.first_name ?? ""} {u.last_name ?? ""}
                              </span>
                            ) : (
                              <span style={{ opacity: 0.6 }}>—</span>
                            )}
                          </Td>
                          <Td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <PillSmall on={!!u.is_superadmin} label="superadmin" />
                              <PillSmall on={!!u.is_matrix_admin} label="matrix" />
                              <PillSmall on={!!u.is_in_study} label="study" />
                            </div>
                          </Td>
                          <Td>{u.created_datetime_utc ? new Date(u.created_datetime_utc).toLocaleString() : <span style={{ opacity: 0.6 }}>—</span>}</Td>
                          <Td>
                            <code style={ui.code}>{u.id.slice(0, 10)}…</code>
                          </Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <Td colSpan={5}>
                          <EmptyState title="No rows visible" body="RLS likely restricts you to viewing only your own profile (or none)." />
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </section>
            ) : null}

            {tab === "captions" ? (
              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Captions</div>
                    <div style={ui.cardSub}>READ-only (filter + paginate)</div>
                  </div>
                  <Pager
                    page={capPage}
                    onPrev={() => setCapPage((p) => Math.max(0, p - 1))}
                    onNext={() => setCapPage((p) => p + 1)}
                    canPrev={capPage > 0}
                    canNext={hasMoreCaps}
                  />
                </div>

                <div style={ui.filters}>
                  <input
                    value={capQuery}
                    onChange={(e) => {
                      setCapPage(0);
                      setCapQuery(e.target.value);
                    }}
                    placeholder="Search caption text…"
                    style={ui.input}
                  />
                  <input
                    value={capProfileFilter}
                    onChange={(e) => {
                      setCapPage(0);
                      setCapProfileFilter(e.target.value);
                    }}
                    placeholder="Filter by profile_id…"
                    style={ui.input}
                  />
                  <input
                    value={capImageFilter}
                    onChange={(e) => {
                      setCapPage(0);
                      setCapImageFilter(e.target.value);
                    }}
                    placeholder="Filter by image_id…"
                    style={ui.input}
                  />
                </div>

                <Table>
                  <thead>
                    <tr>
                      <Th>Created</Th>
                      <Th>Caption</Th>
                      <Th>Likes</Th>
                      <Th>Public</Th>
                      <Th>Profile</Th>
                      <Th>Image</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {captions.length ? (
                      captions.map((c) => (
                        <tr key={c.id}>
                          <Td>{c.created_datetime_utc ? new Date(c.created_datetime_utc).toLocaleString() : <span style={{ opacity: 0.6 }}>—</span>}</Td>
                          <Td>
                            <div style={{ maxWidth: 520, lineHeight: 1.35 }}>
                              {(c.content ?? "").slice(0, 220)}
                              {(c.content ?? "").length > 220 ? "…" : ""}
                            </div>
                            <div style={{ marginTop: 6, opacity: 0.6 }}>
                              <code style={ui.code}>{c.id.slice(0, 10)}…</code>
                            </div>
                          </Td>
                          <Td>{c.like_count ?? 0}</Td>
                          <Td>{c.is_public ? "Yes" : "No"}</Td>
                          <Td>{c.profile_id ? <code style={ui.code}>{c.profile_id.slice(0, 10)}…</code> : <span style={{ opacity: 0.6 }}>—</span>}</Td>
                          <Td>{c.image_id ? <code style={ui.code}>{c.image_id.slice(0, 10)}…</code> : <span style={{ opacity: 0.6 }}>—</span>}</Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <Td colSpan={6}>
                          <EmptyState title="No rows visible" body="No captions match your filters, or RLS limits the rows you can read." />
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </section>
            ) : null}

            {tab === "images" ? (
              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Images</div>
                    <div style={ui.cardSub}>CREATE / READ / UPDATE / DELETE</div>
                  </div>
                  <Pager
                    page={imgPage}
                    onPrev={() => setImgPage((p) => Math.max(0, p - 1))}
                    onNext={() => setImgPage((p) => p + 1)}
                    canPrev={imgPage > 0}
                    canNext={hasMoreImages}
                  />
                </div>

                {/* CREATE */}
                <div style={ui.createBox}>
                  <div style={{ fontWeight: 950, marginBottom: 10 }}>Create image row</div>
                  <div style={ui.createRow}>
                    <input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Image URL (required)"
                      style={ui.input}
                      disabled={busy}
                    />
                    <label style={ui.checkRow}>
                      <input type="checkbox" checked={newImageIsPublic} onChange={(e) => setNewImageIsPublic(e.target.checked)} disabled={busy} />
                      <span>is_public</span>
                    </label>
                    <label style={ui.checkRow}>
                      <input type="checkbox" checked={newImageCommonUse} onChange={(e) => setNewImageCommonUse(e.target.checked)} disabled={busy} />
                      <span>is_common_use</span>
                    </label>
                    <button onClick={createImage} style={ui.primaryBtn} disabled={busy}>
                      {busy ? "Working…" : "Create"}
                    </button>
                  </div>
                  <div style={ui.miniNote}>
                    Inserts into <code style={ui.code}>images</code> with{" "}
                    <code style={ui.code}>profile_id = {myProfileId ? myProfileId.slice(0, 8) + "…" : "null"}</code>.
                  </div>
                </div>

                {/* READ + UPDATE + DELETE */}
                <Table>
                  <thead>
                    <tr>
                      <Th>Preview</Th>
                      <Th>URL</Th>
                      <Th>Public</Th>
                      <Th>Common</Th>
                      <Th>Created</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.length ? (
                      images.map((img) => {
                        const isEditing = editingId === img.id;
                        return (
                          <tr key={img.id}>
                            <Td>
                              <div style={ui.thumb}>
                                {img.url ? <img src={img.url} alt="" style={ui.thumbImg} /> : <span style={{ opacity: 0.6 }}>—</span>}
                              </div>
                              <div style={{ marginTop: 6, opacity: 0.6 }}>
                                <code style={ui.code}>{img.id.slice(0, 10)}…</code>
                              </div>
                            </Td>

                            <Td>
                              {isEditing ? (
                                <input value={editingUrl} onChange={(e) => setEditingUrl(e.target.value)} style={ui.input} disabled={busy} />
                              ) : (
                                <div style={{ maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {img.url ?? <span style={{ opacity: 0.6 }}>—</span>}
                                </div>
                              )}
                            </Td>

                            <Td>
                              {isEditing ? (
                                <label style={ui.checkRow}>
                                  <input type="checkbox" checked={editingIsPublic} onChange={(e) => setEditingIsPublic(e.target.checked)} disabled={busy} />
                                  <span>is_public</span>
                                </label>
                              ) : img.is_public ? (
                                "Yes"
                              ) : (
                                "No"
                              )}
                            </Td>

                            <Td>
                              {isEditing ? (
                                <label style={ui.checkRow}>
                                  <input type="checkbox" checked={editingCommonUse} onChange={(e) => setEditingCommonUse(e.target.checked)} disabled={busy} />
                                  <span>is_common_use</span>
                                </label>
                              ) : img.is_common_use ? (
                                "Yes"
                              ) : (
                                "No"
                              )}
                            </Td>

                            <Td>{img.created_datetime_utc ? new Date(img.created_datetime_utc).toLocaleString() : <span style={{ opacity: 0.6 }}>—</span>}</Td>

                            <Td>
                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                {isEditing ? (
                                  <>
                                    <button onClick={saveEdit} style={ui.primaryBtn} disabled={busy}>
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingId(null);
                                        setEditingUrl("");
                                      }}
                                      style={ui.secondaryBtn}
                                      disabled={busy}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEdit(img)} style={ui.secondaryBtn} disabled={busy}>
                                      Edit
                                    </button>
                                    <button onClick={() => deleteImage(img.id)} style={ui.dangerBtn} disabled={busy}>
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </Td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <Td colSpan={6}>
                          <EmptyState title="No rows visible" body="RLS may limit the images you can read. Try creating one to confirm CREATE works." />
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </section>
            ) : null}
          </>
        )}

        <footer style={ui.footer}>
          <div style={{ opacity: 0.6 }}>© Admin · internal use</div>
        </footer>
      </div>
    </main>
  );
}

/** ===== UI components ===== */

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...(ui.tabBtn as CSSProperties),
        ...(active ? (ui.tabBtnActive as CSSProperties) : {}),
      }}
    >
      {children}
    </button>
  );
}

function Pager({
  page,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
}: {
  page: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={onPrev} style={ui.secondaryBtn} disabled={!canPrev}>
        ←
      </button>
      <div style={{ opacity: 0.75, fontWeight: 900 }}>Page {page + 1}</div>
      <button onClick={onNext} style={ui.secondaryBtn} disabled={!canNext}>
        →
      </button>
    </div>
  );
}

function PillSmall({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid rgba(255,255,255,${on ? 0.22 : 0.12})`,
        background: `rgba(255,255,255,${on ? 0.12 : 0.06})`,
        fontWeight: 900,
        fontSize: 12,
        opacity: on ? 0.95 : 0.65,
      }}
    >
      {label}
    </span>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <table style={ui.table}>{children}</table>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th style={ui.th}>{children}</th>;
}
function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td style={ui.td} colSpan={colSpan}>
      {children}
    </td>
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
              <div style={{ ...(ui.sparkFill as CSSProperties), height: `${Math.max(4, h)}%` }} />
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

/** ===== Styles ===== */

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

const ui: Record<string, CSSProperties> = {
  shell: { minHeight: "100vh", position: "relative", overflow: "hidden", fontFamily, color: "white", background: "#06070a" },
  wrap: { position: "relative", zIndex: 2, maxWidth: 1180, margin: "0 auto", padding: "28px 22px 36px" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },

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

  h1: { fontSize: 62, lineHeight: 0.95, letterSpacing: -2, margin: "14px 0 10px", fontWeight: 1000 },
  subline: { opacity: 0.8, fontSize: 15 },

  tabs: { marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" },
  tabBtn: {
    height: 36,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    opacity: 0.75,
  },
  tabBtnActive: {
    opacity: 1,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.22)",
  },

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
  },

  primaryBtn: {
    height: 40,
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.14)",
    color: "white",
    cursor: "pointer",
  },
  secondaryBtn: {
    height: 40,
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    opacity: 0.95,
  },
  dangerBtn: {
    height: 40,
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 950,
    border: "1px solid rgba(255,120,120,0.35)",
    background: "rgba(255,120,120,0.16)",
    color: "white",
    cursor: "pointer",
  },

  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginTop: 18 },
  kpiCard: {
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },
  kpiTitle: { opacity: 0.75, fontWeight: 900, fontSize: 14 },
  kpiValue: { fontSize: 40, fontWeight: 1000, marginTop: 8, letterSpacing: -1 },
  kpiSub: { opacity: 0.7, marginTop: 4 },

  twoCol: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, marginTop: 14 },

  card: {
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    marginTop: 14,
  },
  cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  cardTitle: { fontWeight: 950, fontSize: 16 },
  cardSub: { opacity: 0.7, fontSize: 12, marginTop: 4 },

  metrics: { paddingTop: 6 },
  metricRow: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  miniNote: { marginTop: 10, opacity: 0.62, fontSize: 12, lineHeight: 1.45 },

  sparkWrap: { display: "flex", gap: 10, alignItems: "flex-end", height: 150, padding: "6px 4px" },
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
  sparkFill: { width: "100%", borderRadius: 14, background: "rgba(255,255,255,0.20)" },
  sparkLabel: { marginTop: 8, fontSize: 11, opacity: 0.6, textAlign: "center" },

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
  rowTitle: { fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowRight: { textAlign: "right" },
  rowValue: { fontWeight: 1000, fontSize: 18, letterSpacing: -0.5 },
  rowSub: { opacity: 0.6, fontSize: 12 },

  imageGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 },
  imageTile: { borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" },
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

  empty: { marginTop: 12, padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" },
  emptyTitle: { fontWeight: 950 },
  emptyBody: { marginTop: 6, opacity: 0.7, fontSize: 13, lineHeight: 1.45 },

  loadingCard: { marginTop: 18, borderRadius: 20, padding: 18, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", boxShadow: "0 16px 60px rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" },
  loadingTitle: { fontWeight: 950, fontSize: 16 },
  loadingSub: { marginTop: 6, opacity: 0.7 },

  errorCard: { marginTop: 18, borderRadius: 20, padding: 18, border: "1px solid rgba(255,120,120,0.28)", background: "rgba(255,120,120,0.10)" },

  filters: { marginTop: 14, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 },
  input: {
    height: 40,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
  },

  createBox: { marginTop: 14, padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" },
  createRow: { display: "grid", gridTemplateColumns: "2fr auto auto auto", gap: 10, alignItems: "center" },
  checkRow: { display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.85, fontWeight: 850 },

  table: { width: "100%", marginTop: 14, borderCollapse: "separate", borderSpacing: 0 },
  th: { textAlign: "left", padding: "10px 10px", opacity: 0.7, fontWeight: 900, fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.10)" },
  td: { padding: "12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", verticalAlign: "top" },

  thumb: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },

  footer: { marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" },

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