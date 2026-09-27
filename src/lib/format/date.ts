/** "2025-03-14" → "2025.03.14". 값이 없으면 "—" */
export function formatDate(value: string | null): string {
  return value ? value.replaceAll("-", ".") : "—";
}
