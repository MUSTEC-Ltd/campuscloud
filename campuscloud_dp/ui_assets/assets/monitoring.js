import { escapeHtml, formatDate, formatDuration, formatMoney, renderEmpty, requestJson, setNotice, statusBadge } from "./shared.js";

const form = document.querySelector("[data-monitoring-form]");
const notice = document.querySelector("[data-monitoring-notice]");
const latest = document.querySelector("[data-latest-metric]");
const billingOverview = document.querySelector("[data-billing-overview]");
const instanceMetrics = document.querySelector("[data-instance-metrics]");
const tableBody = document.querySelector("[data-metric-table]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadMetrics();
});

async function loadMetrics() {
  const projectId = form.project_id.value.trim();
  const limit = form.limit.value.trim() || "20";
  if (!projectId) {
    renderEmpty(latest, "Enter a project ID to view recent metrics.");
    renderEmpty(billingOverview, "Estimated billing appears here after you load a project.");
    renderEmpty(instanceMetrics, "Project-level usage appears here after a query runs.");
    tableBody.innerHTML = "";
    return;
  }

  try {
    const data = await requestJson(`/metrics/${encodeURIComponent(projectId)}?limit=${encodeURIComponent(limit)}`);
    setNotice(notice, `Loaded ${data.sample_count} samples.`, "success");
    if (!data.latest) {
      renderEmpty(latest, "No metric samples yet. Start a container and let the collector run.");
      renderEmpty(billingOverview, "Estimated billing becomes available after the first usage sample is collected.");
      renderEmpty(instanceMetrics, "No instance metrics are available yet for this project.");
      tableBody.innerHTML = "";
      return;
    }

    latest.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Project CPU</span>
          <strong class="stat-value">${data.totals.cpu_percent.toFixed(2)}%</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Project memory</span>
          <strong class="stat-value">${data.totals.memory_mb.toFixed(2)} MB</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Project runtime</span>
          <strong class="stat-value">${escapeHtml(formatDuration(data.totals.runtime_seconds))}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Latest capture</span>
          <strong class="stat-value">${escapeHtml(formatDate(data.latest.collected_at))}</strong>
        </div>
      </div>
    `;

    billingOverview.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Estimated billing</span>
          <strong class="stat-value">${escapeHtml(formatMoney(data.billing.amount_usd, data.billing.currency))}</strong>
        </div>
        <div class="stat">
          <span class="stat-label">Tracked instances</span>
          <strong class="stat-value">${data.instance_count}</strong>
        </div>
      </div>
      <article class="item-card" style="margin-top:16px">
        <div class="meta">
          <span>cpu rate ${escapeHtml(formatMoney(data.billing.cpu_hour_rate_usd, data.billing.currency))}/hour</span>
          <span>memory rate ${escapeHtml(formatMoney(data.billing.memory_gb_hour_rate_usd, data.billing.currency))}/GB-hour</span>
          <span>latest capture ${escapeHtml(formatDate(data.latest.collected_at))}</span>
        </div>
      </article>
    `;

    if (!data.instances.length) {
      renderEmpty(instanceMetrics, "No tracked instances for this project.");
    } else {
      instanceMetrics.innerHTML = data.instances
        .map(
          (item) => `
            <article class="item-card">
              <div class="item-head">
                <h3 class="item-title">${escapeHtml(item.name)}</h3>
                ${statusBadge(item.status)}
              </div>
              <div class="meta">
                <span>${escapeHtml(item.image)}</span>
                <span>cpu ${item.latest_cpu_percent === null ? "n/a" : `${item.latest_cpu_percent.toFixed(2)}%`}</span>
                <span>mem ${item.latest_memory_mb === null ? "n/a" : `${item.latest_memory_mb.toFixed(2)} MB`}</span>
                <span>runtime ${escapeHtml(formatDuration(item.latest_runtime_seconds))}</span>
                <span>bill ${escapeHtml(formatMoney(item.estimated_billing_usd))}</span>
                <span>${escapeHtml(formatDate(item.last_collected_at))}</span>
              </div>
            </article>
          `,
        )
        .join("");
    }

    tableBody.innerHTML = data.samples
      .map(
        (sample) => `
          <tr>
            <td>${escapeHtml(sample.instance_id)}</td>
            <td>${sample.cpu_percent.toFixed(2)}%</td>
            <td>${sample.memory_mb.toFixed(2)} MB</td>
            <td>${escapeHtml(formatDuration(sample.runtime_seconds))}</td>
            <td>${escapeHtml(formatDate(sample.collected_at))}</td>
          </tr>
        `,
      )
      .join("");
  } catch (error) {
    setNotice(notice, error.message, "error");
    renderEmpty(latest, "Could not load monitoring data.");
    renderEmpty(billingOverview, "Could not load billing information.");
    renderEmpty(instanceMetrics, "Could not load per-instance usage.");
    tableBody.innerHTML = "";
  }
}

loadMetrics();