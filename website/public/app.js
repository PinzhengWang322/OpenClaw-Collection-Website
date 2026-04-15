const appRoot = document.getElementById("app");
const detailModal = document.getElementById("detail-modal");

const categoryDefinitions = {
  movies: {
    fields: [
      { key: "type", label: "类型" },
      { key: "time", label: "观看时间" },
      { key: "origin", label: "产地" },
      { key: "theme", label: "主题" }
    ]
  },
  games: {
    fields: [
      { key: "type", label: "类型" },
      { key: "time", label: "游玩时间" },
      { key: "origin", label: "产地" },
      { key: "theme", label: "主题" }
    ]
  },
  places: {
    fields: [
      { key: "event", label: "事件" },
      { key: "city", label: "城市" },
      { key: "time", label: "时间" },
      { key: "impression", label: "印象" }
    ]
  }
};

const modalNodes = {
  close: document.getElementById("modal-close"),
  edit: document.getElementById("modal-edit"),
  category: document.getElementById("modal-category"),
  title: document.getElementById("modal-title"),
  subtitle: document.getElementById("modal-subtitle"),
  cardInfo: document.getElementById("modal-card-info"),
  intro: document.getElementById("modal-intro"),
  review: document.getElementById("modal-review"),
  image: document.getElementById("modal-image"),
  caption: document.getElementById("modal-caption"),
  galleryPrev: document.getElementById("gallery-prev"),
  galleryNext: document.getElementById("gallery-next"),
  galleryIndex: document.getElementById("gallery-index")
};

const adminNodes = {
  toggle: document.getElementById("admin-toggle"),
  panel: document.getElementById("admin-panel"),
  password: document.getElementById("admin-password"),
  itemForm: document.getElementById("item-form"),
  itemFormTitle: document.getElementById("item-form-title"),
  mode: document.getElementById("admin-mode"),
  category: document.getElementById("admin-category"),
  itemPicker: document.getElementById("admin-item-picker"),
  item: document.getElementById("admin-item"),
  fields: document.getElementById("admin-fields"),
  title: document.getElementById("item-title"),
  subtitle: document.getElementById("item-subtitle"),
  teaser: document.getElementById("item-teaser"),
  intro: document.getElementById("item-intro"),
  review: document.getElementById("item-review"),
  cover: document.getElementById("item-cover"),
  galleryWrap: document.getElementById("item-gallery-wrap"),
  gallery: document.getElementById("item-gallery"),
  status: document.getElementById("item-form-status"),
  submit: document.getElementById("item-submit"),
  reset: document.getElementById("item-form-reset"),
  delete: document.getElementById("item-delete"),
  galleryForm: document.getElementById("gallery-form"),
  galleryItem: document.getElementById("gallery-item"),
  galleryFiles: document.getElementById("gallery-files"),
  galleryStatus: document.getElementById("gallery-form-status"),
  gallerySubmit: document.getElementById("gallery-submit")
};

const state = {
  collection: null,
  pages: {},
  activeItem: null,
  activeGalleryIndex: 0,
  lastUpdatedAt: "",
  pollTimer: null,
  adminPanelOpen: false,
  adminMode: "create",
  adminCategoryId: "movies",
  adminItemId: "",
  galleryItemId: ""
};

const passwordStorageKey = "openclaw-collection-showcase-admin-password";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(target, message, type = "") {
  target.textContent = message || "";
  target.dataset.state = type;
}

function getCategoryById(categoryId) {
  return state.collection?.categories.find((entry) => entry.id === categoryId) || null;
}

function getCategoryDefinition(categoryId) {
  return categoryDefinitions[categoryId] || { fields: [] };
}

function getItemById(itemId) {
  if (!state.collection || !itemId) return null;
  for (const category of state.collection.categories) {
    const item = category.items.find((entry) => entry.id === itemId);
    if (item) return item;
  }
  return null;
}

function getItemsForCategory(categoryId) {
  return getCategoryById(categoryId)?.items || [];
}

