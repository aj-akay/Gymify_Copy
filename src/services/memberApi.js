import { API_BASE_URL } from './api';
import { supabase } from '../lib/supabase';

export const memberApiEnabled = Boolean(supabase);
export const inquiryApiEnabled = Boolean(API_BASE_URL) && import.meta.env.VITE_INQUIRY_API_ENABLED === 'true';

export async function memberRequest(path, { method = 'GET', body, signal, accessToken } = {}) {
  if (!API_BASE_URL) {
    throw new Error('Set VITE_API_BASE_URL to a hosted GYMIFY API URL before building for GitHub Pages.');
  }
  let token = accessToken;
  if (!token && supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    token = data.session?.access_token;
  }
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
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
  return typeof value === 'string'
    && /^\/(compare|saved|plans|trainer\/dashboard|trainers(?:\/[a-z0-9-]+)?|gyms(?:\/[a-z0-9-]+)?)$/.test(value)
    ? value
    : '/saved';
}
