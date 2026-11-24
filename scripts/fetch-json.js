/*
 * Fetching JSON with a timeout, shared by blocks and scripts: a GET, or a POST of a JSON body, its
 * failures (HTTP, network, timeout, a service's error object) as errors with a status.
 */

/**
 * Fetches JSON, giving up after `timeout` ms. With `body`, it's a POST of that object as JSON. A
 * `signal` cancels it early (e.g. a newer request replaces it). Rejects with an Error carrying
 * `status` (HTTP status, 0 for a network failure, the timeout or a cancel); an answer that isn't
 * JSON, or a 200 with the service's error object (`{ errorCode, message }`, or nested as
 * `{ error: { errorCode, message, details } }`, kept as the Error's `service`), is a failure too.
 * @param {string} url
 * @param {number} timeout
 * @param {{body?: Object, signal?: AbortSignal}} [options]
 * @returns {Promise<Object>}
 */
export default async function fetchJson(url, timeout, { body, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      ...(body && {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    if (!resp.ok) throw Object.assign(new Error(`HTTP ${resp.status}`), { status: resp.status });
    const json = await resp.json();
    const failure = json?.errorCode ? json : json?.error && typeof json.error === 'object' && json.error;
    if (failure) {
      throw Object.assign(new Error(`${failure.errorCode || 'error'}: ${failure.message || ''}`), { status: resp.status, service: failure });
    }
    return json;
  } catch (error) {
    if (error.status === undefined) error.status = 0;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
