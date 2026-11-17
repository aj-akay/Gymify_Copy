export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV || import.meta.env.VITE_GITHUB_PAGES !== 'true' ? '/api/v1' : '')
).replace(/\/+$/, '');

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function fetchApi(path, { signal } = {}) {
  if (!API_BASE_URL) {
    throw new Error('Set VITE_API_BASE_URL to a hosted GYMIFY API URL before building for GitHub Pages.');
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach the GYMIFY API. Check that the backend is running and try again.');
  }

  let body;
  try {
    body = await response.json();
  } catch {
    const isLocalDev = import.meta.env.DEV && API_BASE_URL === '/api/v1';
    if (isLocalDev) {
      throw new Error('The GYMIFY API is not responding. Start the API and frontend together with `npm run dev`, then configure Supabase in `backend/.env`.');
    }
    throw new Error('The GYMIFY API returned an invalid response. Check that VITE_API_BASE_URL points to the API, not the frontend site.');
  }

  if (!response.ok) {
    throw new ApiError(
      body.error?.message || `The GYMIFY API request failed (${response.status}).`,
      response.status,
      body.error?.code,
    );
  }
  if (!Object.hasOwn(body, 'data')) {
    throw new Error('The GYMIFY API response is missing its data.');
  }
  return body.data;
}
