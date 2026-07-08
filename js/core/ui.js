// Helpers de UI compartidos entre secretaria.js y admin.js: toasts y apertura/cierre de modales.
(function () {
  function ensureToastStack() {
    let stack = document.getElementById('toastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toastStack';
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showToast(message, type) {
    const stack = ensureToastStack();
    const toast = document.createElement('div');
    toast.className = `toast${type === 'ok' ? ' toast-ok' : type === 'danger' ? ' toast-danger' : ''}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 200ms ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- Paginación genérica para tablas ---
  function paginate(list, page, pageSize) {
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const start = (clampedPage - 1) * pageSize;
    return { items: list.slice(start, start + pageSize), page: clampedPage, totalPages };
  }

  function renderPagination(container, page, totalPages, onChange) {
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <button class="btn btn-ghost btn-sm" type="button" data-page-action="prev" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="pagination-info">Página ${page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" type="button" data-page-action="next" ${page >= totalPages ? 'disabled' : ''}>Siguiente →</button>
    `;
    container.querySelector('[data-page-action="prev"]').addEventListener('click', () => onChange(page - 1));
    container.querySelector('[data-page-action="next"]').addEventListener('click', () => onChange(page + 1));
  }

  function openModal(overlay) {
    overlay.classList.add('is-open');
  }

  function closeModal(overlay) {
    overlay.classList.remove('is-open');
  }

  function initHeader(session) {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = session.nombre;

    const adminLink = document.getElementById('adminLink');
    if (adminLink) adminLink.style.display = session.role === 'admin' ? '' : 'none';

    const secretariaLink = document.getElementById('secretariaLink');
    if (secretariaLink) secretariaLink.style.display = session.role === 'admin' ? '' : 'none';

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.Auth.logout();
        window.location.href = 'login.html';
      });
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Esto borra todos los cambios hechos durante la demo y vuelve a sembrar los datos de ejemplo. ¿Continuar?')) {
          window.Data.resetAndReseed();
          showToast('Datos de la demo reiniciados.', 'ok');
          setTimeout(() => window.location.reload(), 600);
        }
      });
    }
  }

  window.UI = { showToast, openModal, closeModal, initHeader, paginate, renderPagination };
})();
