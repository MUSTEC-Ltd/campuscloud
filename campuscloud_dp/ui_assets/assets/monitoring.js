import { escapeHtml, formatDate, renderEmpty, requestJson, setNotice } from "./shared.js";

const metricsForm = document.querySelector("[data-monitoring-form]");
const noticeEl = document.querySelector("[data-monitoring-notice]");
const latestEl = document.querySelector("[data-latest-metric]");
const samplesBody = document.querySelector("[data-metric-table]");

metricsForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  fetchMetrics();
});

async function fetchMetrics() {
  const projectId = metricsForm.project_id.value.trim();

  if (!projectId) {
    renderEmpty(latestEl, "Please enter a project ID to load metrics.");
    samplesBody.innerHTML = "";
    return;
  }

  try {
    const result = await requestJson(
      `/ui/api/metrics?project_id=${encodeURIComponent(projectId)}`
    );
    setNotice(noticeEl, `Fetched ${result.sample_count} sample(s).`, "success");

    if (!result.latest) {
      renderEmpty(latestEl, "No samples found yet. Deploy a container and wait for the collector to run.");
      samplesBody.innerHTML = "";
      return;
    }

    renderLatestStats(result.latest);
    renderSamplesTable(result.samples);
  } catch (err) {
    setNotice(noticeEl, err.message, "error");
    renderEmpty(latestEl, "Failed to retrieve monitoring data.");
    samplesBody.innerHTML = "";
  }
}

function renderLatestStats(latest) {
  latestEl.innerHTML = `
    <div class="stat-grid">
      <div class="stat">
        <span class="stat-label">CPU usage</span>
        <strong class="stat-value">${latest.cpu_percent.toFixed(2)}%</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Memory usage</span>
        <strong class="stat-value">${latest.memory_mb.toFixed(2)} MB</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Collected</span>
        <strong class="stat-value">${escapeHtml(formatDate(latest.collected_at))}</strong>
      </div>
    </div>
  `;
}

function renderSamplesTable(samples) {
  samplesBody.innerHTML = samples
    .map((s) => `
      <tr>
        <td>${escapeHtml(s.instance_id)}</td>
        <td>${s.cpu_percent.toFixed(2)}%</td>
        <td>${s.memory_mb.toFixed(2)} MB</td>
        <td>${escapeHtml(formatDate(s.collected_at))}</td>
      </tr>
    `)
    .join("");
}

// Load data on page open
fetchMetrics();
