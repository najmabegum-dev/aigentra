import React from "react";

interface PersistentBannersProps {
  paymentMode?: "paypal" | "dev_stub";
}

export function PersistentBanners({ paymentMode = "dev_stub" }: PersistentBannersProps) {
  return (
    <div className="w-full flex flex-col z-50">
      {/* Persistent Purple SANDBOX banner */}
      <section
        role="region"
        aria-label="Sandbox Environment Banner"
        className="w-full bg-[#6D28D9] dark:bg-[#7C3AED] text-white font-medium py-2 px-4 text-center tracking-wider uppercase text-xs shadow-sm flex items-center justify-center gap-2"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>SANDBOX ENVIRONMENT — Settlement Stand-In Only — No Real Funds Moved</span>
      </section>

      {/* Red DEV STUB banner (shows only when PAYMENT_MODE=dev_stub) */}
      {paymentMode === "dev_stub" && (
        <aside
          role="alert"
          aria-label="Development Stub Mode Warning"
          className="w-full bg-[#DC2626] text-white font-bold py-2 px-4 text-center tracking-wider uppercase text-xs shadow-md flex items-center justify-center gap-2"
        >
          <span className="px-1.5 py-0.5 rounded bg-black/25 text-[10px] tracking-normal">STUB GATEWAY</span>
          <span>DEV STUB — NOT PAYPAL (Real PayPal Sandbox calls are disabled)</span>
        </aside>
      )}
    </div>
  );
}
