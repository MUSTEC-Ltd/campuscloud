import { escapeHtml, formatDate, renderEmpty, requestJson, setNotice } from "./shared.js";

const form = document.querySelector("[data-monitoring-form]");
const notice = document.querySelector("[data-monitoring-notice]");
const latest = document.querySelector("[data-latest-metric]");
const tableBody = document.querySelector("[data-metric-table]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadMetrics();
});

async function loadMetrics() {
  const projectId = form.project_id.value.trim();
  if (!projectId) {
    renderEmpty(latest, "Enter a project ID to view recent metrics.");
    tableBody.innerHTML = "";
    return;
  }

  try {
    const data = await requestJson(`/ui/api/metrics?project_id=${encodeURIComponent(projectId)}`);
    setNotice(notice, `Loaded ${data.sample_count} samples.`, "success");
    if (!data.latest) {
      renderEmpty(latest, "No metric samples yet. Start a container and let the collector run.");
      tableBody.innerHTML = "";
      return;
    }

    latest.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Latest CPU</span>
          <strong class="stat-value">${data.latest.cpu_percent.toFixed(2)}%</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Latest memory</span>
          <strong class="stat-value">${data.latest.memory_mb.toFixed(2)} MB</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Captured</span>
          <strong class="stat-value">${escapeHtml(formatDate(data.latest.collected_at))}</strong>
        </div>
      </div>
    `;

    tableBody.innerHTML = data.samples
      .map(
        (sample) => `
          <tr>
            <td>${escapeHtml(sample.instance_id)}</td>
            <td>${sample.cpu_percent.toFixed(2)}%</td>
            <td>${sample.memory_mb.toFixed(2)} MB</td>
            <td>${escapeHtml(formatDate(sample.collected_at))}</td>
          </tr>
        `,
      )
      .join("");
  } catch (error) {
    setNotice(notice, error.message, "error");
    renderEmpty(latest, "Could not load monitoring data.");
    tableBody.innerHTML = "";
  }
}

loadMetrics();
