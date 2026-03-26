import { escapeHtml, formatDate, renderEmpty, requestJson, setNotice, statusBadge } from "./shared.js";

const form = document.querySelector("[data-create-form]");
const projectInput = document.querySelector("[name='project_id']");
const listTarget = document.querySelector("[data-instance-list]");
const notice = document.querySelector("[data-compute-notice]");
const refreshButton = document.querySelector("[data-refresh]");

async function loadInstances() {
  const projectId = projectInput.value.trim();
  if (!projectId) {
    renderEmpty(listTarget, "Enter a project ID to load instances.");
    return;
  }

  try {
    const items = await requestJson(`/instances?project_id=${encodeURIComponent(projectId)}`);
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
  }
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
