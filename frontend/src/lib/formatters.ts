export function formatSupplierDisplayName(
  supplier:
    | { name?: string | null; companyName?: string | null }
    | null
    | undefined,
) {
  const name = supplier?.name?.trim();
  if (!name) return "";
  const companyName = supplier?.companyName?.trim();
  return companyName ? `${name} (${companyName})` : name;
}
