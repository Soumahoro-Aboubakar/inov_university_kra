const request = async (path, options = {}) => {
  const token = localStorage.getItem("kra-token");
  const response = await fetch(`/api${path}`, {
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
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || "Une erreur est survenue.");
    error.payload = data;
    throw error;
  }
  return response.status === 204 ? null : response;
};
export const api = {
  get: async (path) => (await request(path)).json(),
  post: async (path, body) =>
    (
      await request(path, {
        method: "POST",
        body: body instanceof FormData ? body : JSON.stringify(body),
      })
    ).json(),
  patch: async (path, body) =>
    (
      await request(path, { method: "PATCH", body: JSON.stringify(body) })
    ).json(),
  delete: (path) => request(path, { method: "DELETE" }),
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
