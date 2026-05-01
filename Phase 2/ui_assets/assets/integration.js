import { escapeHtml, formatDate, formatDuration, formatMoney, renderEmpty, requestJson, setNotice } from "./shared.js";

const form = document.querySelector("[data-integration-form]");
const notice = document.querySelector("[data-integration-notice]");
const statusTarget = document.querySelector("[data-integration-status]");
const serviceSummaryTarget = document.querySelector("[data-service-summary]");
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
    setNotice(notice, "Operational status loaded.", "success");
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
        <div class="stat">
          <span class="stat-label">Quota mode</span>
          <strong class="stat-value">${escapeHtml(data.quota.mode)}</strong>
        </div>
      </div>
    `;

    serviceSummaryTarget.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Network prefix</span>
          <strong class="stat-value">${escapeHtml(data.settings.project_network_prefix)}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Stop timeout</span>
          <strong class="stat-value">${data.settings.stop_timeout_seconds}s</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Scale service</span>
          <strong class="stat-value">ready</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Metrics feed</span>
          <strong class="stat-value">ready</strong>
        </div>
      </div>
      <article class="item-card" style="margin-top:16px">
        <div class="meta">
          ${data.platform_features.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </article>
    `;

    if (!data.project_snapshot) {
      renderEmpty(snapshotTarget, "No project selected. Add a project ID to inspect service state.");
      return;
    }

    const statuses = Object.entries(data.project_snapshot.status_breakdown)
      .map(([status, count]) => `${escapeHtml(status)}: ${count}`)
      .join(" | ");
    const profile = data.project_snapshot.workload_profile;
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
          .join("") +
          `
            <div class="item-card">
              <strong>Breakdown:</strong> ${statuses}
            </div>
            <div class="item-card">
              <strong>Scalable instances:</strong> ${data.project_snapshot.scalable_instance_count}
            </div>
            <div class="item-card">
              <strong>Workload profile:</strong>
              ${
                profile
                  ? `${escapeHtml(profile.image)} | cpu ${profile.cpu_millicores}m | mem ${profile.memory_mb} MB`
                  : "n/a"
              }
            </div>
            <div class="item-card">
              <strong>Latest totals:</strong>
              cpu ${data.project_snapshot.latest_metrics.cpu_percent.toFixed(2)}% |
              mem ${data.project_snapshot.latest_metrics.memory_mb.toFixed(2)} MB |
              runtime ${escapeHtml(formatDuration(data.project_snapshot.latest_metrics.runtime_seconds))}
            </div>
            <div class="item-card">
              <strong>Estimated billing:</strong>
              ${escapeHtml(formatMoney(data.project_snapshot.billing.amount_usd, data.project_snapshot.billing.currency))}
            </div>
          `
      : `<div class="empty">Project selected, but no active instances are tracked.</div>`;
  } catch (error) {
    setNotice(notice, error.message, "error");
    renderEmpty(statusTarget, "Could not load platform status.");
    renderEmpty(serviceSummaryTarget, "Could not load service details.");
    renderEmpty(snapshotTarget, "Could not load project snapshot.");
  }
}

loadIntegration();
