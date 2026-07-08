// Algoritmo de período de facturación. Funciones puras: no tocan el DOM ni localStorage,
// reciben los arrays de pagos/asistencias como parámetro. Así se pueden testear en aislado
// desde debug-tests.html.
(function () {
  const { dateAtDay, formatISODate, parseISODate, diffInDays } = window.Utils;

  const PLAN_CAPS = { base: 8, premium: 20 };
  const PLAN_PRECIOS = { base: 60000, premium: 70000 };
  const DIA_VENCIMIENTO = 10;
  const UMBRAL_PROXIMO_A_VENCER_DIAS = 5;

  function periodoDesdeInicio(inicio) {
    const fin = dateAtDay(inicio.getFullYear(), inicio.getMonth() + 1, DIA_VENCIMIENTO - 1);
    return {
      inicio,
      fin,
      inicioISO: formatISODate(inicio),
      finISO: formatISODate(fin),
    };
  }

  // Período vigente en una fecha de referencia dada (normalmente "hoy").
  function periodoVigente(fechaRef) {
    const day = fechaRef.getDate();
    const inicio =
      day >= DIA_VENCIMIENTO
        ? dateAtDay(fechaRef.getFullYear(), fechaRef.getMonth(), DIA_VENCIMIENTO)
        : dateAtDay(fechaRef.getFullYear(), fechaRef.getMonth() - 1, DIA_VENCIMIENTO);
    return periodoDesdeInicio(inicio);
  }

  // Período que activa un pago realizado en fechaPago. Siempre el día 10 del MISMO mes
  // calendario del pago (pagar antes del 10 = adelantado; pagar después = catch-up del
  // período que ya arrancó). Nunca cubre retroactivamente un período salteado.
  function periodoParaPago(fechaPago) {
    const inicio = dateAtDay(fechaPago.getFullYear(), fechaPago.getMonth(), DIA_VENCIMIENTO);
    return periodoDesdeInicio(inicio);
  }

  function estaAlDia(pagos, clienteId, fechaRef) {
    const periodo = periodoVigente(fechaRef);
    return pagos.some((p) => p.clienteId === clienteId && p.periodoInicio === periodo.inicioISO);
  }

  function diasAsistidosEnPeriodo(asistencias, clienteId, periodo) {
    return asistencias.filter(
      (a) => a.clienteId === clienteId && a.fecha >= periodo.inicioISO && a.fecha <= periodo.finISO
    ).length;
  }

  function diasDisponibles(plan, usados) {
    const cap = PLAN_CAPS[plan];
    return Math.max(0, cap - usados);
  }

  // Decisión completa para el kiosko: no muta nada, solo calcula.
  function evaluarCliente(cliente, pagos, asistencias, fechaRef) {
    const periodo = periodoVigente(fechaRef);
    const alDia = estaAlDia(pagos, cliente.id, fechaRef);
    const cap = PLAN_CAPS[cliente.plan];
    const usados = diasAsistidosEnPeriodo(asistencias, cliente.id, periodo);
    const disponibles = diasDisponibles(cliente.plan, usados);

    let estado;
    if (!alDia) {
      estado = 'vencido';
    } else if (usados >= cap) {
      estado = 'sin_dias';
    } else {
      estado = 'exito';
    }

    return { estado, periodo, alDia, cap, usados, disponibles };
  }

  // Badge de estado para listados de Secretaría/Admin. Incluye "proximo_a_vencer",
  // que no aplica en la decisión binaria del kiosko.
  function estadoBadge(cliente, pagos, asistencias, fechaRef) {
    const periodo = periodoVigente(fechaRef);
    const alDia = estaAlDia(pagos, cliente.id, fechaRef);
    if (!alDia) return 'vencido';
    const cap = PLAN_CAPS[cliente.plan];
    const usados = diasAsistidosEnPeriodo(asistencias, cliente.id, periodo);
    if (usados >= cap) return 'sin_dias';
    const diasHastaFin = diffInDays(periodo.fin, fechaRef);
    if (diasHastaFin <= UMBRAL_PROXIMO_A_VENCER_DIAS) return 'proximo_a_vencer';
    return 'al_dia';
  }

  window.Fees = {
    PLAN_CAPS,
    PLAN_PRECIOS,
    DIA_VENCIMIENTO,
    periodoVigente,
    periodoParaPago,
    estaAlDia,
    diasAsistidosEnPeriodo,
    diasDisponibles,
    evaluarCliente,
    estadoBadge,
  };
})();
