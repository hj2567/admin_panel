"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setAuthed(!!session);
      setEmail(session?.user?.email ?? "");
      setLoading(false);
    };
    run();
  }, []);

  return (
    <main style={ui.shell}>
      <Background />

      <div style={ui.wrap}>
        <div style={ui.hero}>
          <div style={ui.kickerRow}>
            <span style={ui.kicker}>ADMIN</span>
            <span style={ui.pill}>
              {loading
                ? "Checking session"
                : authed
                ? "Authenticated"
                : "Sign in required"}
            </span>
          </div>

          <h1 style={ui.h1}>Admin Panel</h1>

          <div style={ui.subline}>
            {loading ? (
              <span style={{ opacity: 0.75 }}>Loading…</span>
            ) : authed ? (
              <>
                Signed in as{" "}
                <b style={{ opacity: 0.95 }}>{email || "unknown"}</b>
              </>
            ) : (
              <span style={{ opacity: 0.8 }}>
                Log in to access the admin dashboard.
              </span>
            )}
          </div>

          <div style={{ marginTop: 22 }}>
            {loading ? (
              <div style={ui.skeletonBtn} />
            ) : authed ? (
              <a
                href="/admin"
                style={ui.primaryBtn}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateY(-1px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateY(0px)")
                }
              >
                Continue to Admin <span style={{ opacity: 0.7 }}>→</span>
              </a>
            ) : (
              <a
                href="/auth?next=/admin"
                style={ui.primaryBtn}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateY(-1px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateY(0px)")
                }
              >
                Log in with Google <span style={{ opacity: 0.7 }}>→</span>
              </a>
            )}
          </div>

          <div style={ui.footerRow}>
            <span style={ui.footerPill}>Secure</span>
            <span style={ui.footerPill}>Superadmin-only</span>
            <span style={ui.footerPill}>Staging-safe</span>
          </div>
        </div>
      </div>
    </main>
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

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

const ui = {
  shell: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    fontFamily,
    color: "white",
    background: "#06070a",
  } satisfies CSSProperties,

  wrap: {
    position: "relative",
    zIndex: 2,
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 28,
  } satisfies CSSProperties,

  hero: {
    width: "min(920px, 94vw)",
    textAlign: "center",
  } satisfies CSSProperties,

  kickerRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  } satisfies CSSProperties,

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
  } satisfies CSSProperties,

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
  } satisfies CSSProperties,

  h1: {
    fontSize: 86,
    lineHeight: 0.92,
    letterSpacing: -2.5,
    margin: "18px 0 12px",
    fontWeight: 1000,
  } satisfies CSSProperties,

  subline: {
    fontSize: 16,
    opacity: 0.8,
    lineHeight: 1.6,
    maxWidth: 720,
    margin: "0 auto",
  } satisfies CSSProperties,

  primaryBtn: {
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
    transition: "transform 120ms ease",
  } satisfies CSSProperties,

  skeletonBtn: {
    width: "min(360px, 100%)",
    height: 54,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
  } satisfies CSSProperties,

  footerRow: {
    marginTop: 18,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
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

  // Background layers (match admin)
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