export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (!token) return localStorage.removeItem('token');
  localStorage.setItem('token', token);
}
