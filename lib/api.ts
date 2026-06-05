export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    ...init
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erro ao conversar com a API.");
  }

  return data as T;
}

export function loginWithDiscord() {
  return apiFetch<{ url: string }>("/api/auth/discord", { method: "POST" }).then((data) => {
    window.location.href = data.url;
  });
}
