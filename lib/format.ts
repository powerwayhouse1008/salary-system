export const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

export function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function textValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
export function isValidYearMonth(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
