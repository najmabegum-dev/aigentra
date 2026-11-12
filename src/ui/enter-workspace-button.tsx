"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export function EnterWorkspaceButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEnterWorkspace = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error("Failed to create workspace");
      }

      router.push("/policies");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Unable to initialize demo workspace. Please try again.");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleEnterWorkspace}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[4px] bg-signal hover:opacity-90 active:opacity-100 text-[#0B0C0E] font-mono font-bold text-xs transition-opacity duration-150 disabled:opacity-40 disabled:cursor-not-allowed group focus:outline-none focus:ring-1 focus:ring-signal cursor-pointer"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-[#0B0C0E]" strokeWidth={1.25} />
          <span>Provisioning Secure Workspace...</span>
        </>
      ) : (
        <>
          <span>Enter demo workspace</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-[#0B0C0E]" strokeWidth={1.25} />
        </>
      )}
    </button>
  );
}
