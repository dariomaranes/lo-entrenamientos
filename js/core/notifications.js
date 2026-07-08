// Centro de notificaciones simulado: no hay integración real de WhatsApp/Email (prototipo
// sin backend). Genera un log histórico a partir del dataset mock ya sembrado, y permite
// agregar eventos "en vivo" durante la demo (ej. al registrar un pago en Secretaría).
(function () {
  const S = window.Storage_;
  const U = window.Utils;

  const KEYS = { schemaNotif: 'notifSchema', log: 'notificaciones' };
  const DIAS_HISTORIAL_PAGOS = 90; // no generar un email por cada pago de los últimos 12 meses, sería demasiado ruido

  function getNotifications() {
    const list = S.getItem(KEYS.log, []);
    return [...list].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }

  function saveAll(list) {
    S.setItem(KEYS.log, list);
  }

  function addNotification(entry) {
    const list = S.getItem(KEYS.log, []);
    const nuevo = { id: U.uid('n'), timestamp: U.nowISOTimestamp(), ...entry };
    list.push(nuevo);
    saveAll(list);
    return nuevo;
  }

  function contenidoPagoConfirmado(cliente, pago) {
    const fechaEs = U.formatDateShortEs(U.parseISODate(pago.fecha));
    return `Hola ${cliente.nombre}, confirmamos tu pago de ${U.formatCurrencyARS(pago.monto)} (plan ${
      pago.plan === 'premium' ? 'Premium' : 'Base'
    }) del ${fechaEs}. ¡Gracias por entrenar con nosotros!`;
  }

  function contenidoVencido(cliente) {
    return `Hola ${cliente.nombre}, tu cuota está vencida. Acercate a secretaría para renovarla y no perder acceso al gimnasio.`;
  }

  function contenidoProximoAVencer(cliente, diasRestantes) {
    return `Hola ${cliente.nombre}, tu cuota vence en ${diasRestantes} día${
      diasRestantes === 1 ? '' : 's'
    }. Renová a tiempo para seguir entrenando sin interrupciones.`;
  }

  function timestampEnDia(fechaDate, horaBase) {
    const hh = String(horaBase + Math.floor(Math.random() * 3)).padStart(2, '0');
    const mm = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    return `${U.formatISODate(fechaDate)}T${hh}:${mm}:00`;
  }

  function seedIfNeeded(force) {
    const version = S.getItem(KEYS.schemaNotif, 0);
    if (!force && version === S.SCHEMA_VERSION) return false;

    const hoy = U.parseISODate(U.todayISO());
    const clientes = window.Data.getClientes();
    const clientesById = Object.fromEntries(clientes.map((c) => [c.id, c]));
    const pagos = window.Data.getPagos();
    const entries = [];

    const desdeFecha = U.addDays(hoy, -DIAS_HISTORIAL_PAGOS);
    pagos
      .filter((p) => p.fecha >= U.formatISODate(desdeFecha))
      .forEach((pago) => {
        const cliente = clientesById[pago.clienteId];
        if (!cliente) return;
        entries.push({
          id: U.uid('n'),
          timestamp: timestampEnDia(U.parseISODate(pago.fecha), 10),
          clienteId: cliente.id,
          tipo: 'email',
          motivo: 'pago_confirmado',
          destinatario: cliente.email,
          contenido: contenidoPagoConfirmado(cliente, pago),
        });
      });

    clientes.forEach((cliente) => {
      if (!cliente.activo) return;
      const badge = window.Fees.estadoBadge(cliente, pagos, window.Data.getAsistencias(), hoy);
      const periodo = window.Fees.periodoVigente(hoy);

      if (badge === 'vencido') {
        const timestampVencido = U.addDays(periodo.inicio, 1);
        if (timestampVencido <= hoy) {
          entries.push({
            id: U.uid('n'),
            timestamp: timestampEnDia(timestampVencido, 9),
            clienteId: cliente.id,
            tipo: 'whatsapp',
            motivo: 'vencimiento_vencido',
            destinatario: cliente.telefono,
            contenido: contenidoVencido(cliente),
          });
        }
      } else if (badge === 'proximo_a_vencer') {
        const diasRestantes = U.diffInDays(periodo.fin, hoy);
        const timestampAviso = U.addDays(hoy, -1);
        if (timestampAviso >= periodo.inicio) {
          entries.push({
            id: U.uid('n'),
            timestamp: timestampEnDia(timestampAviso, 9),
            clienteId: cliente.id,
            tipo: 'whatsapp',
            motivo: 'vencimiento_proximo',
            destinatario: cliente.telefono,
            contenido: contenidoProximoAVencer(cliente, diasRestantes),
          });
        }
      }
    });

    saveAll(entries);
    S.setItem(KEYS.schemaNotif, S.SCHEMA_VERSION);
    return true;
  }

  function notificarPagoConfirmado(cliente, pago) {
    return addNotification({
      clienteId: cliente.id,
      tipo: 'email',
      motivo: 'pago_confirmado',
      destinatario: cliente.email,
      contenido: contenidoPagoConfirmado(cliente, pago),
    });
  }

  function notificarVencido(cliente) {
    return addNotification({
      clienteId: cliente.id,
      tipo: 'whatsapp',
      motivo: 'vencimiento_vencido',
      destinatario: cliente.telefono,
      contenido: contenidoVencido(cliente),
    });
  }

  window.Notifications = { seedIfNeeded, addNotification, getNotifications, notificarPagoConfirmado, notificarVencido };
})();
