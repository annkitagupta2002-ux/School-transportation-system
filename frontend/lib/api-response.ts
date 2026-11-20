/** Read API responses without assuming that proxies and server errors return JSON. */
export async function readApiJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) {
    if (!response.ok) throw httpError(response);
    throw new Error("The transport service returned an empty response.");
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    if (!response.ok) throw httpError(response, body);
    throw new Error("The transport service returned an invalid response. Please try again.");
  }
}

function httpError(response: Response, body = ""): Error {
  const message = body.trim();
  if (/^internal server error$/i.test(message) || response.status >= 500) {
    return new Error(`Transport service is temporarily unavailable (HTTP ${response.status}). Check that the API server and database are running, then try again.`);
  }
  return new Error(message || `Request failed (HTTP ${response.status}).`);
}
