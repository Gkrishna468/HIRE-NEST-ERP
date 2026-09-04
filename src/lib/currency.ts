/**
 * Centralized Indian Rupee (INR / ₹) Currency & Financial Formatting Utility for HireNestOS.
 * Enforces Indian numbering system:
 * - ₹15,000
 * - ₹1,50,000 (1.5 Lakh)
 * - ₹10,00,000 (10 Lakh)
 * - ₹84,00,000 (84 Lakh)
 * - ₹1,00,00,000 (1 Crore)
 */

/**
 * Formats any numeric value into Indian Rupees (INR / ₹) with standard en-IN grouping.
 * Example: 15000 -> "₹15,000", 150000 -> "₹1,50,000", 8400000 -> "₹84,00,000"
 */
export function formatINR(
  value: number | string | null | undefined,
  options?: {
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  }
): string {
  if (value === null || value === undefined || value === "") return "₹0";

  const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]+/g, ""));
  if (isNaN(num)) return "₹0";

  const maxDigits = options?.maximumFractionDigits ?? 0;
  const showSymbol = options?.showSymbol ?? true;

  if (!showSymbol) {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: maxDigits,
      minimumFractionDigits: 0,
    }).format(num);
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: 0,
  }).format(num);
}

/**
 * Formats large amounts into readable Indian denominations:
 * - >= 1,00,00,000 -> ₹X.XX Cr
 * - >= 1,00,000    -> ₹X.X L
 * - >= 1,000       -> ₹X,XXX (standard en-IN)
 */
export function formatCompactINR(
  value: number | string | null | undefined,
  options?: { decimals?: number }
): string {
  if (value === null || value === undefined || value === "") return "₹0";

  const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]+/g, ""));
  if (isNaN(num)) return "₹0";

  const decimals = options?.decimals ?? 2;

  if (Math.abs(num) >= 10000000) {
    const cr = (num / 10000000).toFixed(decimals).replace(/\.?0+$/, "");
    return `₹${cr} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    const l = (num / 100000).toFixed(options?.decimals ?? 1).replace(/\.?0+$/, "");
    return `₹${l} L`;
  }

  return formatINR(num);
}

/**
 * Parses any incoming string or number and returns a clean numeric value.
 */
export function parseINRValue(val: any, fallback = 0): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely formats any budget representation (string, number, or { amount, period, currency } object)
 * into a safe, human-readable display string in Indian format.
 * Prevents React child rendering errors when budget is an object.
 */
export function formatBudget(budget: any, fallback = "Competitive"): string {
  if (budget === null || budget === undefined || budget === "") return fallback;
  
  // If it's already a string
  if (typeof budget === "string") {
    const trimmed = budget.trim();
    if (!trimmed || trimmed.startsWith("[object")) return fallback;
    return trimmed;
  }

  // If it's a number
  if (typeof budget === "number") {
    if (budget <= 0) return fallback;
    if (budget <= 150) {
      return `₹${budget} LPA`;
    }
    return formatINR(budget);
  }

  // If it's an object with keys like { period, amount, currency }
  if (typeof budget === "object") {
    const amount = budget.amount ?? budget.clientBudget ?? budget.min ?? budget.value;
    const period = budget.period || "LPA";
    const currencyStr = "₹";

    if (amount !== undefined && amount !== null && amount !== "" && Number(amount) > 0) {
      const num = Number(amount);
      if (!isNaN(num)) {
        if (num <= 150) {
          return `${currencyStr}${num} ${period}`;
        }
        return `${formatINR(num)} ${period}`;
      }
      return `${currencyStr}${amount} ${period}`;
    }

    // Check if there are other string fields like label or text
    if (typeof budget.text === "string" && budget.text) return budget.text;
    if (typeof budget.label === "string" && budget.label) return budget.label;

    return fallback;
  }

  return String(budget);
}

export default formatINR;
