# lo-entrenamientos

Prototipo de demo (HTML/CSS/JS estático, sin build ni backend) para mostrarle a un gimnasio cliente potencial cómo se vería un sistema de gestión de accesos, cuotas y clientes.

**No es el producto final.** Es un prototipo de venta: todos los datos se generan localmente en el navegador (localStorage) y no hay ninguna integración real de pagos, WhatsApp o email — esas partes están simuladas para mostrar el concepto.

## Cómo correrlo

No requiere `npm install` ni build. Sirve los archivos con cualquier servidor estático desde la raíz del repo, por ejemplo:

```bash
python3 -m http.server 8743
```

y abrí `http://localhost:8743/index.html`. (Abrir los `.html` directo con doble-click / `file://` también funciona, salvo que el navegador bloquee `fetch`/módulos — no debería pasar acá porque todo es JS clásico con `<script>` tags, sin `fetch` a archivos locales.)

## Pantallas

- **`index.html`** — launcher de la demo, con accesos directos a Kiosko e Ingreso Staff. No forma parte del producto real, es solo para navegar la demo más rápido.
- **`kiosko.html`** — pantalla pública de check-in. El cliente escribe su DNI (con teclado físico o lector de código de barras/numérico) y confirma con el botón **Ingresar**; el sistema valida si está al día, si le quedan días disponibles este período, o si está vencido. Sin login.
- **`login.html`** — login de staff. Credenciales de la demo:
  - Admin: `admin` / `admin`
  - Secretaría: `secretaria` / `secretaria`
- **`secretaria.html`** — alta de clientes, listado/CRUD, registro de pagos, historial de pagos, y la vista de ingresos del día (ver abajo).
- **`admin.html`** — dashboard de negocio (KPIs, ingresos/asistencias por mes, estacionalidad, etc.), centro de notificaciones simulado, e historial de pagos.
- **`debug-tests.html`** — no está enlazado desde la navegación. Corre unos escenarios de negocio contra el algoritmo de cuotas (`js/core/fees.js`) para verificar los casos límite de fin de mes, bisiestos, pagos adelantados/atrasados, etc.

## Flujo de ingreso de clientes (pensado para una sola PC)

Como todo corre sobre `localStorage` del navegador (sin backend), no hace falta una PC/pantalla dedicada para el kiosko: alcanza con un único equipo en recepción.

- Secretaría tiene un botón **"Ingreso de cliente"** en el header que abre `kiosko.html?return=secretaria` en la misma pestaña. El kiosko detecta ese parámetro y cambia el link de "Ingreso Staff" por **"← Volver a Secretaría"**, para que el/la recepcionista vuelva a su panel con un click cuando termina de atender gente.
- La pantalla inicial de Secretaría es la pestaña **"Ingresos"**: muestra un contador **"Ingresaron hoy"** y una tabla con cada check-in del día (cliente, DNI, hora, días restantes y asistencias del mes en curso), filtrable por fecha con un selector. Se actualiza sola —sin recargar— escuchando el evento `storage`, que el navegador dispara en otras pestañas cuando el kiosko registra un nuevo ingreso.

## Gestión de vencidos

- El botón **"Vencidos"** en el header de Secretaría lleva directo a la pestaña Clientes filtrada a solo los clientes con cuota vencida (con un chip para volver a ver todos).
- El botón verde **"Notificar por WhatsApp"** solo aparece en esa pestaña cuando el filtro de vencidos está activo (porque solo notifica a clientes en ese estado). Simula el envío de un aviso de cuota vencida a todos los clientes activos vencidos (sin integración real) y deja el registro en el centro de notificaciones de Admin, igual que los avisos que ya se siembran con el dataset mock.

## Historial de pagos

Tanto Secretaría como Admin tienen una pestaña **"Historial de Pagos"** con todos los pagos registrados (cliente, DNI, fecha de pago, período que habilitó, plan, monto y quién lo registró — "Datos de ejemplo" para los pagos sembrados, o "Admin"/"Secretaría" según qué usuario de staff lo cargó), ordenados del más reciente al más antiguo.

## Paginación

Las tablas largas (Clientes, Ingresos, Notificaciones e Historial de Pagos) están paginadas de a 10 filas, con controles "Anterior / Siguiente" (helper reutilizable en `js/core/ui.js`: `UI.paginate` + `UI.renderPagination`). Cambiar un filtro o búsqueda vuelve siempre a la página 1.

## Dashboard de Admin (KPIs)

8 KPIs distribuidos en una grilla de 4x4: Clientes activos, Ingresos del mes, ARPU (mes actual), Tasa de renovación, Próximos a vencer, Vencidos, Bajas este mes (clientes dados de baja en el mes calendario en curso) y Día de mayor concurrencia (día de la semana con más asistencias históricas).

> **ARPU** = *Average Revenue Per User*: ingresos del mes en curso ÷ clientes activos. Es cuánto "vale" en promedio cada cliente activo ese mes.

## El modelo de cuotas (lo más importante para entender la demo)

- Dos planes: **Base** ($60.000/mes, hasta 8 días de asistencia) y **Premium** ($70.000/mes, hasta 20 días).
- El control ya no es "días a la semana" (que generaba abusos difíciles de controlar), sino **días disponibles dentro de un período mensual de cuota**.
- Cada período corre del **día 10 de un mes al día 9 del mes siguiente** (inclusive), sin importar si el mes tiene 28, 29, 30 o 31 días.
- Modelo de pago: **mes adelantado**. Pagar el día 10 (o antes) habilita el período que arranca ese mismo día 10. Pagar después del 10 activa el período que ya está en curso ese mismo mes — pero un pago **nunca cubre retroactivamente** un período anterior que se salteó.
- Toda esta lógica vive en `js/core/fees.js`, sin dependencias del DOM, así que se puede testear en aislado (ver `debug-tests.html`).

## Datos de la demo

Al abrir cualquier pantalla por primera vez, se siembran automáticamente ~70 clientes ficticios con nombres/DNIs argentinos, ~12 meses de historial de pagos y asistencias, y un log de notificaciones simulado derivado de ese historial. Todo queda guardado en `localStorage` del navegador, así que las acciones que hagas durante la demo (registrar un pago, dar de alta un cliente, escanear un DNI en el kiosko) se ven reflejadas al toque en las otras pantallas.

Para volver a un estado limpio entre demos, usá el botón **"Reiniciar datos demo"** en el header de Secretaría o Admin.

> Nota: como los datos se generan a partir de la fecha real del sistema, el mix de clientes "al día" / "próximo a vencer" / "vencido" que vas a ver depende de qué tan cerca esté hoy del día 10. Si la demo se corre a pocos días del vencimiento, es esperable ver muchos clientes en "próximo a vencer" — es el comportamiento real de un sistema donde todos los clientes comparten la misma fecha de corte.

## Diseño

Paleta y tipografía (Barlow Condensed + Barlow, dark mode) elegidas con el skill `ui-ux-pro-max` (copiado a `.claude/skills/` en este repo) en base al logo del cliente y al rubro (gimnasio / fitness). Tokens de diseño centralizados en `css/tokens.css`.

## Fuera de alcance (v1)

Todo lo referido a rutinas de entrenamiento para clientes queda explícitamente fuera de esta primera versión.
