/**
 * Global call counter for payment gateway invocations (PRD §9.4, F10).
 * Safely tracks payment requests across test suites and the Attack Lab
 * without exposing execute room internals or payment credentials.
 */

let globalGatewayCallCount = 0;

export function incrementGatewayCallCount(): void {
  globalGatewayCallCount++;
}

export function getGatewayCallCount(): number {
  return globalGatewayCallCount;
}

export function resetGatewayCallCount(): void {
  globalGatewayCallCount = 0;
}
