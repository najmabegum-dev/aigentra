/**
 * Money utilities for AIGENTRA.
 *
 * Golden Rule 4: Money is integer cents plus ISO currency. Never floats.
 * Convert to the string "84.99" only at the PayPal boundary.
 *
 * Golden Rule 5: Totals and prices are always recomputed on the server
 * from server-fetched data. Model output and client input are never trusted for money.
 */

export class MoneyError extends Error {
  constructor(message: string, public readonly code: string = "INVALID_MONEY") {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Asserts that a value is a valid integer cents value.
 */
export function assertIntegerCents(cents: number, allowNegative = false): void {
  if (typeof cents !== "number" || !Number.isSafeInteger(cents)) {
    throw new MoneyError(
      `Invalid money cents: expected safe integer, received ${cents}`,
      "INVALID_CENTS"
    );
  }
  if (!allowNegative && cents < 0) {
    throw new MoneyError(
      `Invalid money cents: cannot be negative, received ${cents}`,
      "NEGATIVE_CENTS"
    );
  }
}

/**
 * Safely sums an array of integer cents, ensuring no floats or overflows.
 */
export function safeAddCents(...amounts: number[]): number {
  let total = 0;
  for (const amt of amounts) {
    assertIntegerCents(amt, true);
    total += amt;
    if (!Number.isSafeInteger(total)) {
      throw new MoneyError("Integer overflow in safeAddCents", "MONEY_OVERFLOW");
    }
  }
  return total;
}

/**
 * Safely multiplies unit cents by quantity.
 */
export function safeMultiplyCents(unitCents: number, quantity: number): number {
  assertIntegerCents(unitCents, false);
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 0) {
    throw new MoneyError(
      `Invalid quantity: expected non-negative integer, received ${quantity}`,
      "INVALID_QUANTITY"
    );
  }
  const total = unitCents * quantity;
  if (!Number.isSafeInteger(total)) {
    throw new MoneyError("Integer overflow in safeMultiplyCents", "MONEY_OVERFLOW");
  }
  return total;
}

/**
 * Converts integer cents to a standard decimal string (e.g. 8499 -> "84.99")
 * strictly formatted for the PayPal Orders v2 API boundary.
 */
export function centsToPayPalString(cents: number): string {
  assertIntegerCents(cents, false);
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Formats integer cents to display decimal string (alias for centsToPayPalString).
 */
export const formatMoney = centsToPayPalString;

/**
 * Parses a decimal string (e.g. "84.99", "84.9", "84") into integer cents without floating point arithmetic.
 */
export function parseStringToCents(amountStr: string): number {
  if (typeof amountStr !== "string") {
    throw new MoneyError(
      `Expected string for amount, received ${typeof amountStr}`,
      "INVALID_AMOUNT_STRING"
    );
  }

  const trimmed = amountStr.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);

  if (!match) {
    throw new MoneyError(
      `Invalid money string format: "${amountStr}". Expected e.g. "84.99" or "84"`,
      "INVALID_FORMAT"
    );
  }

  const wholeStr = match[1];
  const decimalStr = match[2] || "";

  const whole = parseInt(wholeStr, 10);
  if (!Number.isSafeInteger(whole)) {
    throw new MoneyError("Integer overflow in whole part", "MONEY_OVERFLOW");
  }

  // Pad decimal part to exactly 2 digits: "5" -> 50, "50" -> 50, "" -> 0
  const paddedDecimal = decimalStr.padEnd(2, "0");
  const cents = parseInt(paddedDecimal, 10);

  const totalCents = whole * 100 + cents;
  if (!Number.isSafeInteger(totalCents)) {
    throw new MoneyError("Integer overflow calculating total cents", "MONEY_OVERFLOW");
  }

  return totalCents;
}

/**
 * Validates ISO 4217 3-letter currency code (only "USD" is supported for PayPal sandbox).
 */
export function validateCurrency(currency: string): "USD" {
  if (currency !== "USD") {
    throw new MoneyError(
      `Unsupported currency: "${currency}". AIGENTRA sandbox requires USD only.`,
      "INVALID_CURRENCY"
    );
  }
  return currency;
}
