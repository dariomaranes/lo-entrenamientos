(function () {
  const U = window.Utils;
  const D = window.Data;
  const F = window.Fees;

  window.Data.seedIfNeeded();
  if (window.Notifications) window.Notifications.seedIfNeeded();

  const dniInput = document.getElementById('dniInput');
  const dniForm = document.getElementById('dniForm');
  const numpad = document.getElementById('numpad');
  const numpadClear = document.getElementById('numpadClear');
  const resultOverlay = document.getElementById('resultOverlay');
  const resultModal = document.getElementById('resultModal');
  const staffLink = document.querySelector('.kiosko-staff-link');

  // --- Vuelta al panel de origen (si se llegó acá con un botón "Ingreso de cliente") ---
  const returnTo = new URLSearchParams(window.location.search).get('return');
  if (returnTo === 'secretaria' || returnTo === 'admin') {
    staffLink.textContent = `← Volver a ${returnTo === 'secretaria' ? 'Secretaría' : 'Admin'}`;
    staffLink.href = `${returnTo}.html`;
  }

  // --- Foco permanente en el input, modo kiosko ---
  function refocus() {
    if (document.activeElement !== dniInput && !resultOverlay.classList.contains('is-open')) {
      dniInput.focus({ preventScroll: true });
    }
  }
  dniInput.focus();
  setInterval(refocus, 1000);
  dniInput.addEventListener('blur', () => setTimeout(refocus, 150));

  document.addEventListener('click', (e) => {
    if (resultOverlay.classList.contains('is-open')) return;
    if (numpad.contains(e.target) || e.target.closest('.kiosko-staff-link')) return;
    refocus();
  });

  // El resultado (éxito o error) queda fijo en pantalla — no se cierra solo ni con un toque,
  // así el staff que pasa cerca llega a leer qué pasó. Se cierra con cualquier tecla, para no
  // depender de que alguien lo toque a propósito.
  document.addEventListener('keydown', (e) => {
    if (!resultOverlay.classList.contains('is-open')) return;
    e.preventDefault();
    closeModal();
  });

  // En touch (tablet/celular) no hay tecla física que presionar, así que el mismo cierre
  // también se puede disparar tocando el botón "Continuar" del propio modal.
  resultModal.addEventListener('click', (e) => {
    if (e.target.closest('.kiosko-result__continue')) closeModal();
  });

  numpadClear.addEventListener('click', () => {
    dniInput.value = '';
    dniInput.focus();
  });

  dniInput.addEventListener('input', () => {
    dniInput.value = dniInput.value.replace(/\D/g, '').slice(0, 8);
  });

  // --- Submit / evaluación ---
  dniForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleScan(dniInput.value);
  });

  function handleScan(dniRaw) {
    const dni = dniRaw.trim();
    dniInput.value = '';
    if (!dni) return;

    if (!U.isValidDNI(dni)) {
      showResult('no_encontrado', { mensaje: 'DNI inválido. Ingresá solo números (7 u 8 dígitos).' });
      U.playErrorSound();
      return;
    }

    const cliente = D.getClienteByDni(dni);
    if (!cliente || !cliente.activo) {
      showResult('no_encontrado', { mensaje: `El DNI ${U.formatDNI(dni)} no está registrado.` });
      U.playErrorSound();
      return;
    }

    const hoy = new Date();
    const pagos = D.getPagos();
    const asistencias = D.getAsistencias();
    const ev = F.evaluarCliente(cliente, pagos, asistencias, hoy);

    if (ev.estado === 'vencido') {
      showResult('vencido', { cliente, ev });
      U.playErrorSound();
      return;
    }

    if (ev.estado === 'sin_dias') {
      showResult('sin_dias', { cliente, ev });
      U.playWarnSound();
      return;
    }

    // Éxito: registrar asistencia si todavía no había una hoy (idempotente).
    const hoyISO = U.todayISO();
    const yaFueHoy = asistencias.some((a) => a.clienteId === cliente.id && a.fecha === hoyISO);
    if (!yaFueHoy) {
      D.addAsistencia({ clienteId: cliente.id, fecha: hoyISO, hora: U.nowHHmm() });
    }
    const usadosFinal = yaFueHoy ? ev.usados : ev.usados + 1;
    const disponiblesFinal = Math.max(0, ev.cap - usadosFinal);
    showResult('exito', { cliente, ev: { ...ev, usados: usadosFinal, disponibles: disponiblesFinal } });
    U.playSuccessSound();
  }

  // --- Render de resultados ---
  function planLabel(plan) {
    return plan === 'premium' ? 'Plan Premium' : 'Plan Base';
  }

  // Botón táctil para cerrar (tablets/celulares sin teclado físico, donde el teclado
  // virtual ya se ocultó al enviar el DNI) + recordatorio de la alternativa por teclado
  // para el mostrador con numpad físico.
  const CONTINUE_BUTTON = `
    <button type="button" class="btn btn-primary kiosko-result__continue">Continuar</button>
    <div class="kiosko-result__keyhint">En una PC o numpad también podés presionar cualquier tecla</div>
  `;

  function renderExito({ cliente, ev }) {
    resultModal.innerHTML = `
      <img class="avatar-lg" src="${cliente.fotoUrl}" alt="Foto de ${U.escapeHtml(cliente.nombre)}" />
      <div class="kiosko-result__estado">¡Bienvenido/a!</div>
      <div class="kiosko-result__nombre">${U.escapeHtml(cliente.nombre)} ${U.escapeHtml(cliente.apellido)}</div>
      <div class="kiosko-result__plan">${planLabel(cliente.plan)}</div>
      <div class="kiosko-result__dias">
        <div class="kiosko-result__dias-item">
          <div class="kiosko-result__dias-value">${ev.usados}</div>
          <div class="kiosko-result__dias-label">Días usados</div>
        </div>
        <div class="kiosko-result__dias-item">
          <div class="kiosko-result__dias-value">${ev.disponibles}</div>
          <div class="kiosko-result__dias-label">Disponibles</div>
        </div>
      </div>
      <div class="kiosko-result__hint">Ingreso registrado — ¡Buen entreno!</div>
      ${CONTINUE_BUTTON}
    `;
  }

  function renderVencido({ cliente, ev }) {
    resultModal.innerHTML = `
      <img class="avatar-lg" src="${cliente.fotoUrl}" alt="Foto de ${U.escapeHtml(cliente.nombre)}" />
      <div class="kiosko-result__estado">Cuota vencida</div>
      <div class="kiosko-result__nombre">${U.escapeHtml(cliente.nombre)} ${U.escapeHtml(cliente.apellido)}</div>
      <div class="kiosko-result__plan">${planLabel(cliente.plan)}</div>
      <div class="kiosko-result__detalle">Tu cuota venció el ${U.formatDateShortEs(ev.periodo.fin)}. Acercate a secretaría para renovarla.</div>
      ${CONTINUE_BUTTON}
    `;
  }

  function renderSinDias({ cliente, ev }) {
    const proximaFecha = U.addDays(ev.periodo.fin, 1);
    resultModal.innerHTML = `
      <img class="avatar-lg" src="${cliente.fotoUrl}" alt="Foto de ${U.escapeHtml(cliente.nombre)}" />
      <div class="kiosko-result__estado">Sin días disponibles</div>
      <div class="kiosko-result__nombre">${U.escapeHtml(cliente.nombre)} ${U.escapeHtml(cliente.apellido)}</div>
      <div class="kiosko-result__plan">${planLabel(cliente.plan)}</div>
      <div class="kiosko-result__detalle">Ya usaste tus ${ev.cap} días de este período. Podés volver a partir del ${U.formatDateShortEs(proximaFecha)}.</div>
      ${CONTINUE_BUTTON}
    `;
  }

  function renderNoEncontrado({ mensaje }) {
    resultModal.innerHTML = `
      <div class="kiosko-result__estado">No encontrado</div>
      <div class="kiosko-result__detalle">${U.escapeHtml(mensaje)}</div>
      ${CONTINUE_BUTTON}
    `;
  }

  function showResult(estado, payload) {
    resultModal.className = `modal kiosko-result kiosko-result--${estado}`;
    if (estado === 'exito') renderExito(payload);
    else if (estado === 'vencido') renderVencido(payload);
    else if (estado === 'sin_dias') renderSinDias(payload);
    else renderNoEncontrado(payload);

    resultOverlay.classList.add('is-open');
  }

  function closeModal() {
    resultOverlay.classList.remove('is-open');
    setTimeout(refocus, 50);
  }
})();
