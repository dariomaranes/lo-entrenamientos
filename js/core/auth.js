// Autenticación de staff para el prototipo: usuarios hardcodeados en memoria, sesión en
// sessionStorage (se pierde al cerrar la pestaña, ideal para repetir la demo).
(function () {
  const SESSION_KEY = 'loent:session';

  const USERS = [
    { username: 'admin', password: 'admin', role: 'admin', nombre: 'Administración' },
    { username: 'secretaria', password: 'secretaria', role: 'secretaria', nombre: 'Secretaría' },
  ];

  function login(username, password) {
    const user = USERS.find(
      (u) => u.username === username.trim().toLowerCase() && u.password === password
    );
    if (!user) return null;
    const session = {
      username: user.username,
      role: user.role,
      nombre: user.nombre,
      loginAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // Llamar al principio de cada página protegida. Redirige a login.html si no hay
  // sesión válida o el rol no está permitido.
  function requireRole(allowedRoles) {
    const session = getSession();
    if (!session || !allowedRoles.includes(session.role)) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }

  window.Auth = { USERS, login, logout, getSession, requireRole };
})();
