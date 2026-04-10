"use client";

import type { CSSProperties, ReactNode } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const IMAGE_BUCKET = "images";
const PAGE_SIZE = 25;

type Counts = {
  users: number;
  images: number;
  captions: number;
  ratings: number;
};

type RatingPoint = {
  day: string;
  count: number;
};

type RatedCaption = {
  caption_id: string;
  content: string;
  image_id: string | null;
  likes: number;
  dislikes: number;
  score: number;
  totalVotes: number;
};

type TabKey =
  | "dashboard"
  | "users"
  | "images"
  | "humorFlavors"
  | "humorFlavorSteps"
  | "humorFlavorMix"
  | "terms"
  | "captions"
  | "captionRequests"
  | "captionExamples"
  | "llmModels"
  | "llmProviders"
  | "llmPromptChains"
  | "llmResponses"
  | "allowedSignupDomains"
  | "whitelistEmails";

type GenericRow = Record<string, any>;

const TAB_META: Record<
  TabKey,
  {
    label: string;
    table?: string;
    mode: "dashboard" | "read" | "update" | "crud";
  }
> = {
  dashboard: { label: "Dashboard", mode: "dashboard" },
  users: { label: "Users", table: "profiles", mode: "read" },
  images: { label: "Images", table: "images", mode: "crud" },
  humorFlavors: { label: "Humor Flavors", table: "humor_flavors", mode: "read" },
  humorFlavorSteps: { label: "Humor Flavor Steps", table: "humor_flavor_steps", mode: "read" },
  humorFlavorMix: { label: "Humor Mix", table: "humor_flavor_mix", mode: "update" },
  terms: { label: "Terms", table: "terms", mode: "crud" },
  captions: { label: "Captions", table: "captions", mode: "read" },
  captionRequests: { label: "Caption Requests", table: "caption_requests", mode: "read" },
  captionExamples: { label: "Caption Examples", table: "caption_examples", mode: "crud" },
  llmModels: { label: "LLM Models", table: "llm_models", mode: "crud" },
  llmProviders: { label: "LLM Providers", table: "llm_providers", mode: "crud" },
  llmPromptChains: { label: "LLM Prompt Chains", table: "llm_prompt_chains", mode: "read" },
  llmResponses: { label: "LLM Responses", table: "llm_model_responses", mode: "read" },
  allowedSignupDomains: {
    label: "Allowed Signup Domains",
    table: "allowed_signup_domains",
    mode: "crud",
  },
  whitelistEmails: {
    label: "Whitelist Emails",
    table: "whitelist_email_addresses",
    mode: "crud",
  },
};

type ImageForm = {
  url: string;
  is_public: boolean;
  is_common_use: boolean;
  additional_context: string;
  image_description: string;
};

type HumorMixForm = {
  caption_count: string;
};

type TermForm = {
  term: string;
  definition: string;
  example: string;
  priority: string;
  term_type_id: string;
};

type CaptionExampleForm = {
  image_description: string;
  caption: string;
  explanation: string;
  priority: string;
  image_id: string;
};

type LlmModelForm = {
  name: string;
  llm_provider_id: string;
  provider_model_id: string;
  is_temperature_supported: boolean;
};

type LlmProviderForm = {
  name: string;
};

type AllowedDomainForm = {
  apex_domain: string;
};

type WhitelistEmailForm = {
  email_address: string;
};

