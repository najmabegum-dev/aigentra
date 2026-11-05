import { validateEnv } from "@/lib/env";

export default function HomePage() {
  const { env, integrations, missingIntegrations } = validateEnv(process.env);
  const paymentMode =
    env?.PAYMENT_MODE ??
    (process.env.PAYMENT_MODE === "paypal" ? "paypal" : "dev_stub");

  return (
    <div className="flex-1 flex flex-col items-center">
      {/* Purple SANDBOX banner */}
      <section
        role="region"
        aria-label="Sandbox Environment"
        className="w-full bg-status-sandbox text-white font-semibold py-2 px-4 text-center tracking-wider uppercase text-xs shadow-sm"
      >
        SANDBOX ENVIRONMENT — Settlement Stand-In Only — No Real Funds Moved
      </section>

      {/* Red DEV STUB banner (shows only when PAYMENT_MODE=dev_stub) */}
      {paymentMode === "dev_stub" && (
        <aside
          role="alert"
          aria-label="Development Stub Mode Warning"
          className="w-full bg-red-600 text-white font-bold py-2.5 px-4 text-center tracking-wider uppercase text-sm shadow-md"
        >
          DEV STUB — NOT PAYPAL
        </aside>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 max-w-4xl w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-primary text-xs font-semibold mb-6">
          <span>Mode: {paymentMode.toUpperCase()}</span>
          <span>•</span>
          <span>Phase A: Foundation</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl mb-3">
          AIGENTRA
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.
        </p>

        {/* Integration Status Card */}
        <div className="bg-surface rounded-card border border-gray-200 p-6 sm:p-8 shadow-sm max-w-xl w-full text-left">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
            <h2 className="text-base font-bold text-ink">System Status & Integrations</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-status-allow border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-status-allow" />
              Healthy
            </span>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground font-medium">Payment Execution</span>
              <span
                className={`font-semibold text-xs px-2.5 py-1 rounded-full ${
                  paymentMode === "paypal"
                    ? "bg-emerald-50 text-status-allow border border-emerald-200"
                    : "bg-amber-50 text-status-approval border border-amber-200"
                }`}
              >
                {paymentMode === "paypal" ? "PayPal Orders v2" : "Dev Stub Gateway"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground font-medium">Database</span>
              <span
                className={`text-xs font-semibold ${
                  integrations.database ? "text-status-allow" : "text-status-deny"
                }`}
              >
                {integrations.database ? "Connected" : "Unconfigured"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground font-medium">PayPal Sandbox API</span>
              <span
                className={`text-xs font-semibold ${
                  integrations.paypal ? "text-status-allow" : "text-muted-foreground"
                }`}
              >
                {integrations.paypal ? "Live Sandbox" : "Dev Stub Active"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground font-medium">Gemini AI Engine</span>
              <span
                className={`text-xs font-semibold ${
                  integrations.gemini ? "text-status-allow" : "text-muted-foreground"
                }`}
              >
                {integrations.gemini ? "API Connected" : "AI Replay Mode Active"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground font-medium">Channel3 Discovery</span>
              <span
                className={`text-xs font-semibold ${
                  integrations.channel3 ? "text-status-allow" : "text-muted-foreground"
                }`}
              >
                {integrations.channel3 ? "Live Catalog" : "Seeded Catalog Active"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground font-medium">AG Studio Control Tower</span>
              <span
                className={`text-xs font-semibold ${
                  integrations.agStudio ? "text-status-allow" : "text-muted-foreground"
                }`}
              >
                {integrations.agStudio ? "Licensed" : "Evaluation / Watermark"}
              </span>
            </div>
          </div>

          {missingIntegrations.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-input p-4 text-xs text-amber-900">
              <p className="font-semibold mb-1">
                Graceful Degradation Notice ({missingIntegrations.length} optional key{missingIntegrations.length > 1 ? "s" : ""} unconfigured):
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {missingIntegrations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2 text-amber-700 text-[11px]">
                The app runs cleanly with local dev stubs, seeded catalog, and replay mode without crashing.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
