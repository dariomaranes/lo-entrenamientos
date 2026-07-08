(function () {
  const U = window.Utils;
  const D = window.Data;
  const F = window.Fees;
  const N = window.Notifications;

  const session = window.Auth.requireRole(['admin']);
  if (!session) return;

  D.seedIfNeeded();
  N.seedIfNeeded();
  window.UI.initHeader(session);

  const COLORS = {
    blue: '#23aef0',
    red: '#e8342b',
    ok: '#22c55e',
    warn: '#f59e0b',
    danger: '#ef4444',
    grid: '#2a2f38',
    text: '#8b93a3',
  };

  const BADGE_INFO = {
    al_dia: { label: 'Al día', cls: 'badge-ok' },
    proximo_a_vencer: { label: 'Próximo a vencer', cls: 'badge-warn' },
    vencido: { label: 'Vencido', cls: 'badge-danger' },
    sin_dias: { label: 'Sin días', cls: 'badge-info' },
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
    });
  });

  // ===================== DATA AGGREGATION =====================
  const hoy = new Date();
  const clientesTodos = D.getClientes();
  const clientesActivos = clientesTodos.filter((c) => c.activo);
  const pagos = D.getPagos();
  const asistencias = D.getAsistencias();

  function monthKey(date) {
    return `${date.getFullYear()}-${U.pad2(date.getMonth() + 1)}`;
  }

  function ultimosNMeses(n) {
    const meses = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = U.dateAtDay(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        key: monthKey(d),
        label: `${U.MESES_ES_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
      });
    }
    return meses;
  }

  const meses12 = ultimosNMeses(12);
  const ingresosPorMes = meses12.map((m) => pagos.filter((p) => p.fecha.startsWith(m.key)).reduce((sum, p) => sum + p.monto, 0));
  const asistenciasPorMes = meses12.map((m) => asistencias.filter((a) => a.fecha.startsWith(m.key)).length);
  const mesesLabels = meses12.map((m, i) => (i === meses12.length - 1 ? `${m.label} (en curso)` : m.label));
  const barColorsMes = (color, colorActual) => meses12.map((m, i) => (i === meses12.length - 1 ? colorActual : color));

  // --- KPIs ---
  const periodoVigente = F.periodoVigente(hoy);
  const badgesActivos = clientesActivos.map((c) => F.estadoBadge(c, pagos, asistencias, hoy));
  const countBadge = (estado) => badgesActivos.filter((b) => b === estado).length;

  const ingresosMesActual = ingresosPorMes[ingresosPorMes.length - 1];
  const arpu = clientesActivos.length > 0 ? ingresosMesActual / clientesActivos.length : 0;

  // Bajas del mes en curso (clientes inactivos cuya fecha de baja cae en este mes calendario).
  const mesActualKey = monthKey(hoy);
  const bajasEsteMes = clientesTodos.filter((c) => !c.activo && c.fechaBaja && c.fechaBaja.startsWith(mesActualKey)).length;

  // Día de la semana con más asistencias históricas.
  const conteoPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];
  asistencias.forEach((a) => {
    conteoPorDiaSemana[U.parseISODate(a.fecha).getDay()] += 1;
  });
  const diaMasConcurridoIdx = conteoPorDiaSemana.indexOf(Math.max(...conteoPorDiaSemana));
  const diaMasConcurridoLabel = U.DIAS_ES[diaMasConcurridoIdx];
  const diaMasConcurridoNombre = diaMasConcurridoLabel.charAt(0).toUpperCase() + diaMasConcurridoLabel.slice(1);

  // Retención: clientes que pagaron el período anterior y también el vigente.
  const periodoAnteriorInicio = U.addMonths(periodoVigente.inicio, -1);
  const periodoAnteriorInicioISO = U.formatISODate(periodoAnteriorInicio);
  const pagadoresAnterior = new Set(pagos.filter((p) => p.periodoInicio === periodoAnteriorInicioISO).map((p) => p.clienteId));
  const pagadoresVigente = new Set(pagos.filter((p) => p.periodoInicio === periodoVigente.inicioISO).map((p) => p.clienteId));
  let retenidos = 0;
  pagadoresAnterior.forEach((id) => {
    if (pagadoresVigente.has(id)) retenidos += 1;
  });
  const tasaRetencion = pagadoresAnterior.size > 0 ? (retenidos / pagadoresAnterior.size) * 100 : null;

  const kpis = [
    { label: 'Clientes activos', value: clientesActivos.length, variant: 'accent' },
    { label: 'Ingresos del mes', value: U.formatCurrencyARS(ingresosMesActual), variant: 'ok' },
    { label: 'ARPU (mes actual)', value: U.formatCurrencyARS(Math.round(arpu)), variant: 'accent' },
    { label: 'Tasa de renovación', value: tasaRetencion === null ? '—' : `${tasaRetencion.toFixed(0)}%`, variant: 'ok' },
    { label: 'Próximos a vencer', value: countBadge('proximo_a_vencer'), variant: 'warn' },
    { label: 'Vencidos', value: countBadge('vencido'), variant: 'danger' },
    { label: 'Bajas este mes', value: bajasEsteMes, variant: 'danger' },
    { label: 'Día de mayor concurrencia', value: diaMasConcurridoNombre, variant: 'accent' },
  ];

  document.getElementById('kpiGrid').innerHTML = kpis
    .map(
      (k) => `
    <div class="kpi-card kpi-card--${k.variant}">
      <div class="kpi-card__label">${k.label}</div>
      <div class="kpi-card__value">${k.value}</div>
    </div>`
    )
    .join('');

  // ===================== CHARTS =====================
  Chart.defaults.color = COLORS.text;
  Chart.defaults.font.family = "'Barlow', sans-serif";
  Chart.defaults.borderColor = COLORS.grid;

  new Chart(document.getElementById('chartIngresos'), {
    type: 'bar',
    data: {
      labels: mesesLabels,
      datasets: [
        {
          label: 'Ingresos',
          data: ingresosPorMes,
          backgroundColor: barColorsMes(COLORS.blue, 'rgba(35, 174, 240, 0.35)'),
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => `$${v / 1000}k` }, grid: { color: COLORS.grid } },
        x: { grid: { display: false } },
      },
    },
  });

  new Chart(document.getElementById('chartAsistencias'), {
    type: 'bar',
    data: {
      labels: mesesLabels,
      datasets: [
        {
          label: 'Asistencias',
          data: asistenciasPorMes,
          backgroundColor: barColorsMes(COLORS.ok, 'rgba(34, 197, 94, 0.35)'),
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: COLORS.grid } },
        x: { grid: { display: false } },
      },
    },
  });

  const basePlanCount = clientesActivos.filter((c) => c.plan === 'base').length;
  const premiumPlanCount = clientesActivos.filter((c) => c.plan === 'premium').length;

  new Chart(document.getElementById('chartPlanes'), {
    type: 'doughnut',
    data: {
      labels: ['Base', 'Premium'],
      datasets: [
        {
          data: [basePlanCount, premiumPlanCount],
          backgroundColor: [COLORS.blue, COLORS.red],
          borderColor: '#101216',
          borderWidth: 3,
        },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
    },
  });

  const horas = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 a 22:00
  const asistenciasPorHora = horas.map((h) => asistencias.filter((a) => Number(a.hora.split(':')[0]) === h).length);

  new Chart(document.getElementById('chartHorarios'), {
    type: 'bar',
    data: {
      labels: horas.map((h) => `${U.pad2(h)}h`),
      datasets: [
        {
          label: 'Asistencias',
          data: asistenciasPorHora,
          backgroundColor: COLORS.red,
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: COLORS.grid } },
        x: { grid: { display: false } },
      },
    },
  });

  // ===================== COMPARACIONES =====================
  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }

  function renderComparisonPair(container, opts) {
    const { labelLeft, labelRight, valueLeft, valueRight, formatter, deltaSuffix = 'vs. anterior' } = opts;
    const delta = valueLeft > 0 ? ((valueRight - valueLeft) / valueLeft) * 100 : null;
    const deltaCls = delta === null ? '' : delta >= 0 ? 'is-up' : 'is-down';
    const deltaTxt = delta === null ? 'sin datos previos' : `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% ${deltaSuffix}`;
    const row = document.createElement('div');
    row.className = 'comparison-pair';
    row.innerHTML = `
      <div class="comparison-pair__block">
        <span class="comparison-pair__label">${labelLeft}</span>
        <span class="comparison-pair__value">${formatter(valueLeft)}</span>
      </div>
      <div class="comparison-pair__block" style="align-items: flex-end;">
        <span class="comparison-pair__label">${labelRight}</span>
        <span class="comparison-pair__value">${formatter(valueRight)}</span>
        <span class="comparison-pair__delta ${deltaCls}">${deltaTxt}</span>
      </div>
    `;
    container.appendChild(row);
  }

  const semestreContainer = document.getElementById('comparacionSemestre');
  renderComparisonPair(semestreContainer, {
    labelLeft: 'Ingresos semestre anterior',
    labelRight: 'Ingresos semestre actual',
    valueLeft: sum(ingresosPorMes.slice(0, 6)),
    valueRight: sum(ingresosPorMes.slice(6, 12)),
    formatter: U.formatCurrencyARS,
  });
  renderComparisonPair(semestreContainer, {
    labelLeft: 'Asistencias semestre anterior',
    labelRight: 'Asistencias semestre actual',
    valueLeft: sum(asistenciasPorMes.slice(0, 6)),
    valueRight: sum(asistenciasPorMes.slice(6, 12)),
    formatter: (v) => `${v} días`,
  });

  const cuatrimestreContainer = document.getElementById('comparacionCuatrimestre');
  renderComparisonPair(cuatrimestreContainer, {
    labelLeft: 'Ingresos cuatrimestre anterior',
    labelRight: 'Ingresos cuatrimestre actual',
    valueLeft: sum(ingresosPorMes.slice(4, 8)),
    valueRight: sum(ingresosPorMes.slice(8, 12)),
    formatter: U.formatCurrencyARS,
  });
  renderComparisonPair(cuatrimestreContainer, {
    labelLeft: 'Asistencias cuatrimestre anterior',
    labelRight: 'Asistencias cuatrimestre actual',
    valueLeft: sum(asistenciasPorMes.slice(4, 8)),
    valueRight: sum(asistenciasPorMes.slice(8, 12)),
    formatter: (v) => `${v} días`,
  });

  // Estacionalidad: verano (dic/ene/feb) vs invierno (jun/jul/ago), promedio mensual
  // sobre las instancias de esos meses presentes en la ventana de 12 meses.
  const VERANO = [11, 0, 1];
  const INVIERNO = [5, 6, 7];
  function promedioPorMeses(mesesIdx, serie) {
    const valores = meses12.map((m, i) => ({ m, v: serie[i] })).filter((x) => mesesIdx.includes(x.m.month));
    if (valores.length === 0) return 0;
    return sum(valores.map((x) => x.v)) / valores.length;
  }

  const estacionalContainer = document.getElementById('comparacionEstacional');
  renderComparisonPair(estacionalContainer, {
    labelLeft: 'Ingresos prom. mensual — Invierno',
    labelRight: 'Ingresos prom. mensual — Verano',
    valueLeft: promedioPorMeses(INVIERNO, ingresosPorMes),
    valueRight: promedioPorMeses(VERANO, ingresosPorMes),
    formatter: U.formatCurrencyARS,
    deltaSuffix: 'vs. invierno',
  });
  renderComparisonPair(estacionalContainer, {
    labelLeft: 'Asistencias prom. mensual — Invierno',
    labelRight: 'Asistencias prom. mensual — Verano',
    valueLeft: promedioPorMeses(INVIERNO, asistenciasPorMes),
    valueRight: promedioPorMeses(VERANO, asistenciasPorMes),
    formatter: (v) => `${v.toFixed(0)} días`,
    deltaSuffix: 'vs. invierno',
  });

  // ===================== NOTIFICACIONES =====================
  const notifTableBody = document.getElementById('notifTableBody');
  const notifPagination = document.getElementById('notifPagination');
  const clientesById = Object.fromEntries(clientesTodos.map((c) => [c.id, c]));
  const NOTIF_PAGE_SIZE = 10;
  let filtroActivo = 'todos';
  let notifPage = 1;

  function renderNotificaciones() {
    let notifs = N.getNotifications();
    if (filtroActivo !== 'todos') notifs = notifs.filter((n) => n.tipo === filtroActivo);

    if (notifs.length === 0) {
      notifTableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Sin notificaciones registradas.</div></td></tr>`;
      notifPagination.innerHTML = '';
      return;
    }

    const { items: notifPageItems, page: notifPageClamped, totalPages: notifTotalPages } = window.UI.paginate(
      notifs,
      notifPage,
      NOTIF_PAGE_SIZE
    );
    notifPage = notifPageClamped;
    window.UI.renderPagination(notifPagination, notifPage, notifTotalPages, (newPage) => {
      notifPage = newPage;
      renderNotificaciones();
    });

    const motivoLabel = {
      pago_confirmado: 'Pago confirmado',
      vencimiento_proximo: 'Vencimiento próximo',
      vencimiento_vencido: 'Cuota vencida',
    };

    notifTableBody.innerHTML = notifPageItems
      .map((n) => {
        const cliente = clientesById[n.clienteId];
        const fecha = n.timestamp.replace('T', ' ');
        return `
        <tr>
          <td class="text-muted">${fecha}</td>
          <td><span class="badge ${n.tipo === 'whatsapp' ? 'badge-ok' : 'badge-info'}">${n.tipo === 'whatsapp' ? 'WhatsApp' : 'Email'}</span></td>
          <td>${cliente ? U.escapeHtml(cliente.nombre + ' ' + cliente.apellido) : ''}<br /><span class="text-muted">${U.escapeHtml(n.destinatario)}</span></td>
          <td>${motivoLabel[n.motivo] || n.motivo}</td>
          <td class="notif-content-cell">${U.escapeHtml(n.contenido)}</td>
        </tr>`;
      })
      .join('');
  }

  document.querySelectorAll('[data-filtro]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filtro]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      filtroActivo = btn.dataset.filtro;
      notifPage = 1;
      renderNotificaciones();
    });
  });

  renderNotificaciones();

  // ===================== HISTORIAL DE PAGOS =====================
  const pagosTableBody = document.getElementById('pagosTableBody');
  const pagosPagination = document.getElementById('pagosPagination');
  const PAGOS_PAGE_SIZE = 10;
  let pagosPage = 1;

  function renderPagosTable() {
    const pagosOrdenados = pagos
      .map((p) => ({ pago: p, cliente: clientesById[p.clienteId] }))
      .filter((row) => row.cliente)
      .sort((a, b) => (a.pago.fecha < b.pago.fecha ? 1 : -1));

    if (pagosOrdenados.length === 0) {
      pagosTableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No hay pagos registrados todavía.</div></td></tr>`;
      pagosPagination.innerHTML = '';
      return;
    }

    const { items: pagosPageItems, page: pagosPageClamped, totalPages: pagosTotalPages } = window.UI.paginate(
      pagosOrdenados,
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

  renderPagosTable();
})();
