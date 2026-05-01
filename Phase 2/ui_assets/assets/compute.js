import { escapeHtml, formatDate, renderEmpty, requestJson, setNotice, statusBadge } from "./shared.js";

const form = document.querySelector("[data-create-form]");
const scaleForm = document.querySelector("[data-scale-form]");
const projectInput = document.querySelector("[name='project_id']");
const listTarget = document.querySelector("[data-instance-list]");
const summaryTarget = document.querySelector("[data-compute-summary]");
const notice = document.querySelector("[data-compute-notice]");
const refreshButton = document.querySelector("[data-refresh]");

async function loadInstances() {
  const projectId = projectInput.value.trim();
  if (!projectId) {
    renderEmpty(listTarget, "Enter a project ID to load instances.");
    renderEmpty(summaryTarget, "Project details appear here after you load a project.");
    return;
  }

  try {
    const items = await requestJson(`/instances?project_id=${encodeURIComponent(projectId)}`);
    renderSummary(projectId, items);
    if (!items.length) {
      renderEmpty(listTarget, "No active instances for this project.");
      return;
    }
    listTarget.innerHTML = items
      .map(
        (item) => `
          <article class="item-card">
            <div class="item-head">
              <h3 class="item-title">${escapeHtml(item.name)}</h3>
              ${statusBadge(item.status)}
            </div>
            <div class="meta">
              <span>${escapeHtml(item.image)}</span>
              <span>cpu ${item.cpu_millicores}m</span>
              <span>mem ${item.memory_mb} MB</span>
              <span>${escapeHtml(item.network_name)}</span>
              <span>${formatDate(item.updated_at)}</span>
            </div>
            <div class="actions">
              <button class="secondary" data-stop="${item.id}">Stop</button>
              <button data-delete="${item.id}">Delete</button>
            </div>
          </article>
        `,
      )
      .join("");
  } catch (error) {
    renderEmpty(listTarget, error.message);
    renderEmpty(summaryTarget, "Could not load project details.");
  }
}

function renderSummary(projectId, items) {
  if (!items.length) {
    summaryTarget.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Project</span>
          <strong class="stat-value">${escapeHtml(projectId)}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Current instances</span>
          <strong class="stat-value">0</strong>
        </div>
      </div>
    `;
    return;
  }

  const runningCount = items.filter((item) => item.status === "running").length;
  const stoppedCount = items.filter((item) => item.status === "stopped").length;
  const latest = items[0];
  summaryTarget.innerHTML = `
    <div class="stat-grid">
      <div class="stat">
        <span class="stat-label">Project</span>
        <strong class="stat-value">${escapeHtml(projectId)}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Current instances</span>
        <strong class="stat-value">${items.length}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Running</span>
        <strong class="stat-value">${runningCount}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Stopped</span>
        <strong class="stat-value">${stoppedCount}</strong>
      </div>
    </div>
    <article class="item-card" style="margin-top:16px">
      <div class="item-head">
        <h3 class="item-title">Workload profile</h3>
        ${statusBadge(latest.status)}
      </div>
      <div class="meta">
        <span>${escapeHtml(latest.image)}</span>
        <span>cpu ${latest.cpu_millicores}m</span>
        <span>mem ${latest.memory_mb} MB</span>
        <span>${escapeHtml(latest.network_name)}</span>
        <span>${escapeHtml(formatDate(latest.updated_at))}</span>
      </div>
    </article>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = {
    project_id: formData.get("project_id"),
    image: formData.get("image"),
    cpu_millicores: Number(formData.get("cpu_millicores")),
    memory_mb: Number(formData.get("memory_mb")),
    name: formData.get("name") || null,
  };

  try {
    await requestJson("/instance", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setNotice(notice, "Instance created.", "success");
    await loadInstances();
  } catch (error) {
    setNotice(notice, error.message, "error");
  }
});

scaleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(scaleForm);
  const payload = {
    project_id: formData.get("project_id"),
    target_instances: Number(formData.get("target_instances")),
    name_prefix: formData.get("name_prefix") || null,
    image: formData.get("image") || null,
    cpu_millicores: formData.get("cpu_millicores") ? Number(formData.get("cpu_millicores")) : null,
    memory_mb: formData.get("memory_mb") ? Number(formData.get("memory_mb")) : null,
  };

  try {
    const result = await requestJson("/scale", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    projectInput.value = payload.project_id;
    setNotice(
      notice,
      `Scale applied. Current count: ${result.current_count}.`,
      "success",
    );
    await loadInstances();
  } catch (error) {
    setNotice(notice, error.message, "error");
  }
});

refreshButton.addEventListener("click", loadInstances);

listTarget.addEventListener("click", async (event) => {
  const stopId = event.target.getAttribute("data-stop");
  const deleteId = event.target.getAttribute("data-delete");
  if (!stopId && !deleteId) return;

  try {
    if (stopId) {
      await requestJson(`/instance/${stopId}/stop`, { method: "POST" });
      setNotice(notice, "Instance stopped.", "success");
    }
    if (deleteId) {
      await requestJson(`/instance/${deleteId}`, { method: "DELETE" });
      setNotice(notice, "Instance deleted.", "success");
    }
    await loadInstances();
  } catch (error) {
    setNotice(notice, error.message, "error");
  }
});

loadInstances();
