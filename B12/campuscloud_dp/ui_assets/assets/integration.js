import { escapeHtml, formatDate, renderEmpty, requestJson, setNotice } from "./shared.js";

const form = document.querySelector("[data-integration-form]");
const notice = document.querySelector("[data-integration-notice]");
const statusTarget = document.querySelector("[data-integration-status]");
const snapshotTarget = document.querySelector("[data-project-snapshot]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadIntegration();
});

async function loadIntegration() {
  const projectId = form.project_id.value.trim();
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";

  try {
    const data = await requestJson(`/ui/api/integration${query}`);
    setNotice(notice, "Integration state loaded.", "success");
    statusTarget.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Health</span>
          <strong class="stat-value">${escapeHtml(data.health)}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Metrics worker</span>
          <strong class="stat-value">${data.metrics_worker_running ? "running" : "stopped"}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Poll interval</span>
          <strong class="stat-value">${data.settings.metrics_poll_interval_seconds}s</strong>
        </div>
      </div>
      <div class="item-card" style="margin-top:16px">
        <strong class="inline-code">startup features</strong>
        <div class="meta" style="margin-top:10px">
          ${data.startup_features.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
    `;

    if (!data.project_snapshot) {
      renderEmpty(snapshotTarget, "No project selected. Add a project id to inspect the module handoff state.");
      return;
    }

    const statuses = Object.entries(data.project_snapshot.status_breakdown)
      .map(([status, count]) => `${escapeHtml(status)}: ${count}`)
      .join(" | ");
    snapshotTarget.innerHTML = data.project_snapshot.instances.length
      ? data.project_snapshot.instances
          .map(
            (instance) => `
              <article class="item-card">
                <div class="item-head">
                  <h3 class="item-title">${escapeHtml(instance.name)}</h3>
                  <span class="badge ${escapeHtml(instance.status)}">${escapeHtml(instance.status)}</span>
                </div>
                <div class="meta">
                  <span>${escapeHtml(instance.project_id)}</span>
                  <span>${escapeHtml(instance.network_name)}</span>
                  <span>${escapeHtml(formatDate(instance.updated_at))}</span>
                </div>
              </article>
            `,
          )
          .join("") + `<div class="item-card"><strong>Breakdown:</strong> ${statuses}</div>`
      : `<div class="empty">Project selected, but no active instances are tracked.</div>`;
  } catch (error) {
    setNotice(notice, error.message, "error");
    renderEmpty(statusTarget, "Could not load integration status.");
    renderEmpty(snapshotTarget, "Could not load project snapshot.");
  }
}

loadIntegration();

