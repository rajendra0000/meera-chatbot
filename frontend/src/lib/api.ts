const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as T;
}

export function fileUrl(path: string) {
  return `${API_URL}${path}`;
}
