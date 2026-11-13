export function formatPrice(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "Price unavailable"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}