export default function AdminPage() {
  const supabase = getSupabaseBrowserClient();

  const [tab, setTab] = useState<TabKey>("dashboard");

  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [myProfileId, setMyProfileId] = useState("");

  const [counts, setCounts] = useState<Counts>({ users: 0, images: 0, captions: 0, ratings: 0 });

  const [rows, setRows] = useState<GenericRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [recentCaptionPoints, setRecentCaptionPoints] = useState<RatingPoint[]>([]);
  const [recentRatingPoints, setRecentRatingPoints] = useState<RatingPoint[]>([]);
  const [topCaptioners, setTopCaptioners] = useState<{ label: string; count: number }[]>([]);
  const [topImages, setTopImages] = useState<{ image_id: string; url?: string; count: number }[]>([]);
  const [topRatedCaptions, setTopRatedCaptions] = useState<RatedCaption[]>([]);
  const [mostRatedCaptions, setMostRatedCaptions] = useState<RatedCaption[]>([]);
  const [ratingSummary, setRatingSummary] = useState({
    totalLikes: 0,
    totalDislikes: 0,
    avgVotesPerCaption: 0,
    ratedCaptionCount: 0,
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const [imageCreate, setImageCreate] = useState<ImageForm>(blankImageForm());
  const [imageEdit, setImageEdit] = useState<ImageForm>(blankImageForm());
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [humorMixEdit, setHumorMixEdit] = useState<HumorMixForm>({ caption_count: "" });

  const [termCreate, setTermCreate] = useState<TermForm>(blankTermForm());
  const [termEdit, setTermEdit] = useState<TermForm>(blankTermForm());

  const [captionExampleCreate, setCaptionExampleCreate] = useState<CaptionExampleForm>(blankCaptionExampleForm());
  const [captionExampleEdit, setCaptionExampleEdit] = useState<CaptionExampleForm>(blankCaptionExampleForm());

  const [llmModelCreate, setLlmModelCreate] = useState<LlmModelForm>(blankLlmModelForm());
  const [llmModelEdit, setLlmModelEdit] = useState<LlmModelForm>(blankLlmModelForm());

  const [llmProviderCreate, setLlmProviderCreate] = useState<LlmProviderForm>(blankLlmProviderForm());
  const [llmProviderEdit, setLlmProviderEdit] = useState<LlmProviderForm>(blankLlmProviderForm());

  const [allowedDomainCreate, setAllowedDomainCreate] = useState<AllowedDomainForm>(blankAllowedDomainForm());
  const [allowedDomainEdit, setAllowedDomainEdit] = useState<AllowedDomainForm>(blankAllowedDomainForm());

  const [whitelistCreate, setWhitelistCreate] = useState<WhitelistEmailForm>(blankWhitelistEmailForm());
  const [whitelistEdit, setWhitelistEdit] = useState<WhitelistEmailForm>(blankWhitelistEmailForm());

  const currentMeta = TAB_META[tab];
  const visibleColumns = useMemo(() => deriveColumns(rows, tab), [rows, tab]);

  function auditUserIdOrThrow() {
    if (!myProfileId) throw new Error("Missing audit user id (myProfileId).");
    return myProfileId;
  }

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(0);
    setEditingId(null);
    setError("");
  }, [tab]);

  useEffect(() => {
    if (loadingApp) return;

    if (tab === "dashboard") {
      void loadDashboard();
      return;
    }

    void loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, loadingApp]);

  async function boot() {
    setLoadingApp(true);
    setError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      setError(sessionError.message);
      setLoadingApp(false);
      return;
    }

    const session = sessionData.session;
    setEmail(session?.user.email ?? "");
    setMyProfileId(session?.user.id ?? "");

    await refreshCountsOnly();
    setLoadingApp(false);
  }

  async function refreshCountsOnly() {
    const [u, i, c, v] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("images").select("*", { count: "exact", head: true }),
      supabase.from("captions").select("*", { count: "exact", head: true }),
      supabase.from("caption_votes").select("*", { count: "exact", head: true }),
    ]);

    setCounts({
      users: u.count ?? 0,
      images: i.count ?? 0,
      captions: c.count ?? 0,
      ratings: v.count ?? 0,
    });
  }

  async function loadDashboard() {
    setError("");

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [capsResult, votesResult] = await Promise.all([
      supabase
        .from("captions")
        .select("id,profile_id,image_id,content,created_datetime_utc")
        .gte("created_datetime_utc", since)
        .order("created_datetime_utc", { ascending: true })
        .limit(5000),
      supabase
        .from("caption_votes")
        .select("caption_id,vote_value,created_datetime_utc")
        .order("created_datetime_utc", { ascending: true })
        .limit(10000),
    ]);

    if (capsResult.error) {
      setError(capsResult.error.message);
      return;
    }

    if (votesResult.error) {
      setError(votesResult.error.message);
      return;
    }

    const captionRows = (capsResult.data ?? []) as Array<{
      id: string;
      profile_id: string | null;
      image_id: string | null;
      content: string | null;
      created_datetime_utc: string | null;
    }>;

    const voteRows = (votesResult.data ?? []) as Array<{
      caption_id: string | null;
      vote_value: number | null;
      created_datetime_utc: string | null;
    }>;

    const byDay = new Map<string, number>();
    for (const row of captionRows) {
      if (!row.created_datetime_utc) continue;
      const d = new Date(row.created_datetime_utc).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }

    const points: RatingPoint[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(Date.now() - d * 24 * 3600 * 1000).toISOString().slice(0, 10);
      points.push({ day: date, count: byDay.get(date) ?? 0 });
    }
    setRecentCaptionPoints(points);

    const ratingByDay = new Map<string, number>();
    for (const row of voteRows) {
      if (!row.created_datetime_utc) continue;
      const created = new Date(row.created_datetime_utc);
      if (created < new Date(since)) continue;
      const d = created.toISOString().slice(0, 10);
      ratingByDay.set(d, (ratingByDay.get(d) ?? 0) + 1);
    }

    const ratingPoints: RatingPoint[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(Date.now() - d * 24 * 3600 * 1000).toISOString().slice(0, 10);
      ratingPoints.push({ day: date, count: ratingByDay.get(date) ?? 0 });
    }
    setRecentRatingPoints(ratingPoints);

    const userCountMap = new Map<string, number>();
    const imageCountMap = new Map<string, number>();

    for (const row of captionRows) {
      if (row.profile_id) userCountMap.set(row.profile_id, (userCountMap.get(row.profile_id) ?? 0) + 1);
      if (row.image_id) imageCountMap.set(row.image_id, (imageCountMap.get(row.image_id) ?? 0) + 1);
    }

    const topUserPairs = [...userCountMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topImagePairs = [...imageCountMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    if (topUserPairs.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,email")
        .in(
          "id",
          topUserPairs.map(([id]) => id)
        );

      const emailMap = new Map((profiles ?? []).map((p: any) => [String(p.id), p.email]));
      setTopCaptioners(
        topUserPairs.map(([id, count]) => ({
          label: emailMap.get(id) ?? id.slice(0, 8),
          count,
        }))
      );
    } else {
      setTopCaptioners([]);
    }

    if (topImagePairs.length) {
      const { data: imgs } = await supabase
        .from("images")
        .select("id,url")
        .in(
          "id",
          topImagePairs.map(([id]) => id)
        );

      const urlMap = new Map((imgs ?? []).map((img: any) => [String(img.id), img.url]));
      setTopImages(
        topImagePairs.map(([image_id, count]) => ({
          image_id,
          count,
          url: urlMap.get(image_id),
        }))
      );
    } else {
      setTopImages([]);
    }

    const captionMeta = new Map(
      captionRows.map((row) => [
        row.id,
        {
          content: row.content ?? "",
          image_id: row.image_id ?? null,
        },
      ])
    );

    const votedCaptionIds = [...new Set(voteRows.map((v) => v.caption_id).filter(Boolean))] as string[];
    const missingCaptionIds = votedCaptionIds.filter((id) => !captionMeta.has(id));

    if (missingCaptionIds.length) {
      const { data: extraCaptions } = await supabase
        .from("captions")
        .select("id,content,image_id")
        .in("id", missingCaptionIds.slice(0, 5000));

      for (const row of extraCaptions ?? []) {
        captionMeta.set(String(row.id), {
          content: row.content ?? "",
          image_id: row.image_id ?? null,
        });
      }
    }

    const ratingMap = new Map<string, RatedCaption>();
    let totalLikes = 0;
    let totalDislikes = 0;

    for (const vote of voteRows) {
      if (!vote.caption_id || vote.vote_value == null) continue;

      const meta = captionMeta.get(vote.caption_id) ?? { content: "", image_id: null };
      const existing = ratingMap.get(vote.caption_id) ?? {
        caption_id: vote.caption_id,
        content: meta.content,
        image_id: meta.image_id,
        likes: 0,
        dislikes: 0,
        score: 0,
        totalVotes: 0,
      };

      existing.totalVotes += 1;

      if (vote.vote_value > 0) {
        existing.likes += 1;
        existing.score += 1;
        totalLikes += 1;
      } else if (vote.vote_value < 0) {
        existing.dislikes += 1;
        existing.score -= 1;
        totalDislikes += 1;
      }

      ratingMap.set(vote.caption_id, existing);
    }

    const ratedRows = [...ratingMap.values()];

    setRatingSummary({
      totalLikes,
      totalDislikes,
      avgVotesPerCaption: ratedRows.length > 0 ? Number((voteRows.length / ratedRows.length).toFixed(2)) : 0,
      ratedCaptionCount: ratedRows.length,
    });

    setTopRatedCaptions(
      ratedRows
        .filter((row) => row.totalVotes >= 2)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.totalVotes - a.totalVotes;
        })
        .slice(0, 8)
    );

    setMostRatedCaptions(
      ratedRows
        .sort((a, b) => {
          if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
          return b.score - a.score;
        })
        .slice(0, 8)
    );
  }

  async function loadTable() {
    if (!currentMeta.table) return;

    setLoadingRows(true);
    setError("");

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE;

      let query = supabase.from(currentMeta.table).select("*");

      if (hasColumnForOrdering(currentMeta.table)) {
        query = query.order("created_datetime_utc", { ascending: false });
      }

      const { data, error } = await query.range(from, to);

      if (error) throw error;

      const fetched = (data ?? []) as GenericRow[];
      setHasMore(fetched.length > PAGE_SIZE);
      setRows(fetched.slice(0, PAGE_SIZE));
    } catch (e: any) {
      setRows([]);
      setHasMore(false);
      setError(e?.message ?? `Failed to load ${currentMeta.table}`);
    } finally {
      setLoadingRows(false);
    }
  }

  function startEdit(row: GenericRow) {
    setEditingId(String(row.id));

    if (tab === "images") {
      setImageEdit({
        url: row.url ?? "",
        is_public: !!row.is_public,
        is_common_use: !!row.is_common_use,
        additional_context: row.additional_context ?? "",
        image_description: row.image_description ?? "",
      });
      return;
    }

    if (tab === "humorFlavorMix") {
      setHumorMixEdit({
        caption_count: row.caption_count == null ? "" : String(row.caption_count),
      });
      return;
    }

    if (tab === "terms") {
      setTermEdit({
        term: row.term ?? "",
        definition: row.definition ?? "",
        example: row.example ?? "",
        priority: row.priority == null ? "" : String(row.priority),
        term_type_id: row.term_type_id == null ? "" : String(row.term_type_id),
      });
      return;
    }

    if (tab === "captionExamples") {
      setCaptionExampleEdit({
        image_description: row.image_description ?? "",
        caption: row.caption ?? "",
        explanation: row.explanation ?? "",
        priority: row.priority == null ? "" : String(row.priority),
        image_id: row.image_id ?? "",
      });
      return;
    }

    if (tab === "llmModels") {
      setLlmModelEdit({
        name: row.name ?? "",
        llm_provider_id: row.llm_provider_id == null ? "" : String(row.llm_provider_id),
        provider_model_id: row.provider_model_id ?? "",
        is_temperature_supported: !!row.is_temperature_supported,
      });
      return;
    }

    if (tab === "llmProviders") {
      setLlmProviderEdit({ name: row.name ?? "" });
      return;
    }

    if (tab === "allowedSignupDomains") {
      setAllowedDomainEdit({ apex_domain: row.apex_domain ?? "" });
      return;
    }

    if (tab === "whitelistEmails") {
      setWhitelistEdit({ email_address: row.email_address ?? "" });
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setImageEdit(blankImageForm());
    setHumorMixEdit({ caption_count: "" });
    setTermEdit(blankTermForm());
    setCaptionExampleEdit(blankCaptionExampleForm());
    setLlmModelEdit(blankLlmModelForm());
    setLlmProviderEdit(blankLlmProviderForm());
    setAllowedDomainEdit(blankAllowedDomainForm());
    setWhitelistEdit(blankWhitelistEmailForm());
  }

  async function createImageRowFromUrl() {
    setBusy(true);
    setError("");

    try {
      if (!imageCreate.url.trim()) throw new Error("Image URL is required.");

      const payload = {
        url: imageCreate.url.trim(),
        is_public: imageCreate.is_public,
        is_common_use: imageCreate.is_common_use,
        additional_context: nullIfBlank(imageCreate.additional_context),
        image_description: nullIfBlank(imageCreate.image_description),
        profile_id: auditUserIdOrThrow(),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      const { error } = await supabase.from("images").insert(payload);
      if (error) throw error;

      setImageCreate(blankImageForm());
      await refreshCountsOnly();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create image row.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndCreateImageRow() {
    setBusy(true);
    setError("");

    try {
      if (!uploadFile) throw new Error("Choose an image file first.");

      const ext = getFileExtension(uploadFile.name);
      const filePath = `${myProfileId || "anonymous"}/${Date.now()}-${slugifyBaseName(uploadFile.name)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(filePath, uploadFile, {
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);

      const payload = {
        url: publicData.publicUrl,
        is_public: imageCreate.is_public,
        is_common_use: imageCreate.is_common_use,
        additional_context: nullIfBlank(imageCreate.additional_context),
        image_description: nullIfBlank(imageCreate.image_description),
        profile_id: auditUserIdOrThrow(),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      const { error: insertError } = await supabase.from("images").insert(payload);
      if (insertError) throw insertError;

      setUploadFile(null);
      setImageCreate(blankImageForm());

      const fileInput = document.getElementById("image-upload-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      await refreshCountsOnly();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload image.");
    } finally {
      setBusy(false);
    }
  }

  async function saveImageEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      const payload = {
        url: imageEdit.url.trim(),
        is_public: imageEdit.is_public,
        is_common_use: imageEdit.is_common_use,
        additional_context: nullIfBlank(imageEdit.additional_context),
        image_description: nullIfBlank(imageEdit.image_description),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      if (!payload.url) throw new Error("URL is required.");

      const { error } = await supabase.from("images").update(payload).eq("id", editingId);
      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update image.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteImageRow(id: string) {
    const ok = confirm("Delete this image row?");
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.from("images").delete().eq("id", id);
      if (error) throw error;

      await refreshCountsOnly();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete image.");
    } finally {
      setBusy(false);
    }
  }

  async function saveHumorMixEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      const count = parseOptionalInt(humorMixEdit.caption_count);
      if (count == null) throw new Error("caption_count is required.");

      const { error } = await supabase
        .from("humor_flavor_mix")
        .update({
          caption_count: count,
          created_by_user_id: auditUserIdOrThrow(),
          modified_by_user_id: auditUserIdOrThrow(),
        })
        .eq("id", Number(editingId));
      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update humor mix.");
    } finally {
      setBusy(false);
    }
  }

  async function createTerm() {
    setBusy(true);
    setError("");

    try {
      if (!termCreate.term.trim()) throw new Error("term is required.");

      const payload = {
        term: termCreate.term.trim(),
        definition: nullIfBlank(termCreate.definition),
        example: nullIfBlank(termCreate.example),
        priority: parseOptionalInt(termCreate.priority),
        term_type_id: parseOptionalInt(termCreate.term_type_id),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      const { error } = await supabase.from("terms").insert(payload);
      if (error) throw error;

      setTermCreate(blankTermForm());
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create term.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTermEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      const payload = {
        term: termEdit.term.trim(),
        definition: nullIfBlank(termEdit.definition),
        example: nullIfBlank(termEdit.example),
        priority: parseOptionalInt(termEdit.priority),
        term_type_id: parseOptionalInt(termEdit.term_type_id),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      if (!payload.term) throw new Error("term is required.");

      const { error } = await supabase.from("terms").update(payload).eq("id", Number(editingId));
      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update term.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTerm(id: string) {
    const ok = confirm("Delete this term?");
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.from("terms").delete().eq("id", Number(id));
      if (error) throw error;

      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete term.");
    } finally {
      setBusy(false);
    }
  }

  async function createCaptionExample() {
    setBusy(true);
    setError("");

    try {
      const payload = {
        image_description: nullIfBlank(captionExampleCreate.image_description),
        caption: nullIfBlank(captionExampleCreate.caption),
        explanation: nullIfBlank(captionExampleCreate.explanation),
        priority: parseOptionalInt(captionExampleCreate.priority),
        image_id: nullIfBlank(captionExampleCreate.image_id),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      const { error } = await supabase.from("caption_examples").insert(payload);
      if (error) throw error;

      setCaptionExampleCreate(blankCaptionExampleForm());
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create caption example.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCaptionExampleEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      const payload = {
        image_description: nullIfBlank(captionExampleEdit.image_description),
        caption: nullIfBlank(captionExampleEdit.caption),
        explanation: nullIfBlank(captionExampleEdit.explanation),
        priority: parseOptionalInt(captionExampleEdit.priority),
        image_id: nullIfBlank(captionExampleEdit.image_id),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      const { error } = await supabase.from("caption_examples").update(payload).eq("id", Number(editingId));
      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update caption example.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCaptionExample(id: string) {
    const ok = confirm("Delete this caption example?");
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.from("caption_examples").delete().eq("id", Number(id));
      if (error) throw error;

      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete caption example.");
    } finally {
      setBusy(false);
    }
  }

  async function createLlmModel() {
    setBusy(true);
    setError("");

    try {
      if (!llmModelCreate.name.trim()) throw new Error("name is required.");

      const providerId = parseOptionalInt(llmModelCreate.llm_provider_id);
      if (providerId == null) throw new Error("llm_provider_id is required.");

      const payload = {
        name: llmModelCreate.name.trim(),
        llm_provider_id: providerId,
        provider_model_id: nullIfBlank(llmModelCreate.provider_model_id),
        is_temperature_supported: llmModelCreate.is_temperature_supported,
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      const { error } = await supabase.from("llm_models").insert(payload);
      if (error) throw error;

      setLlmModelCreate(blankLlmModelForm());
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create LLM model.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLlmModelEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      const providerId = parseOptionalInt(llmModelEdit.llm_provider_id);
      if (providerId == null) throw new Error("llm_provider_id is required.");
      if (!llmModelEdit.name.trim()) throw new Error("name is required.");

      const payload = {
        name: llmModelEdit.name.trim(),
        llm_provider_id: providerId,
        provider_model_id: nullIfBlank(llmModelEdit.provider_model_id),
        is_temperature_supported: llmModelEdit.is_temperature_supported,
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      };

      const { error } = await supabase.from("llm_models").update(payload).eq("id", Number(editingId));
      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update LLM model.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLlmModel(id: string) {
    const ok = confirm("Delete this LLM model?");
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.from("llm_models").delete().eq("id", Number(id));
      if (error) throw error;

      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete LLM model.");
    } finally {
      setBusy(false);
    }
  }

  async function createLlmProvider() {
    setBusy(true);
    setError("");

    try {
      if (!llmProviderCreate.name.trim()) throw new Error("name is required.");

      const { error } = await supabase.from("llm_providers").insert({
        name: llmProviderCreate.name.trim(),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      });

      if (error) throw error;

      setLlmProviderCreate(blankLlmProviderForm());
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create LLM provider.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLlmProviderEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      if (!llmProviderEdit.name.trim()) throw new Error("name is required.");

      const { error } = await supabase
        .from("llm_providers")
        .update({
          name: llmProviderEdit.name.trim(),
          created_by_user_id: auditUserIdOrThrow(),
          modified_by_user_id: auditUserIdOrThrow(),
        })
        .eq("id", Number(editingId));

      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update LLM provider.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLlmProvider(id: string) {
    const ok = confirm("Delete this LLM provider?");
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.from("llm_providers").delete().eq("id", Number(id));
      if (error) throw error;

      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete LLM provider.");
    } finally {
      setBusy(false);
    }
  }

  async function createAllowedDomain() {
    setBusy(true);
    setError("");

    try {
      if (!allowedDomainCreate.apex_domain.trim()) throw new Error("apex_domain is required.");

      const { error } = await supabase.from("allowed_signup_domains").insert({
        apex_domain: allowedDomainCreate.apex_domain.trim(),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      });

      if (error) throw error;

      setAllowedDomainCreate(blankAllowedDomainForm());
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create allowed domain.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAllowedDomainEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      if (!allowedDomainEdit.apex_domain.trim()) throw new Error("apex_domain is required.");

      const { error } = await supabase
        .from("allowed_signup_domains")
        .update({
          apex_domain: allowedDomainEdit.apex_domain.trim(),
          created_by_user_id: auditUserIdOrThrow(),
          modified_by_user_id: auditUserIdOrThrow(),
        })
        .eq("id", Number(editingId));

      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update allowed domain.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAllowedDomain(id: string) {
    const ok = confirm("Delete this allowed signup domain?");
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.from("allowed_signup_domains").delete().eq("id", Number(id));
      if (error) throw error;

      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete allowed domain.");
    } finally {
      setBusy(false);
    }
  }

  async function createWhitelistEmail() {
    setBusy(true);
    setError("");

    try {
      if (!whitelistCreate.email_address.trim()) throw new Error("email_address is required.");

      const { error } = await supabase.from("whitelist_email_addresses").insert({
        email_address: whitelistCreate.email_address.trim(),
        created_by_user_id: auditUserIdOrThrow(),
        modified_by_user_id: auditUserIdOrThrow(),
      });

      if (error) throw error;

      setWhitelistCreate(blankWhitelistEmailForm());
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create whitelist email.");
    } finally {
      setBusy(false);
    }
  }

  async function saveWhitelistEmailEdit() {
    if (!editingId) return;

    setBusy(true);
    setError("");

    try {
      if (!whitelistEdit.email_address.trim()) throw new Error("email_address is required.");

      const { error } = await supabase
        .from("whitelist_email_addresses")
        .update({
          email_address: whitelistEdit.email_address.trim(),
          created_by_user_id: auditUserIdOrThrow(),
          modified_by_user_id: auditUserIdOrThrow(),
        })
        .eq("id", Number(editingId));

      if (error) throw error;

      cancelEdit();
      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update whitelist email.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteWhitelistEmail(id: string) {
    const ok = confirm("Delete this whitelist email?");
    if (!ok) return;

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.from("whitelist_email_addresses").delete().eq("id", Number(id));
      if (error) throw error;

      await loadTable();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete whitelist email.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  const maxChartY = Math.max(1, ...recentCaptionPoints.map((x) => x.count));
  const maxRatingChartY = Math.max(1, ...recentRatingPoints.map((x) => x.count));
  const isDashboard = tab === "dashboard";

  return (
    <main style={ui.shell}>
      <Background />

      <div style={ui.wrap}>
        <button
          type="button"
          aria-label={sidebarOpen ? "Hide table tabs" : "Show table tabs"}
          onClick={() => setSidebarOpen((v) => !v)}
          style={ui.sidebarToggleBtn}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                height: 3,
                width: 18,
                background: "rgba(255,255,255,0.92)",
                borderRadius: 2,
              }}
            />
            <span
              style={{
                height: 3,
                width: 18,
                background: "rgba(255,255,255,0.92)",
                borderRadius: 2,
              }}
            />
            <span
              style={{
                height: 3,
                width: 18,
                background: "rgba(255,255,255,0.92)",
                borderRadius: 2,
              }}
            />
          </span>
        </button>

        <header style={ui.header}>
          <div>
            <div style={ui.kickerRow}>
              <span style={ui.kicker}>ADMIN</span>
              <span style={ui.pill}>{isDashboard ? "Overview" : currentMeta.label}</span>
            </div>

            <h1 style={ui.h1}>{isDashboard ? "Admin Area" : currentMeta.label}</h1>
            <div style={ui.subline}>
              Signed in as <b style={{ opacity: 0.95 }}>{email || "unknown"}</b>
            </div>
          </div>

          <button onClick={signOut} style={ui.signout} disabled={busy}>
            Sign out →
          </button>
        </header>

        {error ? (
          <div style={ui.errorCard}>
            <div style={{ fontWeight: 950 }}>Error</div>
            <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.45 }}>{error}</div>
          </div>
        ) : null}

        {isDashboard ? (
          <section style={ui.kpiGrid}>
            <KpiCard title="Users" value={counts.users.toLocaleString()} subtitle="profiles rows" />
            <KpiCard title="Images" value={counts.images.toLocaleString()} subtitle="images rows" />
            <KpiCard title="Captions" value={counts.captions.toLocaleString()} subtitle="captions rows" />
            <KpiCard title="Ratings" value={counts.ratings.toLocaleString()} subtitle="caption_votes rows" />
            <KpiCard title="Likes" value={ratingSummary.totalLikes.toLocaleString()} subtitle="positive votes" />
            <KpiCard title="Dislikes" value={ratingSummary.totalDislikes.toLocaleString()} subtitle="negative votes" />
            <KpiCard title="Avg votes / rated caption" value={ratingSummary.avgVotesPerCaption.toFixed(2)} subtitle="engagement depth" />
            <KpiCard title="Rated captions" value={ratingSummary.ratedCaptionCount.toLocaleString()} subtitle="captions with votes" />
          </section>
        ) : (
          <div style={ui.contentTopSpacing} />
        )}

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            style={ui.sidebarBackdrop}
          />
        ) : null}

        <aside
          style={{
            ...ui.sidebar,
            transform: sidebarOpen ? "translateX(0)" : "translateX(calc(-100% - 20px))",
            opacity: sidebarOpen ? 1 : 0,
            pointerEvents: sidebarOpen ? "auto" : "none",
          }}
        >
          <nav style={ui.sidebarNav}>
            {(Object.keys(TAB_META) as TabKey[]).map((key) => (
              <SidebarTabButton
                key={key}
                expanded
                active={tab === key}
                icon={tabIconForKey(key)}
                label={TAB_META[key].label}
                onClick={() => {
                  setPage(0);
                  cancelEdit();
                  setTab(key);
                }}
              />
            ))}
          </nav>
        </aside>

        {loadingApp ? (
          <div style={ui.loadingCard}>
            <div style={ui.loadingTitle}>Loading…</div>
            <div style={ui.loadingSub}>Fetching session and counts.</div>
          </div>
        ) : null}

        {!loadingApp && isDashboard ? (
          <>
            <section style={ui.twoCol}>
              <div style={{ ...ui.card, display: "flex", flexDirection: "column" }}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Caption velocity</div>
                    <div style={ui.cardSub}>Last 7 days</div>
                  </div>
                  <span style={ui.pill}>Trend</span>
                </div>

                <div style={{ marginTop: 12, flex: 1, display: "flex" }}>
                  <SparkBars points={recentCaptionPoints} maxY={maxChartY} unitLabel="captions" />
                </div>
              </div>

              <div style={{ ...ui.card, display: "flex", flexDirection: "column" }}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Rating velocity</div>
                    <div style={ui.cardSub}>Last 7 days</div>
                  </div>
                  <span style={ui.pill}>Votes</span>
                </div>

                <div style={{ marginTop: 12, flex: 1, display: "flex" }}>
                  <SparkBars points={recentRatingPoints} maxY={maxRatingChartY} unitLabel="votes" />
                </div>
              </div>
            </section>

            <section style={ui.twoCol}>
              <div style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Top captioners</div>
                    <div style={ui.cardSub}>Last 7 days</div>
                  </div>
                  <span style={ui.pill}>Leaders</span>
                </div>

                {topCaptioners.length ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {topCaptioners.map((u, idx) => (
                      <div key={u.label + idx} style={ui.row}>
                        <div style={ui.rank}>{idx + 1}</div>
                        <div style={ui.rowTitle}>{u.label}</div>
                        <div style={ui.rowRight}>
                          <div style={ui.rowValue}>{u.count}</div>
                          <div style={ui.rowSub}>captions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No recent activity" body="No captions in the last 7 days." />
                )}
              </div>

              <div style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Top rated captions</div>
                    <div style={ui.cardSub}>Best net score from user voting</div>
                  </div>
                  <span style={ui.pill}>Quality</span>
                </div>

                {topRatedCaptions.length ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {topRatedCaptions.map((row, idx) => (
                      <RatedCaptionRow
                        key={row.caption_id + idx}
                        row={row}
                        rank={idx + 1}
                        badge={`${row.score >= 0 ? "+" : ""}${row.score} score`}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No rating activity" body="Top rated captions will appear after users start voting." />
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
                      <div key={img.image_id} style={ui.imageTile}>
                        <div style={ui.imageFrame}>
                          {img.url ? <img src={img.url} alt="" style={ui.img} /> : <div style={ui.imagePlaceholder}>No URL</div>}
                        </div>
                        <div style={ui.imageMeta}>
                          <div style={ui.imageCount}>
                            <b>{img.count}</b> captions
                          </div>
                          <div style={ui.imageId}>
                            <code style={ui.code}>{img.image_id.slice(0, 10)}…</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No recent data" body="Once users create captions, this section will populate." />
                )}
              </div>

              <div style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <div style={ui.cardTitle}>Most rated captions</div>
                    <div style={ui.cardSub}>Captions drawing the most feedback</div>
                  </div>
                  <span style={ui.pill}>Engagement</span>
                </div>

                {mostRatedCaptions.length ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {mostRatedCaptions.map((row, idx) => (
                      <RatedCaptionRow key={row.caption_id + idx} row={row} rank={idx + 1} badge={`${row.totalVotes} votes`} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No rating activity" body="Most rated captions will appear after users start voting." />
                )}
              </div>
            </section>
          </>
        ) : null}

        {!loadingApp && !isDashboard ? (
          <section style={ui.card}>
            <div style={ui.cardHeader}>
              <div>
                <div style={ui.cardTitle}>{currentMeta.label}</div>
                <div style={ui.cardSub}>
                  Table: <code style={ui.code}>{currentMeta.table}</code> · Mode:{" "}
                  <code style={ui.code}>{currentMeta.mode}</code>
                </div>
              </div>

              <Pager
                page={page}
                onPrev={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                canPrev={page > 0}
                canNext={hasMore}
              />
            </div>

            {tab === "images" ? (
              <>
                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Create image row from URL</div>
                  <div style={ui.formGrid2}>
                    <Field label="URL">
                      <input
                        value={imageCreate.url}
                        onChange={(e) => setImageCreate((s) => ({ ...s, url: e.target.value }))}
                        style={ui.input}
                        placeholder="https://..."
                      />
                    </Field>

                    <Field label="Additional context">
                      <input
                        value={imageCreate.additional_context}
                        onChange={(e) => setImageCreate((s) => ({ ...s, additional_context: e.target.value }))}
                        style={ui.input}
                        placeholder="optional"
                      />
                    </Field>

                    <Field label="Image description">
                      <textarea
                        value={imageCreate.image_description}
                        onChange={(e) => setImageCreate((s) => ({ ...s, image_description: e.target.value }))}
                        style={ui.textareaSmall}
                        placeholder="optional"
                      />
                    </Field>

                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={ui.checkRow}>
                        <input
                          type="checkbox"
                          checked={imageCreate.is_public}
                          onChange={(e) => setImageCreate((s) => ({ ...s, is_public: e.target.checked }))}
                        />
                        <span>is_public</span>
                      </label>
                      <label style={ui.checkRow}>
                        <input
                          type="checkbox"
                          checked={imageCreate.is_common_use}
                          onChange={(e) => setImageCreate((s) => ({ ...s, is_common_use: e.target.checked }))}
                        />
                        <span>is_common_use</span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={createImageRowFromUrl} style={ui.primaryBtn} disabled={busy}>
                      Create image row
                    </button>
                  </div>
                </div>

                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Upload new image to Storage bucket "{IMAGE_BUCKET}"</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      id="image-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      onClick={uploadAndCreateImageRow}
                      style={{ ...ui.primaryBtn, marginLeft: "auto" }}
                      disabled={busy}
                    >
                      Upload + create row
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {tab === "humorFlavorMix" && editingId ? (
              <div style={ui.formSection}>
                <div style={ui.formTitle}>
                  Edit humor mix row <code style={ui.code}>{editingId}</code>
                </div>

                <div style={ui.formGrid1}>
                  <Field label="caption_count">
                    <input
                      value={humorMixEdit.caption_count}
                      onChange={(e) => setHumorMixEdit({ caption_count: e.target.value })}
                      style={ui.input}
                    />
                  </Field>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={saveHumorMixEdit} style={ui.primaryBtn} disabled={busy}>
                    Save humor mix
                  </button>
                  <button onClick={cancelEdit} style={ui.secondaryBtn} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {tab === "terms" ? (
              <>
                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Create term</div>
                  <div style={ui.formGrid2}>
                    <Field label="term">
                      <input
                        value={termCreate.term}
                        onChange={(e) => setTermCreate((s) => ({ ...s, term: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>

                    <Field label="priority">
                      <input
                        value={termCreate.priority}
                        onChange={(e) => setTermCreate((s) => ({ ...s, priority: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>

                    <Field label="definition">
                      <textarea
                        value={termCreate.definition}
                        onChange={(e) => setTermCreate((s) => ({ ...s, definition: e.target.value }))}
                        style={ui.textareaSmall}
                      />
                    </Field>

                    <Field label="example">
                      <textarea
                        value={termCreate.example}
                        onChange={(e) => setTermCreate((s) => ({ ...s, example: e.target.value }))}
                        style={ui.textareaSmall}
                      />
                    </Field>

                    <Field label="term_type_id">
                      <input
                        value={termCreate.term_type_id}
                        onChange={(e) => setTermCreate((s) => ({ ...s, term_type_id: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>
                  </div>

                  <button onClick={createTerm} style={ui.primaryBtn} disabled={busy}>
                    Create term
                  </button>
                </div>

                {editingId ? (
                  <div style={ui.formSection}>
                    <div style={ui.formTitle}>
                      Edit term <code style={ui.code}>{editingId}</code>
                    </div>

                    <div style={ui.formGrid2}>
                      <Field label="term">
                        <input
                          value={termEdit.term}
                          onChange={(e) => setTermEdit((s) => ({ ...s, term: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>

                      <Field label="priority">
                        <input
                          value={termEdit.priority}
                          onChange={(e) => setTermEdit((s) => ({ ...s, priority: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>

                      <Field label="definition">
                        <textarea
                          value={termEdit.definition}
                          onChange={(e) => setTermEdit((s) => ({ ...s, definition: e.target.value }))}
                          style={ui.textareaSmall}
                        />
                      </Field>

                      <Field label="example">
                        <textarea
                          value={termEdit.example}
                          onChange={(e) => setTermEdit((s) => ({ ...s, example: e.target.value }))}
                          style={ui.textareaSmall}
                        />
                      </Field>

                      <Field label="term_type_id">
                        <input
                          value={termEdit.term_type_id}
                          onChange={(e) => setTermEdit((s) => ({ ...s, term_type_id: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={saveTermEdit} style={ui.primaryBtn} disabled={busy}>
                        Save term
                      </button>
                      <button onClick={cancelEdit} style={ui.secondaryBtn} disabled={busy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "captionExamples" ? (
              <>
                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Create caption example</div>
                  <div style={ui.formGrid2}>
                    <Field label="image_description">
                      <textarea
                        value={captionExampleCreate.image_description}
                        onChange={(e) => setCaptionExampleCreate((s) => ({ ...s, image_description: e.target.value }))}
                        style={ui.textareaSmall}
                      />
                    </Field>

                    <Field label="caption">
                      <textarea
                        value={captionExampleCreate.caption}
                        onChange={(e) => setCaptionExampleCreate((s) => ({ ...s, caption: e.target.value }))}
                        style={ui.textareaSmall}
                      />
                    </Field>

                    <Field label="explanation">
                      <textarea
                        value={captionExampleCreate.explanation}
                        onChange={(e) => setCaptionExampleCreate((s) => ({ ...s, explanation: e.target.value }))}
                        style={ui.textareaSmall}
                      />
                    </Field>

                    <Field label="priority">
                      <input
                        value={captionExampleCreate.priority}
                        onChange={(e) => setCaptionExampleCreate((s) => ({ ...s, priority: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>

                    <Field label="image_id">
                      <input
                        value={captionExampleCreate.image_id}
                        onChange={(e) => setCaptionExampleCreate((s) => ({ ...s, image_id: e.target.value }))}
                        style={ui.input}
                        placeholder="uuid or blank"
                      />
                    </Field>
                  </div>

                  <button onClick={createCaptionExample} style={ui.primaryBtn} disabled={busy}>
                    Create caption example
                  </button>
                </div>

                {editingId ? (
                  <div style={ui.formSection}>
                    <div style={ui.formTitle}>
                      Edit caption example <code style={ui.code}>{editingId}</code>
                    </div>

                    <div style={ui.formGrid2}>
                      <Field label="image_description">
                        <textarea
                          value={captionExampleEdit.image_description}
                          onChange={(e) => setCaptionExampleEdit((s) => ({ ...s, image_description: e.target.value }))}
                          style={ui.textareaSmall}
                        />
                      </Field>

                      <Field label="caption">
                        <textarea
                          value={captionExampleEdit.caption}
                          onChange={(e) => setCaptionExampleEdit((s) => ({ ...s, caption: e.target.value }))}
                          style={ui.textareaSmall}
                        />
                      </Field>

                      <Field label="explanation">
                        <textarea
                          value={captionExampleEdit.explanation}
                          onChange={(e) => setCaptionExampleEdit((s) => ({ ...s, explanation: e.target.value }))}
                          style={ui.textareaSmall}
                        />
                      </Field>

                      <Field label="priority">
                        <input
                          value={captionExampleEdit.priority}
                          onChange={(e) => setCaptionExampleEdit((s) => ({ ...s, priority: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>

                      <Field label="image_id">
                        <input
                          value={captionExampleEdit.image_id}
                          onChange={(e) => setCaptionExampleEdit((s) => ({ ...s, image_id: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={saveCaptionExampleEdit} style={ui.primaryBtn} disabled={busy}>
                        Save caption example
                      </button>
                      <button onClick={cancelEdit} style={ui.secondaryBtn} disabled={busy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "llmModels" ? (
              <>
                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Create LLM model</div>
                  <div style={ui.formGrid2}>
                    <Field label="name">
                      <input
                        value={llmModelCreate.name}
                        onChange={(e) => setLlmModelCreate((s) => ({ ...s, name: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>

                    <Field label="llm_provider_id">
                      <input
                        value={llmModelCreate.llm_provider_id}
                        onChange={(e) => setLlmModelCreate((s) => ({ ...s, llm_provider_id: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>

                    <Field label="provider_model_id">
                      <input
                        value={llmModelCreate.provider_model_id}
                        onChange={(e) => setLlmModelCreate((s) => ({ ...s, provider_model_id: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>

                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={ui.checkRow}>
                        <input
                          type="checkbox"
                          checked={llmModelCreate.is_temperature_supported}
                          onChange={(e) =>
                            setLlmModelCreate((s) => ({
                              ...s,
                              is_temperature_supported: e.target.checked,
                            }))
                          }
                        />
                        <span>is_temperature_supported</span>
                      </label>
                    </div>
                  </div>

                  <button onClick={createLlmModel} style={ui.primaryBtn} disabled={busy}>
                    Create LLM model
                  </button>
                </div>

                {editingId ? (
                  <div style={ui.formSection}>
                    <div style={ui.formTitle}>
                      Edit LLM model <code style={ui.code}>{editingId}</code>
                    </div>

                    <div style={ui.formGrid2}>
                      <Field label="name">
                        <input
                          value={llmModelEdit.name}
                          onChange={(e) => setLlmModelEdit((s) => ({ ...s, name: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>

                      <Field label="llm_provider_id">
                        <input
                          value={llmModelEdit.llm_provider_id}
                          onChange={(e) => setLlmModelEdit((s) => ({ ...s, llm_provider_id: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>

                      <Field label="provider_model_id">
                        <input
                          value={llmModelEdit.provider_model_id}
                          onChange={(e) => setLlmModelEdit((s) => ({ ...s, provider_model_id: e.target.value }))}
                          style={ui.input}
                        />
                      </Field>

                      <div style={{ display: "grid", gap: 10 }}>
                        <label style={ui.checkRow}>
                          <input
                            type="checkbox"
                            checked={llmModelEdit.is_temperature_supported}
                            onChange={(e) =>
                              setLlmModelEdit((s) => ({
                                ...s,
                                is_temperature_supported: e.target.checked,
                              }))
                            }
                          />
                          <span>is_temperature_supported</span>
                        </label>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={saveLlmModelEdit} style={ui.primaryBtn} disabled={busy}>
                        Save LLM model
                      </button>
                      <button onClick={cancelEdit} style={ui.secondaryBtn} disabled={busy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "llmProviders" ? (
              <>
                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Create LLM provider</div>
                  <div style={ui.formGrid1}>
                    <Field label="name">
                      <input
                        value={llmProviderCreate.name}
                        onChange={(e) => setLlmProviderCreate({ name: e.target.value })}
                        style={ui.input}
                      />
                    </Field>
                  </div>

                  <button onClick={createLlmProvider} style={ui.primaryBtn} disabled={busy}>
                    Create LLM provider
                  </button>
                </div>

                {editingId ? (
                  <div style={ui.formSection}>
                    <div style={ui.formTitle}>
                      Edit LLM provider <code style={ui.code}>{editingId}</code>
                    </div>

                    <div style={ui.formGrid1}>
                      <Field label="name">
                        <input
                          value={llmProviderEdit.name}
                          onChange={(e) => setLlmProviderEdit({ name: e.target.value })}
                          style={ui.input}
                        />
                      </Field>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={saveLlmProviderEdit} style={ui.primaryBtn} disabled={busy}>
                        Save LLM provider
                      </button>
                      <button onClick={cancelEdit} style={ui.secondaryBtn} disabled={busy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "allowedSignupDomains" ? (
              <>
                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Create allowed signup domain</div>
                  <div style={ui.formGrid1}>
                    <Field label="apex_domain">
                      <input
                        value={allowedDomainCreate.apex_domain}
                        onChange={(e) => setAllowedDomainCreate({ apex_domain: e.target.value })}
                        style={ui.input}
                        placeholder="example.edu"
                      />
                    </Field>
                  </div>

                  <button onClick={createAllowedDomain} style={ui.primaryBtn} disabled={busy}>
                    Create domain
                  </button>
                </div>

                {editingId ? (
                  <div style={ui.formSection}>
                    <div style={ui.formTitle}>
                      Edit allowed domain <code style={ui.code}>{editingId}</code>
                    </div>

                    <div style={ui.formGrid1}>
                      <Field label="apex_domain">
                        <input
                          value={allowedDomainEdit.apex_domain}
                          onChange={(e) => setAllowedDomainEdit({ apex_domain: e.target.value })}
                          style={ui.input}
                        />
                      </Field>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={saveAllowedDomainEdit} style={ui.primaryBtn} disabled={busy}>
                        Save domain
                      </button>
                      <button onClick={cancelEdit} style={ui.secondaryBtn} disabled={busy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "whitelistEmails" ? (
              <>
                <div style={ui.formSection}>
                  <div style={ui.formTitle}>Create whitelist email</div>
                  <div style={ui.formGrid1}>
                    <Field label="email_address">
                      <input
                        value={whitelistCreate.email_address}
                        onChange={(e) => setWhitelistCreate({ email_address: e.target.value })}
                        style={ui.input}
                        placeholder="name@example.com"
                      />
                    </Field>
                  </div>

                  <button onClick={createWhitelistEmail} style={ui.primaryBtn} disabled={busy}>
                    Create whitelist email
                  </button>
                </div>

                {editingId ? (
                  <div style={ui.formSection}>
                    <div style={ui.formTitle}>
                      Edit whitelist email <code style={ui.code}>{editingId}</code>
                    </div>

                    <div style={ui.formGrid1}>
                      <Field label="email_address">
                        <input
                          value={whitelistEdit.email_address}
                          onChange={(e) => setWhitelistEdit({ email_address: e.target.value })}
                          style={ui.input}
                        />
                      </Field>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={saveWhitelistEmailEdit} style={ui.primaryBtn} disabled={busy}>
                        Save email
                      </button>
                      <button onClick={cancelEdit} style={ui.secondaryBtn} disabled={busy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {loadingRows ? (
              <div style={ui.loadingCard}>
                <div style={ui.loadingTitle}>Loading…</div>
                <div style={ui.loadingSub}>Fetching {currentMeta.table} rows.</div>
              </div>
            ) : tab === "images" ? (
              <ImagesView
                rows={rows}
                editingId={editingId}
                imageEdit={imageEdit}
                setImageEdit={setImageEdit}
                busy={busy}
                onEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveImageEdit}
                onDelete={deleteImageRow}
              />
            ) : tab === "humorFlavorSteps" ? (
              <HumorFlavorStepsView rows={rows} />
            ) : tab === "captions" ? (
              <CaptionsView rows={rows} />
            ) : tab === "llmResponses" ? (
              <LlmResponsesView rows={rows} />
            ) : (
              <DataTable
                rows={rows}
                columns={visibleColumns}
                canEdit={
                  tab === "humorFlavorMix" ||
                  tab === "terms" ||
                  tab === "captionExamples" ||
                  tab === "llmModels" ||
                  tab === "llmProviders" ||
                  tab === "allowedSignupDomains" ||
                  tab === "whitelistEmails"
                }
                canDelete={
                  tab === "terms" ||
                  tab === "captionExamples" ||
                  tab === "llmModels" ||
                  tab === "llmProviders" ||
                  tab === "allowedSignupDomains" ||
                  tab === "whitelistEmails"
                }
                onEdit={startEdit}
                onDelete={(id) => {
                  if (tab === "terms") return void deleteTerm(id);
                  if (tab === "captionExamples") return void deleteCaptionExample(id);
                  if (tab === "llmModels") return void deleteLlmModel(id);
                  if (tab === "llmProviders") return void deleteLlmProvider(id);
                  if (tab === "allowedSignupDomains") return void deleteAllowedDomain(id);
                  if (tab === "whitelistEmails") return void deleteWhitelistEmail(id);
                }}
              />
            )}
          </section>
        ) : null}

        <footer style={ui.footer}>
          <div style={{ opacity: 0.65 }}>© Admin area · schema-matched</div>
        </footer>
      </div>
    </main>
  );
}

function blankImageForm(): ImageForm {
  return {
    url: "",
    is_public: true,
    is_common_use: false,
    additional_context: "",
    image_description: "",
  };
}

function blankTermForm(): TermForm {
  return {
    term: "",
    definition: "",
    example: "",
    priority: "",
    term_type_id: "",
  };
}

function blankCaptionExampleForm(): CaptionExampleForm {
  return {
    image_description: "",
    caption: "",
    explanation: "",
    priority: "",
    image_id: "",
  };
}

function blankLlmModelForm(): LlmModelForm {
  return {
    name: "",
    llm_provider_id: "",
    provider_model_id: "",
    is_temperature_supported: false,
  };
}

function blankLlmProviderForm(): LlmProviderForm {
  return { name: "" };
}

function blankAllowedDomainForm(): AllowedDomainForm {
  return { apex_domain: "" };
}

function blankWhitelistEmailForm(): WhitelistEmailForm {
  return { email_address: "" };
}

function nullIfBlank(v: string) {
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalInt(v: string) {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${v}`);
  return n;
}

function deriveColumns(rows: GenericRow[], currentTab?: TabKey) {
  if (currentTab === "images") {
    return [
      "id",
      "url",
      "is_public",
      "is_common_use",
      "profile_id",
      "additional_context",
      "image_description",
      "created_datetime_utc",
    ];
  }

  if (currentTab === "humorFlavorSteps") {
    return [
      "id",
      "humor_flavor_id",
      "humor_flavor_step_type_id",
      "step_order",
      "name",
      "description",
      "created_datetime_utc",
    ];
  }

  if (currentTab === "captions") {
    return [
      "id",
      "created_datetime_utc",
      "profile_id",
      "image_id",
      "content",
      "like_count",
      "is_public",
    ];
  }

  if (currentTab === "llmResponses") {
    return [
      "id",
      "created_datetime_utc",
      "profile_id",
      "caption_request_id",
      "humor_flavor_id",
      "humor_flavor_step_id",
      "llm_model_id",
      "llm_prompt_chain_id",
      "llm_temperature",
      "llm_model_response",
      "llm_system_prompt",
    ];
  }

  const preferred = [
    "id",
    "created_datetime_utc",
    "modified_datetime_utc",
    "name",
    "email",
    "email_address",
    "apex_domain",
    "term",
    "definition",
    "example",
    "priority",
    "caption_count",
    "caption",
    "explanation",
    "url",
    "profile_id",
    "image_id",
    "is_public",
    "is_common_use",
    "additional_context",
    "image_description",
    "provider_model_id",
    "llm_provider_id",
    "is_temperature_supported",
  ];

  const set = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((k) => set.add(k));
  }

  const all = [...set];
  const ordered = [
    ...preferred.filter((p) => set.has(p)),
    ...all.filter((k) => !preferred.includes(k)).sort(),
  ];

  return ordered.slice(0, 12);
}

function renderCellValue(value: any) {
  if (value === null || value === undefined) return <span style={{ opacity: 0.5 }}>—</span>;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    return <pre style={ui.pre}>{JSON.stringify(value, null, 2)}</pre>;
  }

  const text = String(value);

  if (isLikelyImageUrl(text)) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={ui.thumb}>
          <img src={text} alt="" style={ui.thumbImg} />
        </div>
        <div style={ui.clampedCell}>{text}</div>
      </div>
    );
  }

  // Make IDs, timestamps, and large numbers readable in narrow table columns.
  // Without this, long UUID-like strings wrap into unreadable vertical chunks.
  const pretty = formatIdNumberOrDateForTable(text);
  if (pretty) return pretty;

  return <div style={ui.clampedCell}>{text}</div>;
}

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function formatIdLikeForTable(s: string) {
  if (!isUuidLike(s)) return null;
  const start = s.slice(0, 8);
  const end = s.slice(-6);
  return { text: `${start}...${end}`, full: s };
}

