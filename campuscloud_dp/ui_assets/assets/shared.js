export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.detail || `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return data;
}

export function setNotice(element, message = "", tone = "") {
  element.textContent = message;
  element.className = "notice";
  if (tone) {
    element.classList.add(tone);
  }
}

export function formatDate(value) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function statusBadge(status) {
  const safe = escapeHtml(status || "unknown");
  return `<span class="badge ${safe}">${safe}</span>`;
}

export function renderEmpty(target, message) {
  target.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

