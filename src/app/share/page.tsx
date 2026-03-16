"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function SharePage() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const title = params.get("title") || "";
    const text = params.get("text") || "";
    const url = params.get("url") || "";

    const parts = [title, text, url].filter(Boolean);
    const combined = parts.join("\n\n");

    if (combined) {
      sessionStorage.setItem("clr_shared_text", combined);
    }

    router.replace("/");
  }, [params, router]);

  return (
    <div className="h-dvh flex items-center justify-center bg-bg text-text-muted text-sm">
      Preparing shared content...
    </div>
  );
}
