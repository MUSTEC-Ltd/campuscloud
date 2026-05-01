import { escapeHtml, renderEmpty, requestJson, setNotice, statusBadge } from "./shared.js";

const form = document.querySelector("[data-network-form]");
const notice = document.querySelector("[data-network-notice]");
const summary = document.querySelector("[data-network-summary]");
const instances = document.querySelector("[data-network-instances]");
const rules = document.querySelector("[data-network-rules]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadNetwork();
});

async function loadNetwork() {
  const projectId = form.project_id.value.trim();
  if (!projectId) {
    renderEmpty(summary, "Enter a project ID to inspect network state.");
    renderEmpty(instances, "No project selected.");
    rules.innerHTML = "";
    return;
  }

  try {
    const data = await requestJson(`/ui/api/network-overview?project_id=${encodeURIComponent(projectId)}`);
    setNotice(notice, `Loaded network state for ${projectId}.`, "success");
    summary.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Network name</span>
          <strong class="stat-value inline-code">${escapeHtml(data.network_name)}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Active containers</span>
          <strong class="stat-value">${data.active_instance_count}</strong>
        </div>
      </div>
    `;
    rules.innerHTML = `
      <article class="item-card">
        <div class="item-head">
          <h3 class="item-title">Isolation</h3>
          <span class="badge running">stable</span>
        </div>
        <div class="meta">
          <span>Dedicated project network</span>
          <span>Cross-project separation active</span>
        </div>
      </article>
      <article class="item-card">
        <div class="item-head">
          <h3 class="item-title">Cleanup</h3>
          <span class="badge running">automatic</span>
        </div>
        <div class="meta">
          <span>Unused networks removed when capacity reaches zero</span>
        </div>
      </article>
      <article class="item-card">
        <div class="item-head">
          <h3 class="item-title">Project scope</h3>
          <span class="badge running">active</span>
        </div>
        <div class="meta">
          <span>${escapeHtml(data.project_id)}</span>
          <span>${data.active_instance_count} tracked container(s)</span>
        </div>
      </article>
    `;

    if (!data.instances.length) {
      renderEmpty(instances, "No active instances are currently attached to this project network.");
      return;
    }

    instances.innerHTML = data.instances
      .map(
        (item) => `
          <article class="item-card">
            <div class="item-head">
              <h3 class="item-title">${escapeHtml(item.name)}</h3>
              ${statusBadge(item.status)}
            </div>
            <div class="meta">
              <span>${escapeHtml(item.id)}</span>
              <span>${escapeHtml(item.docker_container_id || "n/a")}</span>
            </div>
          </article>
        `,
      )
      .join("");
  } catch (error) {
    setNotice(notice, error.message, "error");
    renderEmpty(summary, "Could not load network state.");
    renderEmpty(instances, "Could not load attached instances.");
  }
}

loadNetwork();
