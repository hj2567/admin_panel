"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthClient() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/rate";

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        sessionStorage.removeItem("oauth_started_at");
        const savedNext = sessionStorage.getItem("oauth_next") || next;
        window.location.replace(savedNext);
      }
    };
    window.addEventListener("pageshow", onPageShow);

    sessionStorage.setItem("oauth_next", next);

    const now = Date.now();
    const last = Number(sessionStorage.getItem("oauth_started_at") || "0");
    const COOLDOWN_MS = 250;

    if (last && now - last < COOLDOWN_MS) {
      sessionStorage.removeItem("oauth_started_at");
      window.location.replace(next);
      return () => window.removeEventListener("pageshow", onPageShow);
    }

    sessionStorage.setItem("oauth_started_at", String(now));

    const go = async () => {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    };

    go();

    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <main style={ui.shell}>
      <Background />

      <div style={ui.center}>
        <div style={ui.card}>
          <div style={ui.kicker}>AUTH</div>

          <div style={ui.spinnerWrap}>
            <div style={ui.spinner} />
          </div>

          <h1 style={ui.title}>Redirecting to Google…</h1>
          <p style={ui.subtitle}>Secure OAuth handshake in progress.</p>

          <div style={ui.footerRow}>
            <span style={ui.footerPill}>OAuth 2.0</span>
            <span style={ui.footerPill}>Google Provider</span>
            <span style={ui.footerPill}>Supabase</span>
          </div>

          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
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

const ui = {
  shell: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
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
    width: "min(560px, 92vw)",
    borderRadius: 28,
    padding: 28,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 18px 70px rgba(0,0,0,0.55)",
    backdropFilter: "blur(10px)",
    textAlign: "center",
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
    marginBottom: 18,
  } satisfies CSSProperties,

  spinnerWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 20,
  } satisfies CSSProperties,

  spinner: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    border: "4px solid rgba(255,255,255,0.2)",
    borderTopColor: "#fff",
    animation: "spin 0.9s linear infinite",
  } satisfies CSSProperties,

  title: {
    fontSize: 36,
    fontWeight: 950,
    letterSpacing: -1,
    marginBottom: 10,
  } satisfies CSSProperties,

  subtitle: {
    opacity: 0.75,
    fontSize: 15,
    lineHeight: 1.5,
  } satisfies CSSProperties,

  footerRow: {
    marginTop: 20,
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
    opacity: 0.9,
  } satisfies CSSProperties,

  footerPill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    opacity: 0.85,
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