(function () {
  const existing = window.Auth.getSession();
  if (existing) {
    window.location.href = existing.role === 'admin' ? 'admin.html' : 'secretaria.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const session = window.Auth.login(username, password);

    if (!session) {
      errorBox.textContent = 'Usuario o contraseña incorrectos.';
      errorBox.style.display = 'block';
      return;
    }

    window.location.href = session.role === 'admin' ? 'admin.html' : 'secretaria.html';
  });
})();
