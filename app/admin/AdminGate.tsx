"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AdminGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [why, setWhy] = useState<string>("");
  const [denialMessage, setDenialMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setAuthed(false);
        setAllowed(false);
        setWhy("not-logged-in");
        setLoading(false);
        return;
      }

      setAuthed(true);

      const userEmail = session.user.email || "";
      setEmail(userEmail);

      const LOCAL_SUPERADMIN_EMAIL = "hj2567@columbia.edu";
      const hostname =
        typeof window !== "undefined" ? window.location.hostname : "";
      const isLocalHost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";
      // Treat "local server" strictly as localhost. This avoids mis-detecting
      // production builds as "local" based on NODE_ENV inside the browser bundle.
      const isLocal = isLocalHost;

      const emailNormalized = userEmail.trim().toLowerCase();
      const localEmailMatch = emailNormalized === LOCAL_SUPERADMIN_EMAIL.toLowerCase();
      const prodEmailBlocked = emailNormalized === LOCAL_SUPERADMIN_EMAIL.toLowerCase();

      // profiles.is_superadmin check (fail-closed).
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", session.user.id)
        .maybeSingle();

      const isSuper = !error && !!prof?.is_superadmin;

      // Local: only allow the specific email.
      // Production/Vercel: allow superadmins except the blocked email.
      const allowed = isLocal
        ? localEmailMatch && isSuper
        : !prodEmailBlocked && isSuper;

      setAllowed(allowed);
      setWhy(
        allowed
          ? isLocal
            ? "local-superadmin-email"
            : "superadmin-approved"
          : isLocal
            ? localEmailMatch
              ? "blocked-not-superadmin"
              : "blocked-non-whitelisted-email"
            : prodEmailBlocked
              ? "blocked-on-vercel-email"
              : "blocked-not-superadmin"
      );

      if (!allowed) {
        setDenialMessage("You do not have access to the admin panel.");
      } else {
        setDenialMessage("");
      }
      setLoading(false);
    };

    run();
  }, []);

  if (loading) {
    return (
      <main style={styles.shell}>
        <Background />
        <div style={styles.center}>
          <div style={styles.card}>
            <div style={styles.kicker}>ADMIN</div>
            <div style={styles.title}>Loading…</div>
            <div style={styles.subtitle}>Checking session and permissions.</div>
          </div>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={styles.shell}>
        <Background />
        <div style={styles.center}>
          <div style={styles.card}>
            <div style={styles.kicker}>ADMIN</div>
            <div style={styles.title}>Admin Panel</div>
            <div style={styles.subtitle}>
              Sign in to continue. Access is restricted to authorized superadmins.
            </div>

            <a
              href="/auth?next=/admin"
              style={styles.primaryBtn}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-1px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0px)")
              }
            >
              Log in with Google <span style={{ opacity: 0.75 }}>→</span>
            </a>

            <div style={styles.footerRow}>
              <span style={styles.footerPill}>Secure area</span>
              <span style={styles.footerPill}>Fail-closed</span>
              <span style={styles.footerPill}>RLS protected</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main style={styles.shell}>
        <Background />
        <div style={styles.center}>
          <div style={styles.card}>
            <div style={styles.kicker}>ADMIN</div>
            <div style={styles.title}>Access denied</div>
            <div style={styles.subtitle}>
              {denialMessage || "Access denied. This admin panel is restricted to authorized superadmins."}
            </div>

            <div style={styles.infoBox}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Signed in as</div>
              <div style={{ fontWeight: 950, marginTop: 4, fontSize: 20 }}>
                {email || "unknown"}
              </div>
              <div style={{ opacity: 0.55, fontSize: 12, marginTop: 6 }}>
                Debug: <code>{why}</code>
              </div>
            </div>

            <button
              onClick={async () => {
                const supabase = getSupabaseBrowserClient();
                await supabase.auth.signOut();
                window.location.replace("/");
              }}
              style={styles.secondaryBtn}
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <div style={{ fontFamily }}>{children}</div>;
}

function Background() {
  return (
    <>
      <div style={styles.bgGradient} />
      <div style={styles.bgGlowA} />
      <div style={styles.bgGlowB} />
      <div style={styles.bgNoise} />
    </>
  );
}

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

const styles = {
  shell: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    fontFamily,
    color: "white",
    background: "#06070a",
  } satisfies CSSProperties,

  center: {
    position: "relative",
    zIndex: 2,
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
  } satisfies CSSProperties,

  card: {
    width: "min(920px, 92vw)",
    borderRadius: 28,
    padding: 28,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 18px 70px rgba(0,0,0,0.55)",
    backdropFilter: "blur(10px)",
  } satisfies CSSProperties,

  kicker: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 950,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
    opacity: 0.95,
    width: "fit-content",
  } satisfies CSSProperties,

  title: {
    fontSize: 76,
    lineHeight: 0.95,
    fontWeight: 1000,
    marginTop: 16,
    letterSpacing: -2,
  } satisfies CSSProperties,

  subtitle: {
    marginTop: 14,
    opacity: 0.8,
    fontSize: 18,
    lineHeight: 1.55,
    maxWidth: 720,
  } satisfies CSSProperties,

  primaryBtn: {
    marginTop: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "16px 18px",
    width: "min(360px, 100%)",
    borderRadius: 999,
    textDecoration: "none",
    color: "white",
    fontWeight: 950,
    letterSpacing: -0.2,
    border: "1px solid rgba(255,255,255,0.18)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.09))",
    boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
    transform: "translateY(0px)",
    transition: "transform 120ms ease, background 120ms ease",
  } satisfies CSSProperties,

  secondaryBtn: {
    marginTop: 18,
    padding: "14px 18px",
    borderRadius: 16,
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    width: "min(220px, 100%)",
  } satisfies CSSProperties,

  footerRow: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    opacity: 0.95,
  } satisfies CSSProperties,

  footerPill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    opacity: 0.85,
  } satisfies CSSProperties,

  infoBox: {
    marginTop: 18,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    padding: 18,
  } satisfies CSSProperties,

  bgGradient: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1200px 700px at 10% 10%, rgba(120,140,255,0.22), transparent 55%), radial-gradient(900px 650px at 90% 20%, rgba(255,140,200,0.14), transparent 60%), radial-gradient(900px 650px at 30% 110%, rgba(0,255,180,0.10), transparent 55%)",
  } satisfies CSSProperties,

  bgGlowA: {
    position: "absolute",
    width: 900,
    height: 900,
    left: -320,
    top: -340,
    background:
      "radial-gradient(circle, rgba(130,120,255,0.18), transparent 60%)",
    filter: "blur(2px)",
  } satisfies CSSProperties,

  bgGlowB: {
    position: "absolute",
    width: 900,
    height: 900,
    right: -320,
    bottom: -380,
    background:
      "radial-gradient(circle, rgba(255,120,200,0.14), transparent 60%)",
    filter: "blur(2px)",
  } satisfies CSSProperties,

  bgNoise: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22 x=%220%22 y=%220%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.08%22/></svg>')",
    opacity: 0.22,
    mixBlendMode: "overlay",
    pointerEvents: "none",
  } satisfies CSSProperties,
};