function formatDateLikeForTable(s: string) {
  // Common DB pattern: `YYYY-MM-DD...` (ISO 8601 or timestamp)
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  // Keep it short for readability, but allow hover for full value.
  const short = s.slice(0, 10);
  return { text: short, full: s };
}

function formatNumberLikeForTable(s: string) {
  // Only treat integers as numbers to avoid messing up non-numeric content.
  if (!/^-?\d+$/.test(s)) return null;
  const num = Number(s);
  if (!Number.isFinite(num)) return null;
  return { text: new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num), full: s };
}

function formatIdNumberOrDateForTable(text: string) {
  const id = formatIdLikeForTable(text);
  if (id) {
    return (
      <span style={ui.inlineMonoEllipsis} title={id.full}>
        {id.text}
      </span>
    );
  }

  const date = formatDateLikeForTable(text);
  if (date) {
    return (
      <span style={ui.inlineMonoEllipsis} title={date.full}>
        {date.text}
      </span>
    );
  }

  const num = formatNumberLikeForTable(text);
  if (num) {
    return (
      <span style={ui.inlineMonoEllipsis} title={num.full}>
        {num.text}
      </span>
    );
  }

  return null;
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  if (maxLength <= 10) return `${value.slice(0, maxLength)}…`;
  const keep = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "png";
}

