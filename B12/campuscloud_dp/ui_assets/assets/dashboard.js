import { escapeHtml, formatDate, renderEmpty, requestJson, statusBadge } from "./shared.js";

const summaryTarget = document.querySelector("[data-summary]");
const recentTarget = document.querySelector("[data-recent]");
const modulesTarget = document.querySelector("[data-modules]");

async function loadDashboard() {
  try {
    const data = await requestJson("/ui/api/summary");
    renderSummary(data);
    renderRecent(data.recent_instances);
    renderModules(data.modules);
  } catch (error) {
    renderEmpty(summaryTarget, error.message);
    renderEmpty(recentTarget, "Could not load recent activity.");
  }
}

function renderSummary(data) {
  const cards = Object.entries(data.status_breakdown);
  summaryTarget.innerHTML = `
    <div class="stat">
      <span class="stat-label">Active instances</span>
      <strong class="stat-value">${data.active_instance_count}</strong>
    </div>
    ${cards
      .map(
        ([status, count]) => `
          <div class="stat">
            <span class="stat-label">${escapeHtml(status)}</span>
            <strong class="stat-value">${count}</strong>
          </div>
        `,
      )
      .join("")}
  `;
}

function renderRecent(instances) {
  if (!instances.length) {
    renderEmpty(recentTarget, "No tracked instances yet. Create one from the compute page.");
    return;
  }

  recentTarget.innerHTML = instances
    .map(
      (instance) => `
        <article class="item-card">
          <div class="item-head">
            <h3 class="item-title">${escapeHtml(instance.name)}</h3>
            ${statusBadge(instance.status)}
          </div>
          <div class="meta">
            <span>${escapeHtml(instance.project_id)}</span>
            <span>${escapeHtml(instance.image)}</span>
            <span>${escapeHtml(instance.network_name)}</span>
            <span>${formatDate(instance.updated_at)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderModules(modules) {
  modulesTarget.innerHTML = modules
    .map(
      (module) => `
        <a class="module-card" href="${module.ui_path}">
          <h3>${escapeHtml(module.title)}</h3>
          <p>Open the dedicated workspace and the linked documents for this module.</p>
          <footer>
            <span>UI</span>
            <span>PDF docs</span>
          </footer>
        </a>
      `,
    )
    .join("");
}

loadDashboard();

