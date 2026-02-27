"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  useEffect(() => {
    const finish = async () => {
      await supabase.auth.getSession();

      const next =
        sessionStorage.getItem("post_auth_next") ||
        new URLSearchParams(window.location.search).get("next") ||
        "/admin";

      sessionStorage.removeItem("post_auth_next");
      window.location.replace(next);
    };

    finish();
  }, []);

  return null;
}
