/**
 * Shared utility functions used across CampusCloud UI modules.
 */

export async function requestJson(url, opts = {}) {
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  if (resp.status === 204) return null;

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.detail || `${resp.status} ${resp.statusText}`);
  }
  return body;
}

export function setNotice(el, msg = "", type = "") {
  el.textContent = msg;
  el.className = "notice";
  if (type) el.classList.add(type);
}

export function formatDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleString();
}

export function escapeHtml(text) {
  const str = String(text ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function statusBadge(status) {
  const label = escapeHtml(status || "unknown");
  return `<span class="badge ${label}">${label}</span>`;
}

export function renderEmpty(container, msg) {
  container.innerHTML = `<div class="empty">${escapeHtml(msg)}</div>`;
}