function slugifyBaseName(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isLikelyImageUrl(v: string) {
  return /^https?:\/\//i.test(v) && /\.(png|jpg|jpeg|webp|gif|svg)(\?|#|$)/i.test(v);
}

function hasColumnForOrdering(table: string) {
  return [
    "profiles",
    "images",
    "humor_flavor_mix",
    "terms",
    "captions",
    "caption_requests",
    "caption_examples",
    "llm_models",
    "llm_providers",
    "llm_prompt_chains",
    "llm_model_responses",
    "allowed_signup_domains",
    "whitelist_email_addresses",
  ].includes(table);
}

function prettyLlmResponse(
  value: any
): { kind: "array"; items: string[] } | { kind: "text"; text: string } {
  if (value == null) return { kind: "text", text: "—" };

  if (Array.isArray(value)) {
    return {
      kind: "array",
      items: value.map((x) => String(x)),
    };
  }

  if (typeof value !== "string") {
    try {
      return { kind: "text", text: JSON.stringify(value, null, 2) };
    } catch {
      return { kind: "text", text: String(value) };
    }
  }

  const trimmed = value.trim();
  if (!trimmed) return { kind: "text", text: "—" };

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return {
        kind: "array",
        items: parsed.map((x) => String(x)),
      };
    }

    return {
      kind: "text",
      text: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return { kind: "text", text: value };
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{label}</div>
      {children}
    </label>
  );
}

