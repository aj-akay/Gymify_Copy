// Frontend contract only. Enable after your team implements docs/FRONTEND_API.md.
import { API_BASE_URL } from '../api';

export const memberApiEnabled = import.meta.env.VITE_MEMBER_API_ENABLED === 'true';
export const inquiryApiEnabled = import.meta.env.VITE_INQUIRY_API_ENABLED === 'true';

export async function memberRequest(path, { method = 'GET', body, signal } = {}) {
  if (!API_BASE_URL) {
    throw new Error('Set VITE_API_BASE_URL to the deployed GYMIFY API URL before building the production frontend.');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include', // Your backend owns secure, HttpOnly session cookies.
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status}). Please try again.`);
    error.status = response.status;
    throw error;
  }
  if (!payload || !Object.hasOwn(payload, 'data')) throw new Error('Unexpected response from the server.');
  return payload.data;
}

export function safeReturnPath(value) {
  // Allow only the app's public detail pages and member destinations.
  return typeof value === 'string' && /^\/(compare|saved|gyms(?:\/[a-z0-9-]+)?)$/.test(value) ? value : '/saved';
}
