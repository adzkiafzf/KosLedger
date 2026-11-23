// Token Sanctum + data user. remember=true -> localStorage (tetap login),
// remember=false -> sessionStorage (hilang saat tab ditutup).
const TOKEN_KEY = 'kosledger.token';
const USER_KEY = 'kosledger.user';

const read = (k) => sessionStorage.getItem(k) ?? localStorage.getItem(k);

export const getToken = () => read(TOKEN_KEY);

export function getUser() {
  try {
    return JSON.parse(read(USER_KEY));
  } catch {
    return null;
  }
}

export function setSession(user, token, remember = true) {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  });
}

export const isLoggedIn = () => Boolean(getToken() && getUser());
