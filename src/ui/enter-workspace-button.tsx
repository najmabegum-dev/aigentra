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
      className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-input bg-primary hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-sm transition-colors duration-standard shadow-sm disabled:opacity-70 disabled:cursor-not-allowed group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Provisioning Secure Workspace...</span>
        </>
      ) : (
        <>
          <span>Enter demo workspace</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </>
      )}
    </button>
  );
}