function getAllItems() {
  if (!state.collection) return [];
  return state.collection.categories.flatMap((category) =>
    category.items.map((item) => ({
      id: item.id,
      title: item.title,
      timeValue: item.timeValue,
      categoryId: category.id,
      categoryTitle: category.title
    }))
  );
}

function validateTimeValue(value, label) {
  if (!/^\d{2}\.(0[1-9]|1[0-2])$/.test(String(value || "").trim())) {
    throw new Error(`${label} 需要使用 YY.MM 格式，例如 25.03。`);
  }
}

async function requestJson(url, options = {}) {
  const method = options.method || "GET";
  const requiresPassword = options.requiresPassword ?? !["GET", "HEAD"].includes(method);
  const init = {
    method,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  };

  if (requiresPassword) {
    const password = String(adminNodes.password?.value || "").trim();
    if (!password) {
      throw new Error("请先输入管理密码。");
    }
    init.headers["x-admin-password"] = password;
  }

  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "请求失败。");
  }
  return payload;
}

function restoreAdminPassword() {
  const savedPassword = window.localStorage.getItem(passwordStorageKey);
  if (savedPassword && adminNodes.password) {
    adminNodes.password.value = savedPassword;
  }
}

function fileToUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        filename: file.name,
        dataUrl: String(reader.result || "")
      });
    });
    reader.addEventListener("error", () => reject(new Error(`读取文件失败：${file.name}`)));
    reader.readAsDataURL(file);
  });
}

function filesToUploads(fileList) {
  return Promise.all(Array.from(fileList || []).map((file) => fileToUpload(file)));
}

