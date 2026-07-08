// Wrapper simple sobre localStorage, namespaced y versionado.
const NAMESPACE = 'loent:v1';
const SCHEMA_VERSION = 1;

function nsKey(key) {
  return `${NAMESPACE}:${key}`;
}

function getItem(key, fallback) {
  const raw = localStorage.getItem(nsKey(key));
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`storage: no se pudo parsear "${key}"`, e);
    return fallback;
  }
}

function setItem(key, value) {
  localStorage.setItem(nsKey(key), JSON.stringify(value));
}

function removeItem(key) {
  localStorage.removeItem(nsKey(key));
}

function clearNamespace() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${NAMESPACE}:`)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

window.Storage_ = { SCHEMA_VERSION, getItem, setItem, removeItem, clearNamespace };