function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={ui.metaItemBetter}>
      <div style={ui.metaLabelBetter}>{label}</div>
      <div style={ui.metaValueBetter}>{value}</div>
    </div>
  );
}

function ImagesView({
  rows,
  editingId,
  imageEdit,
  setImageEdit,
  busy,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  rows: GenericRow[];
  editingId: string | null;
  imageEdit: ImageForm;
  setImageEdit: React.Dispatch<React.SetStateAction<ImageForm>>;
  busy: boolean;
  onEdit: (row: GenericRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: string) => void;
}) {
  if (!rows.length) {
    return <EmptyState title="No images" body="No image rows found." />;
  }

  return (
    <div style={ui.imagesList}>
      {rows.map((row) => {
        const isEditing = editingId === String(row.id);
        const previewUrl = isEditing ? imageEdit.url : row.url;

        return (
          <div key={String(row.id)} style={ui.imageRowCard}>
            <div style={ui.imageRowLeft}>
              <div style={ui.imageLargeFrame}>
                {previewUrl ? (
                  <img src={String(previewUrl)} alt="" style={ui.imageLargeImg} />
                ) : (
                  <div style={ui.imagePlaceholder}>No image</div>
                )}
              </div>

              <div style={ui.imageActions}>
                {isEditing ? (
                  <>
                    <button onClick={onSaveEdit} style={ui.primaryBtn} disabled={busy}>
                      Save
                    </button>
                    <button onClick={onCancelEdit} style={ui.secondaryBtn} disabled={busy}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onEdit(row)} style={ui.secondaryBtn} disabled={busy}>
                      Edit
                    </button>
                    <button onClick={() => onDelete(String(row.id))} style={ui.dangerBtn} disabled={busy}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={ui.imageRowRight}>
              <div style={ui.imageHeaderRow}>
                <div>
                  <div style={ui.cardTitle}>{isEditing ? "Editing image" : "Image"}</div>
                  <div style={ui.cardSub}>
                    <code style={ui.code}>{String(row.id)}</code>
                  </div>
                </div>

                {!isEditing ? (
                  <div style={ui.imageBadgeRow}>
                    <span style={ui.smallPill}>{row.is_public ? "Public" : "Private"}</span>
                    <span style={ui.smallPill}>{row.is_common_use ? "Common use" : "Not common use"}</span>
                  </div>
                ) : null}
              </div>

              {isEditing ? (
                <>
                  <div style={ui.formGrid2}>
                    <Field label="URL">
                      <input
                        value={imageEdit.url}
                        onChange={(e) => setImageEdit((s) => ({ ...s, url: e.target.value }))}
                        style={ui.input}
                      />
                    </Field>

                    <Field label="Profile">
                      <div style={ui.readOnlyField}>
                        {row.profile_id ? <code style={ui.code}>{String(row.profile_id)}</code> : "—"}
                      </div>
                    </Field>
                  </div>

                  <div style={ui.formGrid2}>
                    <label style={ui.checkCard}>
                      <input
                        type="checkbox"
                        checked={imageEdit.is_public}
                        onChange={(e) =>
                          setImageEdit((s) => ({
                            ...s,
                            is_public: e.target.checked,
                          }))
                        }
                      />
                      <span>is_public</span>
                    </label>

                    <label style={ui.checkCard}>
                      <input
                        type="checkbox"
                        checked={imageEdit.is_common_use}
                        onChange={(e) =>
                          setImageEdit((s) => ({
                            ...s,
                            is_common_use: e.target.checked,
                          }))
                        }
                      />
                      <span>is_common_use</span>
                    </label>
                  </div>

                  <div style={ui.contentGrid}>
                    <div style={ui.contentPanel}>
                      <div style={ui.textBlockLabel}>Additional context</div>
                      <textarea
                        value={imageEdit.additional_context}
                        onChange={(e) =>
                          setImageEdit((s) => ({
                            ...s,
                            additional_context: e.target.value,
                          }))
                        }
                        style={ui.textareaInline}
                      />
                    </div>

                    <div style={ui.contentPanel}>
                      <div style={ui.textBlockLabel}>Image description</div>
                      <textarea
                        value={imageEdit.image_description}
                        onChange={(e) =>
                          setImageEdit((s) => ({
                            ...s,
                            image_description: e.target.value,
                          }))
                        }
                        style={ui.textareaInlineTall}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={ui.metaGridBetter}>
                    <MetaItem
                      label="Created"
                      value={row.created_datetime_utc ? new Date(row.created_datetime_utc).toLocaleString() : "—"}
                    />
                    <MetaItem
                      label="Modified"
                      value={row.modified_datetime_utc ? new Date(row.modified_datetime_utc).toLocaleString() : "—"}
                    />
                    <MetaItem
                      label="Profile"
                      value={row.profile_id ? <code style={ui.code}>{String(row.profile_id)}</code> : "—"}
                    />
                    <MetaItem
                      label="URL"
                      value={
                        row.url ? (
                          <a href={row.url} target="_blank" rel="noreferrer" style={ui.linkLike}>
                            Open image
                          </a>
                        ) : (
                          "—"
                        )
                      }
                    />
                  </div>

                  <div style={ui.contentGrid}>
                    <div style={ui.contentPanel}>
                      <div style={ui.textBlockLabel}>Additional context</div>
                      <div style={ui.scrollTextBox}>{row.additional_context || "—"}</div>
                    </div>

                    <div style={ui.contentPanel}>
                      <div style={ui.textBlockLabel}>Image description</div>
                      <div style={ui.scrollTextBoxTall}>{row.image_description || "—"}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HumorFlavorStepsView({ rows }: { rows: GenericRow[] }) {
  if (!rows.length) {
    return <EmptyState title="No humor flavor steps" body="No rows found." />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ui.table}>
        <thead>
          <tr>
            <Th>ID</Th>
            <Th>Flavor ID</Th>
            <Th>Step Type ID</Th>
            <Th>Step Order</Th>
            <Th>Name</Th>
            <Th>Description</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={String(row.id ?? idx)}>
              <Td>{row.id ?? "—"}</Td>
              <Td>{row.humor_flavor_id ?? "—"}</Td>
              <Td>{row.humor_flavor_step_type_id ?? "—"}</Td>
              <Td>{row.step_order ?? "—"}</Td>
              <Td>{row.name ?? "—"}</Td>
              <Td>
                <div style={ui.mediumTextCell}>{row.description ?? "—"}</div>
              </Td>
              <Td>{row.created_datetime_utc ? new Date(row.created_datetime_utc).toLocaleString() : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function aggregateCaptionVotes(voteRows: Array<{ vote_value: number | null }>) {
  let likes = 0;
  let dislikes = 0;
  let neutral = 0;
  const byValue = new Map<number, number>();
  for (const r of voteRows) {
    const v = r.vote_value;
    if (v == null) continue;
    byValue.set(v, (byValue.get(v) ?? 0) + 1);
    if (v > 0) likes += 1;
    else if (v < 0) dislikes += 1;
    else neutral += 1;
  }
  return {
    total: voteRows.length,
    likes,
    dislikes,
    neutral,
    net: likes - dislikes,
    byValue,
  };
}

function CaptionVoteBreakdown({ captionId }: { captionId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ReturnType<typeof aggregateCaptionVotes> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    setLoading(true);
    setError("");
    setStats(null);

    (async () => {
      const { data, error: qErr } = await supabase
        .from("caption_votes")
        .select("vote_value")
        .eq("caption_id", captionId);

      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }
      setStats(aggregateCaptionVotes((data ?? []) as Array<{ vote_value: number | null }>));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [captionId]);

  if (loading) {
    return (
      <div style={ui.captionVotePanel}>
        <div style={{ opacity: 0.75 }}>Loading vote breakdown…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={ui.captionVotePanel}>
        <div style={{ color: "rgba(255,180,180,0.95)" }}>{error}</div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div style={ui.captionVotePanel}>
        <div style={ui.captionVoteTitle}>Rating breakdown</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>No votes recorded for this caption yet.</div>
      </div>
    );
  }

  const byValueRows = [...stats.byValue.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div style={ui.captionVotePanel}>
      <div style={ui.captionVoteTitle}>Rating breakdown</div>
      <div style={ui.captionVoteStatGrid}>
        <div style={ui.captionVoteStat}>
          <div style={ui.captionVoteStatLabel}>Total votes</div>
          <div style={ui.captionVoteStatValue}>{stats.total}</div>
        </div>
        <div style={ui.captionVoteStat}>
          <div style={ui.captionVoteStatLabel}>Upvotes (+)</div>
          <div style={ui.captionVoteStatValue}>{stats.likes}</div>
        </div>
        <div style={ui.captionVoteStat}>
          <div style={ui.captionVoteStatLabel}>Downvotes (−)</div>
          <div style={ui.captionVoteStatValue}>{stats.dislikes}</div>
        </div>
        {stats.neutral > 0 ? (
          <div style={ui.captionVoteStat}>
            <div style={ui.captionVoteStatLabel}>Neutral (0)</div>
            <div style={ui.captionVoteStatValue}>{stats.neutral}</div>
          </div>
        ) : null}
        <div style={ui.captionVoteStat}>
          <div style={ui.captionVoteStatLabel}>Net score</div>
          <div style={ui.captionVoteStatValue}>{stats.net >= 0 ? "+" : ""}{stats.net}</div>
        </div>
      </div>
      {byValueRows.length > 1 ? (
        <>
          <div style={{ ...ui.textBlockLabel, marginTop: 14 }}>By vote value</div>
          <div style={ui.captionVoteByValue}>
            {byValueRows.map(([value, count]) => (
              <div key={value} style={ui.captionVoteByValueRow}>
                <code style={ui.code}>{value}</code>
                <span style={{ opacity: 0.85 }}>{count}×</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CaptionsView({ rows }: { rows: GenericRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!rows.length) {
    return <EmptyState title="No captions" body="No rows found." />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 10 }}>
        Click <b style={{ opacity: 0.95 }}>View votes</b> or the <b style={{ opacity: 0.95 }}>caption text</b> to load per-caption stats from{" "}
        <code style={ui.code}>caption_votes</code>.
      </div>
      <table style={ui.table}>
        <thead>
          <tr>
            <Th>Ratings</Th>
            <Th>Created</Th>
            <Th>Caption</Th>
            <Th>Likes</Th>
            <Th>Public</Th>
            <Th>Profile</Th>
            <Th>Image</Th>
            <Th>ID</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const id = row.id != null ? String(row.id) : "";
            const isOpen = Boolean(id && expandedId === id);
            return (
              <Fragment key={id || String(idx)}>
                <tr>
                  <Td>
                    {id ? (
                      <button
                        type="button"
                        onClick={() => setExpandedId((cur) => (cur === id ? null : id))}
                        style={ui.captionVoteToggleBtn}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide" : "View votes"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>{row.created_datetime_utc ? new Date(row.created_datetime_utc).toLocaleString() : "—"}</Td>
                  <Td>
                    <div
                      style={id ? { ...ui.captionCell, cursor: "pointer" } : ui.captionCell}
                      onClick={() => {
                        if (id) setExpandedId((cur) => (cur === id ? null : id));
                      }}
                      title={id ? "Click to show or hide vote breakdown" : undefined}
                      role={id ? "button" : undefined}
                      tabIndex={id ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (!id) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId((cur) => (cur === id ? null : id));
                        }
                      }}
                    >
                      {row.content ?? row.caption ?? "—"}
                    </div>
                  </Td>
                  <Td>{row.like_count ?? 0}</Td>
                  <Td>{row.is_public ? "Yes" : "No"}</Td>
                  <Td>{row.profile_id ? String(row.profile_id).slice(0, 12) + "…" : "—"}</Td>
                  <Td>{row.image_id ? String(row.image_id).slice(0, 12) + "…" : "—"}</Td>
                  <Td>{row.id ? String(row.id).slice(0, 12) + "…" : "—"}</Td>
                </tr>
                {isOpen && id ? (
                  <tr>
                    <td colSpan={8} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: 0 }}>
                      <CaptionVoteBreakdown captionId={id} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LlmResponsesView({ rows }: { rows: GenericRow[] }) {
  if (!rows.length) {
    return <EmptyState title="No LLM responses" body="No rows found." />;
  }

  return (
    <div style={ui.responsesList}>
      {rows.map((row, idx) => {
        const parsed = prettyLlmResponse(row.llm_model_response);
        const isArray = parsed.kind === "array";
        const isLongText = parsed.kind === "text" && parsed.text.length > 220;

        return (
          <div key={String(row.id ?? idx)} style={ui.responseCardBetter}>
            <div style={ui.responseHeader}>
              <div>
                <div style={ui.cardTitle}>Response {row.id ?? "—"}</div>
                <div style={ui.cardSub}>
                  {row.created_datetime_utc ? new Date(row.created_datetime_utc).toLocaleString() : "—"}
                </div>
              </div>

              <div style={ui.responseBadgeWrap}>
                <span style={ui.smallPill}>Model {row.llm_model_id ?? "—"}</span>
                <span style={ui.smallPill}>Chain {row.llm_prompt_chain_id ?? "—"}</span>
                <span style={ui.smallPill}>Temp {row.llm_temperature ?? "—"}</span>
              </div>
            </div>

            <div style={ui.metaGridResponse}>
              <MetaItem
                label="Profile"
                value={row.profile_id ? <code style={ui.code}>{String(row.profile_id)}</code> : "—"}
              />
              <MetaItem label="Caption Request" value={row.caption_request_id ?? "—"} />
              <MetaItem label="Humor Flavor" value={row.humor_flavor_id ?? "—"} />
              <MetaItem label="Humor Step" value={row.humor_flavor_step_id ?? "—"} />
            </div>

            <div style={ui.textBlockLabel}>Generated response</div>

            {isArray ? (
              <div style={ui.generatedList}>
                {parsed.items.map((item, i) => (
                  <div key={i} style={ui.generatedItem}>
                    <div style={ui.generatedIndex}>{i + 1}</div>
                    <div style={ui.generatedText}>{item}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={ui.proseResponseWrap}>
                <pre style={isLongText ? ui.proseResponseLarge : ui.proseResponseSmall}>{parsed.text}</pre>
              </div>
            )}

            <details style={ui.promptDetails}>
              <summary style={ui.promptSummary}>System prompt</summary>
              <pre style={ui.promptBoxCollapsed}>{row.llm_system_prompt ?? "—"}</pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({
  rows,
  columns,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: GenericRow[];
  columns: string[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (row: GenericRow) => void;
  onDelete?: (id: string) => void;
}) {
  if (!rows.length) {
    return <EmptyState title="No rows visible" body="This table is empty or no rows matched the query." />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ui.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <Th key={c}>{c}</Th>
            ))}
            {canEdit || canDelete ? <Th>Actions</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={String(row.id ?? idx)}>
              {columns.map((col) => (
                <Td key={col}>{renderCellValue(row[col])}</Td>
              ))}

              {canEdit || canDelete ? (
                <Td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {canEdit ? (
                      <button onClick={() => onEdit?.(row)} style={ui.secondaryBtn}>
                        Edit
                      </button>
                    ) : null}
                    {canDelete && row.id != null ? (
                      <button onClick={() => onDelete?.(String(row.id))} style={ui.dangerBtn}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tabs now render via `SidebarTabButton` (the old centered `TabButton` was removed).

function tabIconForKey(key: TabKey) {
  const label = TAB_META[key].label;
  const parts = label
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  const icon = parts
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
  return icon || label.slice(0, 3).toUpperCase();
}

function SidebarTabButton({
  expanded,
  active,
  icon,
  label,
  onClick,
}: {
  expanded: boolean;
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        ...(ui.sidebarTabBtn as CSSProperties),
        ...(active ? (ui.sidebarTabBtnActive as CSSProperties) : {}),
      }}
    >
      <span style={ui.sidebarTabIcon}>{icon}</span>
      <span
        style={{
          ...(ui.sidebarTabLabel as CSSProperties),
          maxWidth: expanded ? 160 : 0,
          opacity: expanded ? 1 : 0,
        }}
        title={label}
      >
        {label}
      </span>
    </button>
  );
}

function Pager({
  page,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  page: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={onPrev} style={ui.secondaryBtn} disabled={!canPrev}>
        ←
      </button>
      <div style={{ opacity: 0.8, fontWeight: 900 }}>Page {page + 1}</div>
      <button onClick={onNext} style={ui.secondaryBtn} disabled={!canNext}>
        →
      </button>
    </div>
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

function RatedCaptionRow({ row, badge, rank }: { row: RatedCaption; badge: string; rank: number }) {
  return (
    <div style={ui.ratedCaptionRow}>
      <div style={ui.rank}>{rank}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={ui.ratedCaptionText}>{truncateMiddle(row.content || "Untitled caption", 140)}</div>
        <div style={ui.ratedCaptionMeta}>
          <span style={ui.metricPill}>{row.totalVotes} votes</span>
          <span style={ui.metricPill}>+{row.likes}</span>
          <span style={ui.metricPill}>-{row.dislikes}</span>
        </div>
      </div>
      <div style={ui.smallPill}>{badge}</div>
    </div>
  );
}

function SparkBars({
  points,
  maxY,
  unitLabel,
}: {
  points: { day: string; count: number }[];
  maxY: number;
  unitLabel: string;
}) {
  const [hover, setHover] = useState<{ day: string; count: number; x: number; y: number } | null>(null);

  const tooltip =
    hover &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        role="tooltip"
        style={{
          pointerEvents: "none",
          position: "fixed",
          left: hover.x + 12,
          top: hover.y + 12,
          zIndex: 99999,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.22)",
          background: "#14161c",
          color: "#ffffff",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          fontSize: 12,
          fontWeight: 800,
          lineHeight: 1.35,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.92)" }}>{hover.day}</div>
        <div style={{ marginTop: 4, fontWeight: 950, color: "#ffffff" }}>
          {hover.count.toLocaleString()} {unitLabel}
        </div>
      </div>,
      document.body
    );

  return (
    <div style={ui.sparkPanel}>
      <div style={ui.sparkWrap}>
        {points.map((p) => {
          const h = Math.round((p.count / maxY) * 100);
          return (
            <div
              key={p.day}
              style={ui.sparkCol}
              onMouseEnter={(e) => setHover({ day: p.day, count: p.count, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover({ day: p.day, count: p.count, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
            >
              <div style={ui.sparkTrack}>
                <div style={{ ...(ui.sparkFill as CSSProperties), height: `${Math.max(4, h)}%` }} />
              </div>
              <div style={ui.sparkLabel}>{p.day.slice(5)}</div>
            </div>
          );
        })}
      </div>
      {tooltip}
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

function Th({ children }: { children: ReactNode }) {
  return <th style={ui.th}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={ui.td}>{children}</td>;
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

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

const ui: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    fontFamily,
    color: "white",
    background: "#06070a",
  },
  wrap: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1380,
    margin: "0 auto",
    padding: "28px 22px 36px",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    paddingTop: 20,
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
    opacity: 0.9,
  },
  smallPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.9,
  },

  h1: {
    fontSize: 58,
    lineHeight: 0.95,
    letterSpacing: -2,
    margin: "14px 0 10px",
    fontWeight: 1000,
  },
  subline: { opacity: 0.82, fontSize: 15 },

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

  sidebarBackdrop: {
    position: "fixed",
    inset: 0,
    border: "none",
    padding: 0,
    margin: 0,
    background: "rgba(3, 6, 18, 0.28)",
    zIndex: 19,
    cursor: "pointer",
  } satisfies CSSProperties,

  sidebar: {
    position: "fixed",
    left: 18,
    top: 142,
    bottom: 18,
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(6,7,10,0.72)",
    backdropFilter: "blur(10px)",
    width: 210,
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(0,0,0,0.36)",
    transition: "transform 260ms ease, opacity 260ms ease",
    willChange: "transform, opacity",
  } satisfies CSSProperties,

  sidebarToggleBtn: {
    position: "fixed",
    left: 18,
    top: 92,
    zIndex: 30,
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 1000,
    fontSize: 20,
    display: "grid",
    placeItems: "center",
    boxShadow: "0 14px 30px rgba(0,0,0,0.28)",
    transition: "transform 120ms ease, background 120ms ease, opacity 120ms ease",
  } satisfies CSSProperties,

  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px",
  },

  sidebarHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    fontWeight: 1000,
    opacity: 0.95,
  },

  sidebarHeaderHint: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  sidebarNav: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflowY: "auto",
    paddingRight: 2,
  } satisfies CSSProperties,

  sidebarTabBtn: {
    width: "100%",
    height: 40,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    cursor: "pointer",
    fontWeight: 950,
    opacity: 0.75,
    transition: "background 120ms ease, opacity 120ms ease",
  } satisfies CSSProperties,

  sidebarTabBtnActive: {
    opacity: 1,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.22)",
  },

  sidebarTabIcon: {
    width: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 1000,
    opacity: 0.95,
  },

  sidebarTabLabel: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 13,
    fontWeight: 950,
    transition: "max-width 180ms ease, opacity 180ms ease",
  } satisfies CSSProperties,

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

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
  kpiValue: { fontSize: 38, fontWeight: 1000, marginTop: 8, letterSpacing: -1 },
  kpiSub: { opacity: 0.7, marginTop: 4 },

  twoCol: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginTop: 14 },

  card: {
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    marginTop: 16,
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  cardTitle: { fontWeight: 950, fontSize: 16 },
  cardSub: { opacity: 0.7, fontSize: 12, marginTop: 4 },

  formSection: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    display: "grid",
    gap: 12,
  },
  formTitle: { fontWeight: 950, fontSize: 15 },
  formGrid1: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  formGrid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },

  input: {
    height: 40,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    width: "100%",
  },
  textareaSmall: {
    minHeight: 96,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    width: "100%",
    resize: "vertical",
    fontFamily,
  },

  checkRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    opacity: 0.88,
    fontWeight: 850,
  },

  table: {
    width: "100%",
    marginTop: 14,
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  th: {
    textAlign: "left",
    padding: "10px 10px",
    opacity: 0.7,
    fontWeight: 900,
    fontSize: 12,
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "#0b0d12",
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    verticalAlign: "top",
    fontSize: 13,
    lineHeight: 1.4,
  },

  code: {
    padding: "2px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.08)",
    fontSize: 12,
  },
  inlineMonoEllipsis: {
    display: "inline-block",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 240,
    verticalAlign: "bottom",
  },

  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },

  pre: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 12,
    lineHeight: 1.4,
    opacity: 0.92,
  },
  clampedCell: {
    maxWidth: 360,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.4,
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
  rowTitle: { fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowRight: { textAlign: "right" },
  rowValue: { fontWeight: 1000, fontSize: 18, letterSpacing: -0.5 },
  rowSub: { opacity: 0.6, fontSize: 12 },

  imageGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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

  sparkWrap: {
    display: "flex",
    gap: 10,
    alignItems: "stretch",
    flex: 1,
    minHeight: 160,
    padding: "6px 4px",
  },
  sparkPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  sparkCol: {
    flex: 1,
    minWidth: 30,
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  sparkTrack: {
    flex: 1,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
  },
  sparkFill: { width: "100%", borderRadius: 14, background: "rgba(255,255,255,0.20)" },
  sparkLabel: { marginTop: 8, fontSize: 11, opacity: 0.6, textAlign: "center" },
  ratedCaptionRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },
  ratedCaptionText: {
    fontWeight: 850,
    fontSize: 13,
    lineHeight: 1.4,
  },
  ratedCaptionMeta: {
    marginTop: 8,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  metricPill: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 11,
    opacity: 0.85,
    fontWeight: 800,
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
  },
  loadingTitle: { fontWeight: 950, fontSize: 16 },
  loadingSub: { marginTop: 6, opacity: 0.7 },

  errorCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,120,120,0.28)",
    background: "rgba(255,120,120,0.10)",
  },

  footer: {
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },

  imagesList: {
    display: "grid",
    gap: 18,
    marginTop: 14,
  },
  imageRowCard: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 18,
    borderRadius: 22,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
    alignItems: "stretch",
  },
  imageRowLeft: {
    // Use a column flex layout so Edit/Delete buttons can be pinned to
    // the bottom edge of the card.
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
    justifyContent: "space-between",
  },
  imageLargeFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  },
  imageLargeImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  imageActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  imageRowRight: {
    minWidth: 0,
    display: "grid",
    gap: 14,
    alignContent: "start",
  },
  imageHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  imageBadgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  metaGridBetter: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  metaItemBetter: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },
  metaLabelBetter: {
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.62,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValueBetter: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.25fr",
    gap: 14,
  },
  contentPanel: {
    minWidth: 0,
  },
  scrollTextBox: {
    marginTop: 8,
    minHeight: 90,
    maxHeight: 140,
    overflow: "auto",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  scrollTextBoxTall: {
    marginTop: 8,
    minHeight: 140,
    maxHeight: 220,
    overflow: "auto",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  readOnlyField: {
    minHeight: 40,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    color: "white",
  },
  checkCard: {
    minHeight: 48,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 850,
  },
  textareaInline: {
    width: "100%",
    minHeight: 120,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    resize: "vertical",
    outline: "none",
    fontFamily,
    lineHeight: 1.5,
  },
  textareaInlineTall: {
    width: "100%",
    minHeight: 200,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    resize: "vertical",
    outline: "none",
    fontFamily,
    lineHeight: 1.55,
  },

  responsesList: {
    display: "grid",
    gap: 18,
    marginTop: 14,
  },
  responseCardBetter: {
    display: "grid",
    gap: 14,
    borderRadius: 22,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
  },
  responseHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  responseBadgeWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  metaGridResponse: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  generatedList: {
    marginTop: 8,
    display: "grid",
    gap: 10,
  },
  generatedItem: {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: 10,
    alignItems: "start",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },
  generatedIndex: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  },
  generatedText: {
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  proseResponseWrap: {
    marginTop: 2,
  },
  proseResponseSmall: {
    margin: 0,
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.65,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 14,
  },
  proseResponseLarge: {
    margin: 0,
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.55,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    maxHeight: 260,
    overflow: "auto",
  },

  promptDetails: {
    marginTop: 6,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },
  promptSummary: {
    cursor: "pointer",
    listStyle: "none",
    padding: "10px 14px",
    fontWeight: 900,
    fontSize: 13,
    opacity: 0.9,
  },
  promptBoxCollapsed: {
    margin: 0,
    padding: "0 14px 14px 14px",
    maxHeight: 260,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.6,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
  },

  mediumTextCell: {
    maxWidth: 420,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.5,
  },
  captionCell: {
    maxWidth: 560,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.5,
  },

  captionVoteToggleBtn: {
    height: 34,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 850,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  captionVotePanel: {
    padding: "14px 16px 16px",
    background: "rgba(255,255,255,0.04)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  captionVoteTitle: {
    fontWeight: 950,
    fontSize: 14,
    marginBottom: 2,
  },
  captionVoteStatGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 12,
    marginTop: 10,
  },
  captionVoteStat: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
  },
  captionVoteStatLabel: {
    fontSize: 11,
    opacity: 0.72,
    fontWeight: 800,
  },
  captionVoteStatValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 1000,
    letterSpacing: -0.5,
  },
  captionVoteByValue: {
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  captionVoteByValueRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 800,
  },

  textBlock: {
    minWidth: 0,
  },
  textBlockLabel: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.72,
    marginBottom: 6,
  },
  textBlockBody: {
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  linkLike: {
    color: "white",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },

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
