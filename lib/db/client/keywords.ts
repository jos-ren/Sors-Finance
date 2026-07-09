/**
 * Client-side API wrapper for keyword operations
 */

export async function deleteAllKeywords(): Promise<{ cleared: number }> {
  const res = await fetch("/api/keywords?all=true", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete all keywords");
  const { data } = await res.json();
  return data;
}
