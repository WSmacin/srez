import { createClient } from "@supabase/supabase-js";

// Public anon credentials (RLS-protected). Overridable via Vite env for local forks.
const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://norqhnglvxrniivsaglf.supabase.co";
const anon =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcnFobmdsdnhybmlpdnNhZ2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTg3NzYsImV4cCI6MjEwODk3NDc3Nn0.3LM9A23aIaCcE8DwFti4si-_PJt8VNbPyEURviui8y8";

const FETCH_TIMEOUT_MS = 12000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const parent = init?.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
