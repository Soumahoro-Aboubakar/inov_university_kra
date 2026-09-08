const readResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  if (!body) return null;
  if (!contentType.includes("application/json")) return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

const request = async (path, options = {}) => {
  const token = localStorage.getItem("kra-token");
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const data = await readResponse(response);
    const message =
      data && typeof data === "object" && data.message
        ? data.message
        : `Erreur ${response.status} lors de la communication avec l'API.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return response;
};
export const api = {
  get: async (path) => readResponse(await request(path)),
  post: async (path, body) =>
    readResponse(
      await request(path, {
        method: "POST",
        body: body instanceof FormData ? body : JSON.stringify(body),
      }),
    ),
  patch: async (path, body) =>
    readResponse(
      await request(path, { method: "PATCH", body: JSON.stringify(body) }),
    ),
  delete: (path) => request(path),
  blob: async (path) => (await request(path)).blob(),
  download: async (path, filename) => {
    const blob = await (await request(path)).blob();
    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    });
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