function createMetaList(items) {
  return `
    <ul class="card-meta">
      ${items
        .map(
          (item) => `
            <li>
              <span class="meta-label">${escapeHtml(item.label)}</span>
              <span class="meta-value">${escapeHtml(item.value)}</span>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function createCardMedia(item) {
  if (item.cover) {
    return `<img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}" loading="lazy" />`;
  }

  const initial = escapeHtml((item.title || "?").trim().charAt(0) || "?");
  return `
    <div class="card-placeholder" aria-hidden="true">
      <span>${initial}</span>
    </div>
  `;
}

function createEmptyState(category) {
  return `
    <article class="empty-state">
      <p>${escapeHtml(category.title)} 还没有卡片。</p>
      <span>可以直接打开上面的管理面板，新增第一张。</span>
    </article>
  `;
}

function createPlaceholderCards(count) {
  return Array.from({ length: count }, () => `
    <article class="collection-card placeholder-card" aria-hidden="true">
      <div class="card-surface">
        <div class="card-media placeholder-media"></div>
        <div class="card-body placeholder-body">
          <div class="placeholder-line placeholder-line-title"></div>
          <div class="placeholder-line placeholder-line-subtitle"></div>
          <div class="placeholder-meta">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </article>
  `).join("");
}

function renderSection(category) {
  const currentPage = state.pages[category.id] ?? 0;
  const pageSize = category.pageSize || 12;
  const totalPages = Math.max(1, Math.ceil(category.items.length / pageSize));
  const start = currentPage * pageSize;
  const end = start + pageSize;
  const visibleItems = category.items.slice(start, end);
  const placeholderCount = Math.max(0, pageSize - visibleItems.length);
  const summary = category.summary || category.description || "";

  return `
    <section class="category-section" style="--section-accent: ${escapeHtml(category.accent || "#6c8bab")}">
      <div class="section-header">
        <div class="section-copy">
          <span class="section-kicker">${escapeHtml(category.englishTitle || "")}</span>
          <h2 class="section-title">${escapeHtml(category.title)}</h2>
          <p>${escapeHtml(summary)}</p>
        </div>
        <div class="pager">
          <button type="button" data-action="prev-page" data-category="${escapeHtml(category.id)}" ${currentPage === 0 ? "disabled" : ""}>上一页</button>
          <span class="pager-status">${currentPage + 1} / ${totalPages}</span>
          <button type="button" data-action="next-page" data-category="${escapeHtml(category.id)}" ${currentPage >= totalPages - 1 ? "disabled" : ""}>下一页</button>
        </div>
      </div>

      <div class="card-grid">
        ${
          visibleItems.length === 0
            ? createEmptyState(category)
            : `${visibleItems
                .map(
                  (item) => `
                    <button class="collection-card" type="button" data-action="open-item" data-category="${escapeHtml(category.id)}" data-id="${escapeHtml(item.id)}">
                      <article class="card-surface">
                        <div class="card-media">
                          ${createCardMedia(item)}
                          <div class="card-overlay">
                            <div class="overlay-copy">
                              <span>peek</span>
                              <p>${escapeHtml(item.teaser || "点击查看详情")}</p>
                            </div>
                          </div>
                        </div>
                        <div class="card-body">
                          <h3 class="card-title">${escapeHtml(item.title)}</h3>
                          ${item.subtitle ? `<p class="card-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
                          ${createMetaList(item.cardInfo || [])}
                          <div class="card-footer">
                            <span class="hint">查看详情</span>
                          </div>
                        </div>
                      </article>
                    </button>
                  `
                )
                .join("")}${createPlaceholderCards(placeholderCount)}`
        }
      </div>
    </section>
  `;
}

function renderCatalogue() {
  if (!state.collection) return;
  appRoot.innerHTML = state.collection.categories.map(renderSection).join("");
}

function ensurePageState(collection) {
  for (const category of collection.categories) {
    const totalPages = Math.max(1, Math.ceil(category.items.length / (category.pageSize || 12)));
    const currentPage = state.pages[category.id] ?? 0;
    state.pages[category.id] = Math.min(currentPage, totalPages - 1);
  }
}

function createFactList(target, items) {
  target.innerHTML = items
    .map(
      (item) => `
        <li>
          <span class="meta-label">${escapeHtml(item.label)}</span>
          <span class="meta-value">${escapeHtml(item.value)}</span>
        </li>
      `
    )
    .join("");
}

function getGalleryItems(item) {
  const gallery = Array.isArray(item?.detail?.gallery) ? item.detail.gallery : [];
  if (gallery.length > 0) {
    return gallery;
  }

  if (item?.cover) {
    return [
      {
        src: item.cover,
        caption: item.title || "",
        alt: item.title || ""
      }
    ];
  }

  return [];
}

function updateGallery() {
  if (!state.activeItem) return;

  const gallery = getGalleryItems(state.activeItem);
  const current = gallery[state.activeGalleryIndex];

  if (!current) {
    modalNodes.image.removeAttribute("src");
    modalNodes.image.alt = "";
    modalNodes.caption.textContent = "还没有详情图片。";
    modalNodes.galleryIndex.textContent = "0 / 0";
    modalNodes.galleryPrev.disabled = true;
    modalNodes.galleryNext.disabled = true;
    return;
  }

  modalNodes.image.src = current.src;
  modalNodes.image.alt = current.alt || state.activeItem.title || "";
  modalNodes.caption.textContent = current.caption || "";
  modalNodes.galleryIndex.textContent = `${state.activeGalleryIndex + 1} / ${gallery.length}`;
  modalNodes.galleryPrev.disabled = state.activeGalleryIndex === 0;
  modalNodes.galleryNext.disabled = state.activeGalleryIndex === gallery.length - 1;
}

function openItem(categoryId, itemId) {
  const category = getCategoryById(categoryId);
  const item = category?.items.find((entry) => entry.id === itemId);
  if (!category || !item) return;

  state.activeItem = item;
  state.activeGalleryIndex = 0;
  modalNodes.category.textContent = category.title;
  modalNodes.title.textContent = item.title;
  modalNodes.subtitle.textContent = item.subtitle || "";
  modalNodes.subtitle.style.display = item.subtitle ? "" : "none";
  modalNodes.intro.textContent = item.detail?.intro || "还没有填写简介。";
  modalNodes.review.textContent = item.detail?.review || "还没有填写短评。";
  createFactList(modalNodes.cardInfo, item.cardInfo || []);
  updateGallery();
  detailModal.showModal();
}

function closeModal() {
  detailModal.close();
  state.activeItem = null;
  state.activeGalleryIndex = 0;
}

function syncActiveItem() {
  if (!state.activeItem || !state.collection) return;

  const category = getCategoryById(state.activeItem.categoryId);
  const item = category?.items.find((entry) => entry.id === state.activeItem.id);

  if (!item || !detailModal.open) {
    if (detailModal.open) closeModal();
    return;
  }

  state.activeItem = item;
  const gallery = getGalleryItems(item);
  state.activeGalleryIndex = Math.min(state.activeGalleryIndex, Math.max(0, gallery.length - 1));
  modalNodes.category.textContent = category.title;
  modalNodes.title.textContent = item.title;
  modalNodes.subtitle.textContent = item.subtitle || "";
  modalNodes.subtitle.style.display = item.subtitle ? "" : "none";
  modalNodes.intro.textContent = item.detail?.intro || "还没有填写简介。";
  modalNodes.review.textContent = item.detail?.review || "还没有填写短评。";
  createFactList(modalNodes.cardInfo, item.cardInfo || []);
  updateGallery();
}

function updatePage(categoryId, direction) {
  const category = getCategoryById(categoryId);
  if (!category) return;

  const totalPages = Math.max(1, Math.ceil(category.items.length / (category.pageSize || 12)));
  const currentPage = state.pages[categoryId] ?? 0;
  const nextPage = Math.min(totalPages - 1, Math.max(0, currentPage + direction));
  state.pages[categoryId] = nextPage;
  renderCatalogue();
}

function ensureAdminState(collection) {
  if (!collection) return;

  const categories = collection.categories;
  const firstCategoryId = categories[0]?.id || "movies";
  if (!categories.some((category) => category.id === state.adminCategoryId)) {
    state.adminCategoryId = firstCategoryId;
  }

  const itemsInCurrentCategory = getItemsForCategory(state.adminCategoryId);
  if (state.adminMode === "edit") {
    if (itemsInCurrentCategory.length === 0) {
      const categoryWithItems = categories.find((category) => category.items.length > 0);
      state.adminCategoryId = categoryWithItems?.id || firstCategoryId;
    }

    const nextItems = getItemsForCategory(state.adminCategoryId);
    if (!nextItems.some((item) => item.id === state.adminItemId)) {
      state.adminItemId = nextItems[0]?.id || "";
    }
  }

  const flatItems = getAllItems();
  if (!flatItems.some((item) => item.id === state.galleryItemId)) {
    state.galleryItemId = state.adminItemId || flatItems[0]?.id || "";
  }
}

function createDynamicFieldMarkup(categoryId) {
  const definition = getCategoryDefinition(categoryId);
  return definition.fields
    .map((field) => {
      const placeholder = field.key === "time" ? ' placeholder="25.03" inputmode="numeric"' : "";
      return `
        <label class="form-field">
          <span>${escapeHtml(field.label)}</span>
          <input type="text" data-field-key="${escapeHtml(field.key)}"${placeholder} />
        </label>
      `;
    })
    .join("");
}

function getCardInfoValue(item, label) {
  return item?.cardInfo?.find((entry) => entry.label === label)?.value || "";
}

function populateItemForm() {
  const isEditMode = state.adminMode === "edit";
  const currentItem = isEditMode ? getItemById(state.adminItemId) : null;
  const categoryId = currentItem?.categoryId || state.adminCategoryId;
  const definition = getCategoryDefinition(categoryId);

  adminNodes.fields.innerHTML = createDynamicFieldMarkup(categoryId);
  adminNodes.category.value = categoryId;
  adminNodes.itemPicker.hidden = !isEditMode;
  adminNodes.galleryWrap.hidden = isEditMode;
  adminNodes.itemFormTitle.textContent = isEditMode ? "编辑卡片" : "新增卡片";
  adminNodes.submit.textContent = isEditMode ? "保存修改" : "新增卡片";
  adminNodes.delete.hidden = !isEditMode || !currentItem;

  adminNodes.title.value = currentItem?.title || "";
  adminNodes.subtitle.value = currentItem?.subtitle || "";
  adminNodes.teaser.value = currentItem?.teaser || "";
  adminNodes.intro.value = currentItem?.detail?.intro || "";
  adminNodes.review.value = currentItem?.detail?.review || "";
  adminNodes.cover.value = "";
  adminNodes.gallery.value = "";

  for (const field of definition.fields) {
    const input = adminNodes.fields.querySelector(`[data-field-key="${field.key}"]`);
    if (!input) continue;
    input.value = currentItem ? getCardInfoValue(currentItem, field.label) : "";
  }
}

function renderAdminControls() {
  if (!state.collection) return;

  adminNodes.mode.value = state.adminMode;
  adminNodes.category.innerHTML = state.collection.categories
    .map(
      (category) =>
        `<option value="${escapeHtml(category.id)}">${escapeHtml(category.title)} / ${escapeHtml(category.englishTitle)}</option>`
    )
    .join("");

  const itemsInCategory = getItemsForCategory(state.adminCategoryId);
  adminNodes.item.innerHTML =
    itemsInCategory.length > 0
      ? itemsInCategory
          .map(
            (item) =>
              `<option value="${escapeHtml(item.id)}">${escapeHtml(item.timeValue || "--.--")} · ${escapeHtml(item.title)}</option>`
          )
          .join("")
      : `<option value="">当前分类还没有卡片</option>`;
  adminNodes.item.disabled = itemsInCategory.length === 0;
  adminNodes.item.value = state.adminItemId || "";

  const allItems = getAllItems();
  adminNodes.galleryItem.innerHTML =
    allItems.length > 0
      ? allItems
          .map(
            (item) =>
              `<option value="${escapeHtml(item.id)}">${escapeHtml(item.categoryTitle)} · ${escapeHtml(item.timeValue || "--.--")} · ${escapeHtml(item.title)}</option>`
          )
          .join("")
      : `<option value="">还没有可追加图片的卡片</option>`;
  adminNodes.galleryItem.disabled = allItems.length === 0;
  adminNodes.gallerySubmit.disabled = allItems.length === 0;
  adminNodes.galleryItem.value = state.galleryItemId || "";

  populateItemForm();
}

function setAdminPanelOpen(open) {
  state.adminPanelOpen = open;
  adminNodes.panel.hidden = !open;
  adminNodes.toggle.textContent = open ? "收起管理面板" : "打开管理面板";
  adminNodes.toggle.setAttribute("aria-expanded", String(open));
}

function openEditorForItem(item) {
  if (!item) return;
  state.adminMode = "edit";
  state.adminCategoryId = item.categoryId;
  state.adminItemId = item.id;
  state.galleryItemId = item.id;
  ensureAdminState(state.collection);
  renderAdminControls();
  setAdminPanelOpen(true);
  setStatus(adminNodes.status, "");
  setStatus(adminNodes.galleryStatus, "");
  if (detailModal.open) closeModal();
  window.scrollTo({ top: adminNodes.panel.offsetTop - 16, behavior: "smooth" });
}

function resetCreateForm() {
  state.adminMode = "create";
  state.adminItemId = "";
  renderAdminControls();
  setStatus(adminNodes.status, "表单已清空。", "success");
}

function collectItemPayload(mode) {
  const categoryId = adminNodes.category.value;
  const definition = getCategoryDefinition(categoryId);
  const payload = {
    categoryId,
    title: adminNodes.title.value.trim(),
    subtitle: adminNodes.subtitle.value.trim(),
    teaser: adminNodes.teaser.value.trim(),
    intro: adminNodes.intro.value.trim(),
    review: adminNodes.review.value.trim()
  };

  if (!payload.title) {
    throw new Error("标题不能为空。");
  }

  for (const field of definition.fields) {
    const input = adminNodes.fields.querySelector(`[data-field-key="${field.key}"]`);
    const value = input?.value.trim() || "";
    if (!value) {
      throw new Error(`${field.label} 不能为空。`);
    }
    if (field.key === "time") {
      validateTimeValue(value, field.label);
    }
    payload[field.key] = value;
  }

  if (mode === "create" && !adminNodes.cover.files[0]) {
    throw new Error("新增卡片时必须上传封面图。");
  }

  return payload;
}

function applyCollection(collection) {
  state.collection = collection;
  state.lastUpdatedAt = collection.updatedAt || "";
  ensurePageState(collection);
  ensureAdminState(collection);
  renderCatalogue();
  renderAdminControls();
  syncActiveItem();
}

async function fetchCollection() {
  return requestJson("/api/collection");
}

async function loadData() {
  const collection = await fetchCollection();

  for (const category of collection.categories) {
    if (state.pages[category.id] === undefined) {
      state.pages[category.id] = 0;
    }
  }

  applyCollection(collection);
}

async function refreshDataIfChanged() {
  try {
    const collection = await fetchCollection();
    const nextUpdatedAt = collection.updatedAt || "";

    if (!state.collection) {
      applyCollection(collection);
      return;
    }

    if (nextUpdatedAt !== state.lastUpdatedAt) {
      applyCollection(collection);
    }
  } catch (error) {
    console.error("自动刷新数据失败：", error);
  }
}

function startPolling() {
  if (state.pollTimer) return;
  state.pollTimer = window.setInterval(() => {
    if (document.hidden) return;
    refreshDataIfChanged();
  }, 3000);
}

async function handleItemSubmit(event) {
  event.preventDefault();
  setStatus(adminNodes.status, "");

  try {
    const mode = adminNodes.mode.value;
    const payload = collectItemPayload(mode);

    if (adminNodes.cover.files[0]) {
      payload.coverUpload = await fileToUpload(adminNodes.cover.files[0]);
    }

    if (mode === "create") {
      payload.galleryUploads = await filesToUploads(adminNodes.gallery.files);
      const result = await requestJson("/api/items", {
        method: "POST",
        body: payload
      });
      state.adminMode = "edit";
      state.adminCategoryId = result.item.categoryId;
      state.adminItemId = result.item.id;
      state.galleryItemId = result.item.id;
      await loadData();
      setStatus(adminNodes.status, "卡片新增成功，已经按时间自动排序。", "success");
      return;
    }

    if (!state.adminItemId) {
      throw new Error("请先选择要编辑的卡片。");
    }

    await requestJson(`/api/items/${encodeURIComponent(state.adminItemId)}`, {
      method: "PATCH",
      body: payload
    });
    state.galleryItemId = state.adminItemId;
    await loadData();
    setStatus(adminNodes.status, "卡片资料已更新。", "success");
  } catch (error) {
    setStatus(adminNodes.status, error.message, "error");
  }
}

async function handleGallerySubmit(event) {
  event.preventDefault();
  setStatus(adminNodes.galleryStatus, "");

  try {
    const itemId = adminNodes.galleryItem.value;
    const uploads = await filesToUploads(adminNodes.galleryFiles.files);

    if (!itemId) {
      throw new Error("请先选择要追加图片的卡片。");
    }
    if (uploads.length === 0) {
      throw new Error("请先选择至少一张图片。");
    }

    await requestJson(`/api/items/${encodeURIComponent(itemId)}/gallery`, {
      method: "POST",
      body: { galleryUploads: uploads }
    });

    state.galleryItemId = itemId;
    adminNodes.galleryFiles.value = "";
    await loadData();
    setStatus(adminNodes.galleryStatus, "详情图片已追加。", "success");
  } catch (error) {
    setStatus(adminNodes.galleryStatus, error.message, "error");
  }
}

async function handleDelete() {
  if (!state.adminItemId) {
    setStatus(adminNodes.status, "请先选择要删除的卡片。", "error");
    return;
  }

  const item = getItemById(state.adminItemId);
  const confirmed = window.confirm(`确认删除「${item?.title || state.adminItemId}」吗？会一并删除已上传的封面和详情图。`);
  if (!confirmed) return;

  try {
    const deletingId = state.adminItemId;
    await requestJson(`/api/items/${encodeURIComponent(deletingId)}`, {
      method: "DELETE",
      body: { removeAssets: true }
    });
    state.adminMode = "create";
    state.adminItemId = "";
    state.galleryItemId = "";
    await loadData();
    setStatus(adminNodes.status, "卡片已删除。", "success");
  } catch (error) {
    setStatus(adminNodes.status, error.message, "error");
  }
}

appRoot.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;

  const action = trigger.dataset.action;
  if (action === "prev-page") {
    updatePage(trigger.dataset.category, -1);
  }
  if (action === "next-page") {
    updatePage(trigger.dataset.category, 1);
  }
  if (action === "open-item") {
    openItem(trigger.dataset.category, trigger.dataset.id);
  }
});

adminNodes.toggle.addEventListener("click", () => {
  setAdminPanelOpen(!state.adminPanelOpen);
});

adminNodes.mode.addEventListener("change", () => {
  state.adminMode = adminNodes.mode.value;
  ensureAdminState(state.collection);
  renderAdminControls();
  setStatus(adminNodes.status, "");
});

adminNodes.category.addEventListener("change", () => {
  state.adminCategoryId = adminNodes.category.value;
  if (state.adminMode === "edit") {
    state.adminItemId = getItemsForCategory(state.adminCategoryId)[0]?.id || "";
  }
  renderAdminControls();
  setStatus(adminNodes.status, "");
});

adminNodes.item.addEventListener("change", () => {
  state.adminItemId = adminNodes.item.value;
  state.galleryItemId = adminNodes.item.value || state.galleryItemId;
  renderAdminControls();
  setStatus(adminNodes.status, "");
});

adminNodes.galleryItem.addEventListener("change", () => {
  state.galleryItemId = adminNodes.galleryItem.value;
  setStatus(adminNodes.galleryStatus, "");
});

adminNodes.reset.addEventListener("click", () => {
  if (state.adminMode === "edit" && state.adminItemId) {
    renderAdminControls();
    setStatus(adminNodes.status, "已恢复为当前卡片的已保存内容。", "success");
    return;
  }
  resetCreateForm();
});

adminNodes.itemForm.addEventListener("submit", handleItemSubmit);
adminNodes.galleryForm.addEventListener("submit", handleGallerySubmit);
adminNodes.delete.addEventListener("click", handleDelete);

modalNodes.close.addEventListener("click", closeModal);
modalNodes.edit.addEventListener("click", () => openEditorForItem(state.activeItem));

detailModal.addEventListener("click", (event) => {
  const { left, top, width, height } = detailModal.getBoundingClientRect();
  const inside =
    event.clientX >= left &&
    event.clientX <= left + width &&
    event.clientY >= top &&
    event.clientY <= top + height;
  if (!inside) closeModal();
});

modalNodes.galleryPrev.addEventListener("click", () => {
  if (!state.activeItem) return;
  state.activeGalleryIndex = Math.max(0, state.activeGalleryIndex - 1);
  updateGallery();
});

modalNodes.galleryNext.addEventListener("click", () => {
  if (!state.activeItem) return;
  const gallery = getGalleryItems(state.activeItem);
  state.activeGalleryIndex = Math.min(gallery.length - 1, state.activeGalleryIndex + 1);
  updateGallery();
});

window.addEventListener("keydown", (event) => {
  if (!detailModal.open) return;
  if (event.key === "Escape") {
    closeModal();
  }
  if (event.key === "ArrowLeft") {
    modalNodes.galleryPrev.click();
  }
  if (event.key === "ArrowRight") {
    modalNodes.galleryNext.click();
  }
});

loadData().catch((error) => {
  appRoot.innerHTML = `
    <section class="category-section">
      <h2 class="section-title">加载失败</h2>
      <p>${escapeHtml(error.message)}</p>
    </section>
  `;
});

restoreAdminPassword();
adminNodes.password.addEventListener("input", () => {
  window.localStorage.setItem(passwordStorageKey, adminNodes.password.value);
});
startPolling();
