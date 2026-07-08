(function () {
  const U = window.Utils;
  const D = window.Data;
  const F = window.Fees;
  const N = window.Notifications;

  const session = window.Auth.requireRole(['secretaria', 'admin']);
  if (!session) return;

  D.seedIfNeeded();
  N.seedIfNeeded();
  window.UI.initHeader(session);

  const BADGE_INFO = {
    al_dia: { label: 'Al día', cls: 'badge-ok' },
    proximo_a_vencer: { label: 'Próximo a vencer', cls: 'badge-warn' },
    vencido: { label: 'Vencido', cls: 'badge-danger' },
    sin_dias: { label: 'Sin días', cls: 'badge-info' },
    baja: { label: 'Baja', cls: 'badge-neutral' },
  };

  const REGISTRADO_POR_LABEL = { seed: 'Datos de ejemplo', admin: 'Admin', secretaria: 'Secretaría' };
  function registradoPorLabel(v) {
    return REGISTRADO_POR_LABEL[v] || v;
  }

  // --- Tabs ---
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('is-active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('is-active');
      if (btn.dataset.tab === 'clientes') renderClientesTable();
      if (btn.dataset.tab === 'pago') renderPagoClienteInfo();
      if (btn.dataset.tab === 'ingresos') renderIngresosTable();
      if (btn.dataset.tab === 'pagos') renderPagosTable();
    });
  });

  // ===================== ALTA DE CLIENTE =====================
  const altaForm = document.getElementById('altaForm');
  const altaDni = document.getElementById('altaDni');
  const altaDniError = document.getElementById('altaDniError');
  document.getElementById('altaFecha').value = U.todayISO();

  altaDni.addEventListener('input', () => {
    altaDni.value = altaDni.value.replace(/\D/g, '').slice(0, 8);
  });

  altaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const dni = altaDni.value.trim();
    altaDniError.style.display = 'none';

    if (!U.isValidDNI(dni)) {
      altaDniError.textContent = 'DNI inválido: debe tener 7 u 8 dígitos.';
      altaDniError.style.display = 'block';
      return;
    }
    if (D.dniExiste(dni)) {
      altaDniError.textContent = 'Ya existe un cliente registrado con ese DNI.';
      altaDniError.style.display = 'block';
      return;
    }

    const cliente = D.addCliente({
      nombre: document.getElementById('altaNombre').value.trim(),
      apellido: document.getElementById('altaApellido').value.trim(),
      dni,
      telefono: document.getElementById('altaTelefono').value.trim(),
      email: document.getElementById('altaEmail').value.trim(),
      plan: altaForm.querySelector('input[name="altaPlan"]:checked').value,
      fechaAlta: document.getElementById('altaFecha').value,
    });

    window.UI.showToast(`Cliente ${cliente.nombre} ${cliente.apellido} registrado correctamente.`, 'ok');
    altaForm.reset();
    document.getElementById('altaFecha').value = U.todayISO();
    populatePagoSelect();
  });

  // ===================== CLIENTES (CRUD) =====================
  const clientesTableBody = document.getElementById('clientesTableBody');
  const clientesSearch = document.getElementById('clientesSearch');
  const clientesMostrarBajas = document.getElementById('clientesMostrarBajas');
  const clientesFiltroChip = document.getElementById('clientesFiltroChip');
  const notificarVencidosBtn = document.getElementById('notificarVencidosBtn');
  const clientesPagination = document.getElementById('clientesPagination');
  const CLIENTES_PAGE_SIZE = 10;
  let filtroEstadoActivo = null;
  let clientesPage = 1;

  function clienteEstado(cliente) {
    if (!cliente.activo) return 'baja';
    return F.estadoBadge(cliente, D.getPagos(), D.getAsistencias(), new Date());
  }

  function clienteBadge(cliente) {
    return BADGE_INFO[clienteEstado(cliente)];
  }

  function renderClientesTable() {
    if (filtroEstadoActivo) {
      clientesFiltroChip.style.display = '';
      clientesFiltroChip.textContent = `Filtrando: ${BADGE_INFO[filtroEstadoActivo].label} ✕`;
    } else {
      clientesFiltroChip.style.display = 'none';
      clientesFiltroChip.textContent = '';
    }
    notificarVencidosBtn.style.display = filtroEstadoActivo === 'vencido' ? '' : 'none';

    const query = clientesSearch.value.trim().toLowerCase();
    const mostrarBajas = clientesMostrarBajas.checked;
    let clientes = D.getClientes().filter((c) => mostrarBajas || c.activo);

    if (query) {
      clientes = clientes.filter((c) => {
        const nombreCompleto = `${c.nombre} ${c.apellido}`.toLowerCase();
        return nombreCompleto.includes(query) || c.dni.includes(query);
      });
    }

    if (filtroEstadoActivo) {
      clientes = clientes.filter((c) => clienteEstado(c) === filtroEstadoActivo);
    }

    clientes.sort((a, b) => a.apellido.localeCompare(b.apellido));

    if (clientes.length === 0) {
      clientesTableBody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No se encontraron clientes.</div></td></tr>`;
      clientesPagination.innerHTML = '';
      return;
    }

    const { items: clientesPageItems, page: clientesPageClamped, totalPages: clientesTotalPages } = window.UI.paginate(
      clientes,
      clientesPage,
      CLIENTES_PAGE_SIZE
    );
    clientesPage = clientesPageClamped;
    window.UI.renderPagination(clientesPagination, clientesPage, clientesTotalPages, (newPage) => {
      clientesPage = newPage;
      renderClientesTable();
    });

    clientesTableBody.innerHTML = clientesPageItems
      .map((c) => {
        const badge = clienteBadge(c);
        return `
        <tr>
          <td>
            <div class="cell-person">
              <img class="avatar" src="${c.fotoUrl}" alt="" />
              <div>
                <div class="cell-person__name">${U.escapeHtml(c.nombre)} ${U.escapeHtml(c.apellido)}</div>
                <div class="cell-person__meta">Alta: ${U.formatDateShortEs(U.parseISODate(c.fechaAlta))}</div>
              </div>
            </div>
          </td>
          <td>${U.formatDNI(c.dni)}</td>
          <td>${c.plan === 'premium' ? 'Premium' : 'Base'}</td>
          <td><span class="badge ${badge.cls}">${badge.label}</span></td>
          <td>${U.escapeHtml(c.telefono)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-subtle btn-sm" data-action="editar" data-id="${c.id}">Editar</button>
              ${
                c.activo
                  ? `<button class="btn btn-ghost btn-sm" data-action="baja" data-id="${c.id}">Dar de baja</button>`
                  : `<button class="btn btn-ghost btn-sm" data-action="reactivar" data-id="${c.id}">Reactivar</button>`
              }
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  clientesTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const cliente = D.getClienteById(btn.dataset.id);
    if (!cliente) return;

    if (btn.dataset.action === 'editar') openEditModal(cliente);
    if (btn.dataset.action === 'baja') {
      if (confirm(`¿Dar de baja a ${cliente.nombre} ${cliente.apellido}?`)) {
        D.bajaCliente(cliente.id);
        window.UI.showToast('Cliente dado de baja.', 'ok');
        renderClientesTable();
        populatePagoSelect();
      }
    }
    if (btn.dataset.action === 'reactivar') {
      D.reactivarCliente(cliente.id);
      window.UI.showToast('Cliente reactivado.', 'ok');
      renderClientesTable();
      populatePagoSelect();
    }
  });

  clientesSearch.addEventListener(
    'input',
    U.debounce(() => {
      clientesPage = 1;
      renderClientesTable();
    }, 150)
  );
  clientesMostrarBajas.addEventListener('change', () => {
    clientesPage = 1;
    renderClientesTable();
  });

  clientesFiltroChip.addEventListener('click', () => {
    filtroEstadoActivo = null;
    clientesPage = 1;
    renderClientesTable();
  });

  document.getElementById('filtroVencidosBtn').addEventListener('click', () => {
    filtroEstadoActivo = 'vencido';
    clientesPage = 1;
    document.querySelector('.tab-btn[data-tab="clientes"]').click();
  });

  document.getElementById('notificarVencidosBtn').addEventListener('click', () => {
    const pagos = D.getPagos();
    const asistencias = D.getAsistencias();
    const vencidos = D.getClientes({ soloActivos: true }).filter(
      (c) => F.estadoBadge(c, pagos, asistencias, new Date()) === 'vencido'
    );

    if (vencidos.length === 0) {
      window.UI.showToast('No hay clientes vencidos para notificar.', 'ok');
      return;
    }

    vencidos.forEach((c) => N.notificarVencido(c));
    window.UI.showToast(
      `Se simuló el envío de WhatsApp a ${vencidos.length} cliente${vencidos.length === 1 ? '' : 's'} vencido${
        vencidos.length === 1 ? '' : 's'
      }.`,
      'ok'
    );
  });

  // --- Modal edición ---
  const editModalOverlay = document.getElementById('editModalOverlay');
  const editForm = document.getElementById('editForm');

  function openEditModal(cliente) {
    document.getElementById('editId').value = cliente.id;
    document.getElementById('editNombre').value = cliente.nombre;
    document.getElementById('editApellido').value = cliente.apellido;
    document.getElementById('editTelefono').value = cliente.telefono;
    document.getElementById('editEmail').value = cliente.email;
    editForm.querySelector(`input[name="editPlan"][value="${cliente.plan}"]`).checked = true;
    window.UI.openModal(editModalOverlay);
  }

  function closeEditModal() {
    window.UI.closeModal(editModalOverlay);
  }

  document.getElementById('editModalClose').addEventListener('click', closeEditModal);
  document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
  editModalOverlay.addEventListener('click', (e) => {
    if (e.target === editModalOverlay) closeEditModal();
  });

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    D.updateCliente(id, {
      nombre: document.getElementById('editNombre').value.trim(),
      apellido: document.getElementById('editApellido').value.trim(),
      telefono: document.getElementById('editTelefono').value.trim(),
      email: document.getElementById('editEmail').value.trim(),
      plan: editForm.querySelector('input[name="editPlan"]:checked').value,
    });
    window.UI.showToast('Cambios guardados.', 'ok');
    closeEditModal();
    renderClientesTable();
    populatePagoSelect();
  });

  // ===================== REGISTRAR PAGO =====================
  const pagoForm = document.getElementById('pagoForm');
  const pagoClienteSelect = document.getElementById('pagoCliente');
  const pagoClienteInfo = document.getElementById('pagoClienteInfo');
  document.getElementById('pagoFecha').value = U.todayISO();

  function populatePagoSelect() {
    const seleccionado = pagoClienteSelect.value;
    const clientes = D.getClientes({ soloActivos: true }).sort((a, b) => a.apellido.localeCompare(b.apellido));
    pagoClienteSelect.innerHTML =
      `<option value="">Seleccionar cliente...</option>` +
      clientes
        .map((c) => `<option value="${c.id}">${U.escapeHtml(c.apellido)}, ${U.escapeHtml(c.nombre)} — DNI ${U.formatDNI(c.dni)}</option>`)
        .join('');
    if (seleccionado) pagoClienteSelect.value = seleccionado;
  }

  function renderPagoClienteInfo() {
    const cliente = D.getClienteById(pagoClienteSelect.value);
    if (!cliente) {
      pagoClienteInfo.style.display = 'none';
      return;
    }
    const monto = F.PLAN_PRECIOS[cliente.plan];
    const periodoActual = F.periodoVigente(new Date());
    const alDia = F.estaAlDia(D.getPagos(), cliente.id, new Date());
    pagoClienteInfo.style.display = 'block';
    pagoClienteInfo.innerHTML = `
      <div class="pago-info-row"><span>Plan</span><strong>${cliente.plan === 'premium' ? 'Premium' : 'Base'}</strong></div>
      <div class="pago-info-row"><span>Monto a registrar</span><strong>${U.formatCurrencyARS(monto)}</strong></div>
      <div class="pago-info-row"><span>Período vigente</span><strong>${U.formatDateShortEs(periodoActual.inicio)} — ${U.formatDateShortEs(periodoActual.fin)}</strong></div>
      <div class="pago-info-row"><span>Estado actual</span><strong>${alDia ? 'Al día' : 'Vencido / pendiente'}</strong></div>
    `;
  }

  pagoClienteSelect.addEventListener('change', renderPagoClienteInfo);

  pagoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cliente = D.getClienteById(pagoClienteSelect.value);
    if (!cliente) {
      window.UI.showToast('Elegí un cliente antes de confirmar el pago.', 'danger');
      return;
    }
    const fecha = document.getElementById('pagoFecha').value;
    const fechaDate = U.parseISODate(fecha);
    const periodo = F.periodoParaPago(fechaDate);
    const monto = F.PLAN_PRECIOS[cliente.plan];

    const pago = D.addPago({
      clienteId: cliente.id,
      fecha,
      monto,
      plan: cliente.plan,
      periodoInicio: periodo.inicioISO,
      periodoFin: periodo.finISO,
      registradoPor: session.username,
    });

    N.notificarPagoConfirmado(cliente, pago);

    const hoyISO = U.todayISO();
    const cubreHoy = periodo.inicioISO <= hoyISO && hoyISO <= periodo.finISO;
    const periodoTxt = `${U.formatDateShortEs(periodo.inicio)} al ${U.formatDateShortEs(periodo.fin)}`;
    const aviso = cubreHoy
      ? ''
      : ` El período habilitado (${periodoTxt}) todavía no empezó, así que el cliente seguirá figurando vencido hasta esa fecha.`;
    window.UI.showToast(`Pago registrado para el período ${periodoTxt}. Email enviado a ${cliente.email}.${aviso}`, 'ok');
    pagoForm.reset();
    document.getElementById('pagoFecha').value = U.todayISO();
    pagoClienteInfo.style.display = 'none';
    renderClientesTable();
    pagosPage = 1;
    renderPagosTable();
  });

  // ===================== INGRESOS (asistencias por día) =====================
  const ingresosFecha = document.getElementById('ingresosFecha');
  const ingresosTableBody = document.getElementById('ingresosTableBody');
  const ingresosCount = document.getElementById('ingresosCount');
  const ingresosHoyTotal = document.getElementById('ingresosHoyTotal');
  const ingresosPagination = document.getElementById('ingresosPagination');
  const INGRESOS_PAGE_SIZE = 10;
  let ingresosPage = 1;
  ingresosFecha.value = U.todayISO();

  // Total de "ingresaron hoy": siempre referido al día real, independiente de qué fecha
  // esté eligiendo el filtro de la tabla de abajo.
  function renderIngresosHoyTotal() {
    const hoyISO = U.todayISO();
    ingresosHoyTotal.textContent = D.getAsistencias().filter((a) => a.fecha === hoyISO).length;
  }

  function renderIngresosTable() {
    const fechaSel = ingresosFecha.value || U.todayISO();
    const pagos = D.getPagos();
    const asistencias = D.getAsistencias();
    const delDia = asistencias
      .filter((a) => a.fecha === fechaSel)
      .map((a) => ({ asistencia: a, cliente: D.getClienteById(a.clienteId) }))
      .filter((row) => row.cliente)
      .sort((a, b) => b.asistencia.hora.localeCompare(a.asistencia.hora));

    ingresosCount.textContent = `${delDia.length} ingreso${delDia.length === 1 ? '' : 's'}`;

    if (delDia.length === 0) {
      ingresosTableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No hay ingresos registrados para esta fecha.</div></td></tr>`;
      ingresosPagination.innerHTML = '';
      return;
    }

    const { items: ingresosPageItems, page: ingresosPageClamped, totalPages: ingresosTotalPages } = window.UI.paginate(
      delDia,
      ingresosPage,
      INGRESOS_PAGE_SIZE
    );
    ingresosPage = ingresosPageClamped;
    window.UI.renderPagination(ingresosPagination, ingresosPage, ingresosTotalPages, (newPage) => {
      ingresosPage = newPage;
      renderIngresosTable();
    });

    ingresosTableBody.innerHTML = ingresosPageItems
      .map(({ asistencia, cliente }) => {
        // Días restantes y asistencia del mes en curso siempre reflejan el estado
        // ACTUAL del cliente (hoy), no el de la fecha filtrada — es "cómo está parado ahora".
        const ev = F.evaluarCliente(cliente, pagos, asistencias, new Date());
        return `
        <tr>
          <td>
            <div class="cell-person">
              <img class="avatar" src="${cliente.fotoUrl}" alt="" />
              <div>
                <div class="cell-person__name">${U.escapeHtml(cliente.nombre)} ${U.escapeHtml(cliente.apellido)}</div>
                <div class="cell-person__meta">${cliente.plan === 'premium' ? 'Premium' : 'Base'}</div>
              </div>
            </div>
          </td>
          <td>${U.formatDNI(cliente.dni)}</td>
          <td>${asistencia.hora}</td>
          <td>${ev.disponibles}</td>
          <td>${ev.usados} / ${ev.cap}</td>
        </tr>`;
      })
      .join('');
  }

  ingresosFecha.addEventListener('change', () => {
    ingresosPage = 1;
    renderIngresosTable();
  });

  // Se actualiza solo cuando el kiosko (en otra pestaña del mismo navegador) registra
  // una nueva asistencia — localStorage dispara el evento 'storage' en las demás pestañas.
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.includes('asistencias')) {
      renderIngresosTable();
      renderIngresosHoyTotal();
    }
  });

  // ===================== HISTORIAL DE PAGOS =====================
  const pagosTableBody = document.getElementById('pagosTableBody');
  const pagosPagination = document.getElementById('pagosPagination');
  const PAGOS_PAGE_SIZE = 10;
  let pagosPage = 1;

  function renderPagosTable() {
    const pagos = D.getPagos()
      .map((p) => ({ pago: p, cliente: D.getClienteById(p.clienteId) }))
      .filter((row) => row.cliente)
      .sort((a, b) => (a.pago.fecha < b.pago.fecha ? 1 : -1));

    if (pagos.length === 0) {
      pagosTableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No hay pagos registrados todavía.</div></td></tr>`;
      pagosPagination.innerHTML = '';
      return;
    }

    const { items: pagosPageItems, page: pagosPageClamped, totalPages: pagosTotalPages } = window.UI.paginate(
      pagos,
      pagosPage,
      PAGOS_PAGE_SIZE
    );
    pagosPage = pagosPageClamped;
    window.UI.renderPagination(pagosPagination, pagosPage, pagosTotalPages, (newPage) => {
      pagosPage = newPage;
      renderPagosTable();
    });

    pagosTableBody.innerHTML = pagosPageItems
      .map(
        ({ pago, cliente }) => `
      <tr>
        <td>
          <div class="cell-person">
            <img class="avatar" src="${cliente.fotoUrl}" alt="" />
            <div class="cell-person__name">${U.escapeHtml(cliente.nombre)} ${U.escapeHtml(cliente.apellido)}</div>
          </div>
        </td>
        <td>${U.formatDNI(cliente.dni)}</td>
        <td>${U.formatDateShortEs(U.parseISODate(pago.fecha))}</td>
        <td>${U.formatDateShortEs(U.parseISODate(pago.periodoInicio))} — ${U.formatDateShortEs(U.parseISODate(pago.periodoFin))}</td>
        <td>${pago.plan === 'premium' ? 'Premium' : 'Base'}</td>
        <td>${U.formatCurrencyARS(pago.monto)}</td>
        <td class="text-muted">${U.escapeHtml(registradoPorLabel(pago.registradoPor))}</td>
      </tr>`
      )
      .join('');
  }

  // --- Init ---
  populatePagoSelect();
  renderClientesTable();
  renderIngresosTable();
  renderIngresosHoyTotal();
  renderPagosTable();
})();
