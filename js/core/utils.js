// Helpers de fecha, moneda, DNI, ids y sonido. Sin dependencias externas.

// --- Fechas ---
// Regla de oro: nunca usar toISOString() para fechas "de calendario" (desplaza por UTC-3
// y puede cambiar el día cerca de medianoche). Siempre formatear a mano desde los getters
// locales, y siempre construir fechas con new Date(año, mes, día) para que JS normalice
// el desborde de mes automáticamente (día 32 de enero -> 1 de febrero, etc).

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateAtDay(year, monthIndex, day) {
  // monthIndex 0-based. JS normaliza year/monthIndex/day fuera de rango.
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function formatISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return dateAtDay(y, m - 1, d);
}

function todayISO() {
  return formatISODate(new Date());
}

function nowHHmm() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function nowISOTimestamp() {
  const d = new Date();
  return `${formatISODate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function addMonths(date, n) {
  return dateAtDay(date.getFullYear(), date.getMonth() + n, date.getDate());
}

function addDays(date, n) {
  return dateAtDay(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function diffInDays(dateA, dateB) {
  // dateA - dateB en días, ambas normalizadas a medianoche local.
  const a = dateAtDay(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
  const b = dateAtDay(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
  return Math.round((a - b) / 86400000);
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_ES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function formatDateEs(date, opts = {}) {
  const { withWeekday = false, short = false } = opts;
  const mes = short ? MESES_ES_SHORT[date.getMonth()] : MESES_ES[date.getMonth()];
  const base = `${date.getDate()} de ${mes} de ${date.getFullYear()}`;
  if (!withWeekday) return base;
  return `${DIAS_ES[date.getDay()]} ${base}`;
}

function formatDateShortEs(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// --- Moneda ---
function formatCurrencyARS(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

// --- DNI ---
function formatDNI(dni) {
  const s = String(dni);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function isValidDNI(dni) {
  return /^\d{7,8}$/.test(String(dni).trim());
}

// --- IDs ---
let idCounter = 0;
function uid(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

// --- PRNG determinístico (mulberry32) para datos mock reproducibles ---
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Sonido (Web Audio API, sin assets externos) ---
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  return audioCtx;
}

function playTone(freq, durationMs, opts = {}) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const { type = 'sine', gain = 0.18, delayMs = 0 } = opts;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const startAt = ctx.currentTime + delayMs / 1000;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(gain, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + durationMs / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + durationMs / 1000 + 0.02);
  } catch (e) {
    console.warn('audio: no se pudo reproducir sonido', e);
  }
}

function playSuccessSound() {
  playTone(660, 130, { type: 'sine', delayMs: 0 });
  playTone(880, 200, { type: 'sine', delayMs: 120 });
}

function playErrorSound() {
  playTone(220, 220, { type: 'square', gain: 0.12, delayMs: 0 });
  playTone(160, 260, { type: 'square', gain: 0.12, delayMs: 180 });
}

function playWarnSound() {
  playTone(440, 160, { type: 'triangle', delayMs: 0 });
  playTone(440, 160, { type: 'triangle', delayMs: 200 });
}

// --- Otros ---
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function avatarUrlForDni(dni) {
  return `https://i.pravatar.cc/300?u=${encodeURIComponent(dni)}`;
}

window.Utils = {
  pad2,
  dateAtDay,
  formatISODate,
  parseISODate,
  todayISO,
  nowHHmm,
  nowISOTimestamp,
  addMonths,
  addDays,
  diffInDays,
  formatDateEs,
  formatDateShortEs,
  formatCurrencyARS,
  formatDNI,
  isValidDNI,
  uid,
  mulberry32,
  playTone,
  playSuccessSound,
  playErrorSound,
  playWarnSound,
  debounce,
  escapeHtml,
  avatarUrlForDni,
  MESES_ES,
  MESES_ES_SHORT,
  DIAS_ES,
};
