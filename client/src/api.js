const BASE = import.meta.env.VITE_API_URL || '';

export const getToken = () => localStorage.getItem('inboxly_token');
export const setToken = (t) => (t ? localStorage.setItem('inboxly_token', t) : localStorage.removeItem('inboxly_token'));

async function request(method, path, body) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error("Can't reach the server. Check your connection and try again.");
    err.network = true;
    throw err;
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/logout')) window.dispatchEvent(new Event('inboxly:logout'));
    const err = new Error(data?.error || `Something went wrong (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function revokeSession(token) {
  if (!token) return;
  fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}',
    keepalive: true,
  }).catch(() => {});
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  patch: (p, b = {}) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};
