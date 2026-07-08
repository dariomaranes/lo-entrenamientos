// Generador determinístico de datos mock: ~70 clientes + ~12 meses de pagos/asistencias.
// PRNG con seed fija (mulberry32) para que el dataset sea reproducible entre reseeds.
(function () {
  const { mulberry32, dateAtDay, formatISODate, addDays, addMonths, diffInDays, avatarUrlForDni } =
    window.Utils;

  const NOMBRES = [
    'Martina', 'Lucía', 'Sofía', 'Valentina', 'Camila', 'Julieta', 'Agustina', 'Emma',
    'Mateo', 'Santiago', 'Benjamín', 'Lautaro', 'Thiago', 'Bautista', 'Joaquín', 'Facundo',
    'Florencia', 'Micaela', 'Rocío', 'Antonella', 'Catalina', 'Delfina', 'Guadalupe', 'Milagros',
    'Nicolás', 'Franco', 'Ignacio', 'Tomás', 'Gonzalo', 'Federico', 'Maximiliano', 'Agustín',
    'Carla', 'Daniela', 'Elena', 'Paula', 'Romina', 'Vanina', 'Yamila', 'Zoe',
    'Diego', 'Emiliano', 'Gastón', 'Hernán', 'Ivo', 'Leandro', 'Marcos', 'Pablo', 'Rodrigo', 'Sebastián',
  ];

  const APELLIDOS = [
    'González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez',
    'García', 'Sánchez', 'Romero', 'Sosa', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez',
    'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Molina',
    'Castro', 'Ortiz', 'Silva', 'Rojas', 'Núñez', 'Ibáñez', 'Vega', 'Cabrera',
    'Godoy', 'Luna', 'Peralta', 'Domínguez', 'Vázquez', 'Correa', 'Juárez', 'Ferreyra',
  ];

  function normalizeForEmail(str) {
    return str
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  function generateMockDataset() {
    const rand = mulberry32(42);
    const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
    const pick = (arr) => arr[randInt(0, arr.length - 1)];
    const shuffleInPlace = (arr) => {
      for (let k = arr.length - 1; k > 0; k--) {
        const j = Math.floor(rand() * (k + 1));
        [arr[k], arr[j]] = [arr[j], arr[k]];
      }
      return arr;
    };

    const hoy = dateAtDay(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const periodoHoy = window.Fees.periodoVigente(hoy);
    const DIA_VENC = window.Fees.DIA_VENCIMIENTO;

    function periodoInfo(inicio) {
      const fin = dateAtDay(inicio.getFullYear(), inicio.getMonth() + 1, DIA_VENC - 1);
      return { inicio, fin, inicioISO: formatISODate(inicio), finISO: formatISODate(fin) };
    }

    const clientes = [];
    const pagos = [];
    const asistencias = [];
    const dnisUsados = new Set();

    let clienteSeq = 0;
    let pagoSeq = 0;
    let asistSeq = 0;

    const TOTAL_CLIENTES = 70;

    for (let i = 0; i < TOTAL_CLIENTES; i++) {
      clienteSeq += 1;
      const nombre = pick(NOMBRES);
      const apellido = pick(APELLIDOS);

      let dni;
      do {
        dni = String(randInt(20000000, 46000000));
      } while (dnisUsados.has(dni));
      dnisUsados.add(dni);

      const plan = rand() < 0.6 ? 'base' : 'premium';

      const mesesAtras = randInt(0, 18);
      const diaAlta = randInt(1, 28);
      let fechaAlta = dateAtDay(hoy.getFullYear(), hoy.getMonth() - mesesAtras, diaAlta);
      if (fechaAlta > hoy) fechaAlta = hoy;

      const telefono = `+54 9 11 ${randInt(4000, 6999)}-${randInt(1000, 9999)}`;
      const emailBase = `${normalizeForEmail(nombre)}.${normalizeForEmail(apellido)}`;
      const email = `${emailBase}${randInt(1, 99)}@example.com`;

      const cliente = {
        id: `c-${String(clienteSeq).padStart(4, '0')}`,
        nombre,
        apellido,
        dni,
        telefono,
        email,
        plan,
        fechaAlta: formatISODate(fechaAlta),
        fotoUrl: avatarUrlForDni(dni),
        activo: true,
        fechaBaja: null,
      };
      clientes.push(cliente);

      // Recorrer períodos desde el alta hasta el período vigente de hoy, simulando
      // pagos con puntualidad probabilística: 70% a tiempo, 15% atrasado (catch-up
      // dentro del mismo mes), 15% directamente salteado.
      let cursorInicio = window.Fees.periodoParaPago(fechaAlta).inicio;
      const cap = window.Fees.PLAN_CAPS[plan];

      while (cursorInicio <= periodoHoy.inicio) {
        const periodo = periodoInfo(cursorInicio);
        const esPeriodoActual = periodo.inicioISO === periodoHoy.inicioISO;

        const r = rand();
        let pagoFecha = null;
        if (r < 0.85) {
          const diaPago = r < 0.7 ? randInt(1, DIA_VENC) : randInt(DIA_VENC + 1, DIA_VENC + 10);
          const fechaCandidata = dateAtDay(cursorInicio.getFullYear(), cursorInicio.getMonth(), diaPago);
          if (fechaCandidata <= hoy) pagoFecha = fechaCandidata;
        }

        if (pagoFecha) {
          pagoSeq += 1;
          pagos.push({
            id: `p-${String(pagoSeq).padStart(6, '0')}`,
            clienteId: cliente.id,
            fecha: formatISODate(pagoFecha),
            monto: window.Fees.PLAN_PRECIOS[plan],
            plan,
            periodoInicio: periodo.inicioISO,
            periodoFin: periodo.finISO,
            registradoPor: 'seed',
          });

          const finEfectivo = periodo.fin > hoy ? hoy : periodo.fin;
          const diasEnRango = diffInDays(finEfectivo, periodo.inicio) + 1;
          if (diasEnRango > 0) {
            const fraccion = esPeriodoActual ? 0.3 + rand() * 0.6 : 0.4 + rand() * 0.6;
            const objetivo = Math.min(Math.round(cap * fraccion), cap, diasEnRango);
            const offsets = shuffleInPlace(Array.from({ length: diasEnRango }, (_, d) => d)).slice(
              0,
              objetivo
            );
            offsets.forEach((offset) => {
              const fechaAsist = addDays(periodo.inicio, offset);
              const manana = rand() < 0.55;
              const hora = manana
                ? `${String(randInt(7, 9)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`
                : `${String(randInt(18, 21)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`;
              asistSeq += 1;
              asistencias.push({
                id: `a-${String(asistSeq).padStart(7, '0')}`,
                clienteId: cliente.id,
                fecha: formatISODate(fechaAsist),
                hora,
              });
            });
          }
        }

        cursorInicio = addMonths(cursorInicio, 1);
      }
    }

    return { clientes, pagos, asistencias };
  }

  window.Seed = { generateMockDataset };
})();
