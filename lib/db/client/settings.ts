/**
 * Client-side API wrapper for settings operations
 */

export async function getSetting(key: string): Promise<string | null> {
  const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error("Failed to fetch setting");
  const { data } = await res.json();
  return data;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error("Failed to save setting");
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  const { data } = await res.json();
  return data;
}
