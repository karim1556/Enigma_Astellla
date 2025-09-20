// Lightweight API client for the MediGuide server
// Reads base URL from Vite env VITE_API_URL, defaults to http://localhost:9090

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:9090';

async function getAuthToken(): Promise<string | null> {
  // Prefer Clerk session token if available (no React hooks here)
  try {
    // @ts-ignore
    const getClerkToken = async (): Promise<string | null> => {
      const clerk = (window as any).Clerk;
      if (!clerk) return null;
      try { if (typeof clerk.load === 'function') { await clerk.load(); } } catch {}
      // Wait up to ~3s for Clerk to initialize and create a session
      const start = Date.now();
      while ((!clerk.session) && Date.now() - start < 3000) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (clerk.session) {
        try {
          let t = await clerk.session.getToken();
          if (!t) {
            // Retry with skipCache for freshness
            t = await clerk.session.getToken({ skipCache: true } as any);
          }
          if (t) return t as string;
        } catch {}
      }
      return null;
    };
    const token = await getClerkToken();
    if (token) return token;
  } catch {}
  // Fallback: legacy localStorage token (until Clerk is fully rolled out)
  try {
    return localStorage.getItem('token');
  } catch { return null; }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || json.error || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  // @ts-ignore - caller may know
  return res.text();
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
