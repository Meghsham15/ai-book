async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    throw new Error("Sign in to continue.")
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new Error(payload?.error || "Something went wrong. Please try again.")
  }
  return payload as T
}

export function getJson<T>(url: string) {
  return fetch(url).then(parseResponse<T>)
}

export function postJson<T>(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parseResponse<T>)
}

export function patchJson<T>(url: string, body: unknown) {
  return fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parseResponse<T>)
}

export function deleteJson<T>(url: string) {
  return fetch(url, { method: "DELETE" }).then(parseResponse<T>)
}

export function postForm<T>(url: string, body: FormData) {
  return fetch(url, { method: "POST", body }).then(parseResponse<T>)
}
