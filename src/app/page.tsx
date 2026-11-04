export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-primary text-xs font-medium mb-6">
        <span>Phase A: Initialization</span>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl mb-4">
        AIGENTRA
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mb-8">
        The AI proposes. AIGENTRA authorizes. PayPal executes. The ledger proves.
      </p>
      <div className="p-6 bg-surface rounded-card border border-gray-200 shadow-sm max-w-md w-full text-left">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wider mb-2">
          Architecture Status
        </h2>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Next.js App Router (TypeScript Strict)</li>
          <li>• Four Rooms isolation configured</li>
          <li>• Tailored Tailwind Design Tokens</li>
          <li>• Vitest test runner ready</li>
        </ul>
      </div>
    </div>
  );
}
