// Capa de acceso a datos: siembra inicial (seed-on-first-load) + CRUD sobre localStorage.
(function () {
  const S = window.Storage_;
  const U = window.Utils;

  const KEYS = { schema: 'schema', clientes: 'clientes', pagos: 'pagos', asistencias: 'asistencias' };

  function seedIfNeeded() {
    const version = S.getItem(KEYS.schema, 0);
    if (version === S.SCHEMA_VERSION) return false;
    const { clientes, pagos, asistencias } = window.Seed.generateMockDataset();
    S.setItem(KEYS.clientes, clientes);
    S.setItem(KEYS.pagos, pagos);
    S.setItem(KEYS.asistencias, asistencias);
    S.setItem(KEYS.schema, S.SCHEMA_VERSION);
    return true;
  }

  function resetAndReseed() {
    S.clearNamespace();
    seedIfNeeded();
    if (window.Notifications) window.Notifications.seedIfNeeded(true);
  }

  // --- Clientes ---
  function getClientes(opts = {}) {
    const { soloActivos = false } = opts;
    const list = S.getItem(KEYS.clientes, []);
    return soloActivos ? list.filter((c) => c.activo) : list;
  }

  function saveClientes(list) {
    S.setItem(KEYS.clientes, list);
  }

  function getClienteById(id) {
    return getClientes().find((c) => c.id === id) || null;
  }

  function getClienteByDni(dni) {
    const clean = String(dni).trim();
    return getClientes().find((c) => c.dni === clean) || null;
  }

  function dniExiste(dni, excludeId) {
    const clean = String(dni).trim();
    return getClientes().some((c) => c.dni === clean && c.id !== excludeId);
  }

  function addCliente(cliente) {
    const list = getClientes();
    const nuevo = {
      activo: true,
      fechaBaja: null,
      fotoUrl: U.avatarUrlForDni(cliente.dni),
      ...cliente,
      id: U.uid('c'),
    };
    list.push(nuevo);
    saveClientes(list);
    return nuevo;
  }

  function updateCliente(id, patch) {
    const list = getClientes();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    saveClientes(list);
    return list[idx];
  }

  function bajaCliente(id) {
    return updateCliente(id, { activo: false, fechaBaja: U.todayISO() });
  }

  function reactivarCliente(id) {
    return updateCliente(id, { activo: true, fechaBaja: null });
  }

  // --- Pagos ---
  function getPagos(opts = {}) {
    const { clienteId } = opts;
    const list = S.getItem(KEYS.pagos, []);
    return clienteId ? list.filter((p) => p.clienteId === clienteId) : list;
  }

  function addPago(pago) {
    const list = getPagos();
    const nuevo = { registradoPor: 'secretaria', ...pago, id: U.uid('p') };
    list.push(nuevo);
    S.setItem(KEYS.pagos, list);
    return nuevo;
  }

  // --- Asistencias ---
  function getAsistencias(opts = {}) {
    const { clienteId } = opts;
    const list = S.getItem(KEYS.asistencias, []);
    return clienteId ? list.filter((a) => a.clienteId === clienteId) : list;
  }

  function addAsistencia(asistencia) {
    const list = getAsistencias();
    const nuevo = { ...asistencia, id: U.uid('a') };
    list.push(nuevo);
    S.setItem(KEYS.asistencias, list);
    return nuevo;
  }

  window.Data = {
    seedIfNeeded,
    resetAndReseed,
    getClientes,
    getClienteById,
    getClienteByDni,
    dniExiste,
    addCliente,
    updateCliente,
    bajaCliente,
    reactivarCliente,
    getPagos,
    addPago,
    getAsistencias,
    addAsistencia,
  };
})();
