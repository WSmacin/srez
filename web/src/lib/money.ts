export function money(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

export function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function formatDateRu(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function formatMonthYearRu(d: Date): string {
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}
