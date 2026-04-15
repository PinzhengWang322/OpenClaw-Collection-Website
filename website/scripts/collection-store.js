const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const publicDir = path.join(rootDir, "public");
const thumbsDir = path.join(publicDir, "assets", "thumbs");
const galleryDir = path.join(publicDir, "assets", "gallery");
const collectionPath = path.join(dataDir, "collection.json");
const dbPath = path.join(dataDir, "my-collection.db");
const schemaPath = path.join(dataDir, "schema.sql");
const seedPath = path.join(dataDir, "seed.sql");

const categoryConfigs = [
  {
    id: "movies",
    title: "影视",
    englishTitle: "Media Shelf",
    summary: "动画、漫画、电影。",
    accent: "#a44a3f",
    sortOrder: 1,
    pageSize: 12,
    timeFieldLabel: "观看时间",
    fields: [
      { key: "type", label: "类型", required: true },
      { key: "time", label: "观看时间", required: true },
      { key: "origin", label: "产地", required: true },
      { key: "theme", label: "主题", required: true }
    ]
  },
  {
    id: "games",
    title: "游戏",
    englishTitle: "Game Archive",
    summary: "系统、探索、合作与反复开档。",
    accent: "#355f8a",
    sortOrder: 2,
    pageSize: 12,
    timeFieldLabel: "游玩时间",
    fields: [
      { key: "type", label: "类型", required: true },
      { key: "time", label: "游玩时间", required: true },
      { key: "origin", label: "产地", required: true },
      { key: "theme", label: "主题", required: true }
    ]
  },
  {
    id: "places",
    title: "旅游",
    englishTitle: "Travel Notes",
    summary: "公开版只保留一张云南旅行卡片。",
    accent: "#4f7b57",
    sortOrder: 3,
    pageSize: 12,
    timeFieldLabel: "时间",
    fields: [
      { key: "event", label: "事件", required: true },
      { key: "city", label: "城市", required: true },
      { key: "time", label: "时间", required: true },
      { key: "impression", label: "印象", required: true }
    ]
  }
];

const categoryMap = Object.fromEntries(categoryConfigs.map((config) => [config.id, config]));
const uploadMimeMap = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

function ensureDirectories() {
  [dataDir, thumbsDir, galleryDir].forEach((directory) => {
    fs.mkdirSync(directory, { recursive: true });
  });
}

function emptyDirectory(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  }
}

function createEmptyCollection() {
  return {
    title: "openclaw-collection-showcase",
    subtitle: "Collection Demo",
    updatedAt: new Date().toISOString(),
    categories: categoryConfigs.map((config) => ({
      id: config.id,
      title: config.title,
      englishTitle: config.englishTitle,
      summary: config.summary,
      accent: config.accent,
      pageSize: config.pageSize,
      sortOrder: config.sortOrder,
      timeFieldLabel: config.timeFieldLabel,
      fieldLabels: config.fields.map((field) => field.label),
      items: []
    }))
  };
}

function loadCollection() {
  ensureDirectories();
  if (!fs.existsSync(collectionPath)) {
    return createEmptyCollection();
  }
  return JSON.parse(fs.readFileSync(collectionPath, "utf8"));
}

function saveCollection(collection) {
  const payload = {
    ...collection,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(collectionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function parseTimeValue(value) {
  const input = String(value || "").trim();
  const match = /^(\d{2})\.(0[1-9]|1[0-2])$/.exec(input);
  if (!match) return -1;
  return Number(match[1]) * 100 + Number(match[2]);
}

function getTimeValue(item, category) {
  if (item.timeValue) return String(item.timeValue);
  const match = (item.cardInfo || []).find((entry) => entry.label === category.timeFieldLabel);
  return match?.value || "";
}

function normalizeItem(item, category) {
  const normalizedCardInfo = category.fields.map((field, index) => {
    const existingByLabel = (item.cardInfo || []).find((entry) => entry.label === field.label);
    const fallbackByIndex = item.cardInfo?.[index];
    return {
      label: field.label,
      value: String(existingByLabel?.value ?? fallbackByIndex?.value ?? "")
    };
  });

  const timeValue = getTimeValue({ ...item, cardInfo: normalizedCardInfo }, category);
  const gallery = Array.isArray(item?.detail?.gallery) ? item.detail.gallery : [];

  return {
    id: item.id,
    categoryId: category.id,
    order: Number(item.order || 0),
    timeValue,
    sortKey: parseTimeValue(timeValue),
    title: String(item.title || ""),
    subtitle: String(item.subtitle || ""),
    teaser: String(item.teaser || ""),
    cover: String(item.cover || ""),
    cardInfo: normalizedCardInfo,
    detail: {
      intro: String(item?.detail?.intro || ""),
      review: String(item?.detail?.review || ""),
      gallery: gallery.map((entry, index) => ({
        src: String(entry.src || ""),
        caption: String(entry.caption || `${item.title || "图片"} · 第 ${index + 1} 张图`),
        alt: String(entry.alt || `${item.title || "图片"} 详情图 ${index + 1}`)
      }))
    },
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeCollection(collection) {
  return {
    title: collection.title || "openclaw-collection-showcase",
    subtitle: collection.subtitle || "Collection Demo",
    updatedAt: collection.updatedAt || new Date().toISOString(),
    categories: categoryConfigs.map((config) => {
      const source = collection.categories?.find((entry) => entry.id === config.id) || {};
      const items = (source.items || [])
        .map((item) => normalizeItem(item, config))
        .sort((left, right) => {
          if (right.sortKey !== left.sortKey) return right.sortKey - left.sortKey;
          return String(right.updatedAt).localeCompare(String(left.updatedAt));
        })
        .map((item, index) => ({
          ...item,
          order: index + 1
        }));

      return {
        id: config.id,
        title: config.title,
        englishTitle: config.englishTitle,
        summary: config.summary,
        accent: config.accent,
        pageSize: config.pageSize,
        sortOrder: config.sortOrder,
        timeFieldLabel: config.timeFieldLabel,
        fieldLabels: config.fields.map((field) => field.label),
        items
      };
    })
  };
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function buildSchemaSql() {
  return `
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  english_title TEXT NOT NULL,
  summary TEXT NOT NULL,
  accent TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  field_labels_json TEXT NOT NULL,
  time_field_label TEXT NOT NULL
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  sort_key INTEGER NOT NULL,
  time_value TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  teaser TEXT NOT NULL,
  cover_path TEXT NOT NULL,
  card_info_json TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(category_id) REFERENCES categories(id)
);
`.trim();
}

function writeSqlFiles(collection) {
  const schemaSql = buildSchemaSql();
  const insertLines = [];

  for (const category of collection.categories) {
    insertLines.push(
      `INSERT INTO categories (id, title, english_title, summary, accent, sort_order, field_labels_json, time_field_label) VALUES ('${escapeSql(category.id)}', '${escapeSql(category.title)}', '${escapeSql(category.englishTitle)}', '${escapeSql(category.summary)}', '${escapeSql(category.accent)}', ${category.sortOrder}, '${escapeSql(JSON.stringify(category.fieldLabels))}', '${escapeSql(category.timeFieldLabel)}');`
    );

    for (const item of category.items) {
      insertLines.push(
        `INSERT INTO items (id, category_id, sort_order, sort_key, time_value, title, subtitle, teaser, cover_path, card_info_json, detail_json, created_at, updated_at) VALUES ('${escapeSql(item.id)}', '${escapeSql(category.id)}', ${item.order}, ${item.sortKey}, '${escapeSql(item.timeValue)}', '${escapeSql(item.title)}', '${escapeSql(item.subtitle)}', '${escapeSql(item.teaser)}', '${escapeSql(item.cover)}', '${escapeSql(JSON.stringify(item.cardInfo))}', '${escapeSql(JSON.stringify(item.detail))}', '${escapeSql(item.createdAt)}', '${escapeSql(item.updatedAt)}');`
      );
    }
  }

  fs.writeFileSync(schemaPath, `${schemaSql}\n`, "utf8");
  fs.writeFileSync(seedPath, `${insertLines.join("\n")}\n`, "utf8");
}

function writeDatabase(collection) {
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec(buildSchemaSql());

  const categoryStatement = db.prepare(`
    INSERT INTO categories
      (id, title, english_title, summary, accent, sort_order, field_labels_json, time_field_label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStatement = db.prepare(`
    INSERT INTO items
      (id, category_id, sort_order, sort_key, time_value, title, subtitle, teaser, cover_path, card_info_json, detail_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const category of collection.categories) {
    categoryStatement.run(
      category.id,
      category.title,
      category.englishTitle,
      category.summary,
      category.accent,
      category.sortOrder,
      JSON.stringify(category.fieldLabels),
      category.timeFieldLabel
    );

    for (const item of category.items) {
      itemStatement.run(
        item.id,
        category.id,
        item.order,
        item.sortKey,
        item.timeValue,
        item.title,
        item.subtitle,
        item.teaser,
        item.cover,
        JSON.stringify(item.cardInfo),
        JSON.stringify(item.detail),
        item.createdAt,
        item.updatedAt
      );
    }
  }

  db.close();
}

function syncCollection(collection) {
  const normalized = normalizeCollection(collection);
  writeSqlFiles(normalized);
  writeDatabase(normalized);
  return saveCollection(normalized);
}

function resolveSourcePath(inputPath) {
  const resolved = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`文件不存在: ${inputPath}`);
  }
  return resolved;
}

function resolveExtension(filename, mimeType) {
  const fromFilename = path.extname(filename || "").toLowerCase();
  if (fromFilename) return fromFilename;
  const fromMime = uploadMimeMap[mimeType || ""];
  if (fromMime) return fromMime;
  throw new Error("无法判断上传图片格式。");
}

function assertAllowedExtension(extension) {
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
  if (!allowed.has(extension)) {
    throw new Error(`暂不支持的图片格式: ${extension}`);
  }
}

function copyAssetFromFile(inputPath, targetDirectory, targetName) {
  const sourcePath = resolveSourcePath(inputPath);
  const extension = path.extname(sourcePath).toLowerCase();
  assertAllowedExtension(extension);

  const destination = path.join(targetDirectory, `${targetName}${extension}`);
  fs.copyFileSync(sourcePath, destination);
  const relativePath = path.relative(publicDir, destination).replaceAll(path.sep, "/");
  return `/${relativePath}`;
}

function copyAssetFromUpload(upload, targetDirectory, targetName) {
  const filename = upload?.filename || upload?.name || "";
  const dataUrl = upload?.dataUrl;
  if (!dataUrl) {
    throw new Error("上传图片缺少 dataUrl。");
  }

  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("上传图片不是合法的 data URL。");
  }

  const [, mimeType, base64Data] = match;
  const extension = resolveExtension(filename, mimeType);
  assertAllowedExtension(extension);

  const destination = path.join(targetDirectory, `${targetName}${extension}`);
  fs.writeFileSync(destination, Buffer.from(base64Data, "base64"));
  const relativePath = path.relative(publicDir, destination).replaceAll(path.sep, "/");
  return `/${relativePath}`;
}

function buildGalleryEntriesFromFiles(files, itemTitle, itemId, startIndex) {
  return files.map((file, index) => {
    const imageIndex = startIndex + index;
    const src = copyAssetFromFile(file, galleryDir, `${itemId}-${imageIndex}`);
    return {
      src,
      caption: `${itemTitle} · 第 ${imageIndex} 张图`,
      alt: `${itemTitle} 详情图 ${imageIndex}`
    };
  });
}

function buildGalleryEntriesFromUploads(uploads, itemTitle, itemId, startIndex) {
  return uploads.map((upload, index) => {
    const imageIndex = startIndex + index;
    const src = copyAssetFromUpload(upload, galleryDir, `${itemId}-${imageIndex}`);
    return {
      src,
      caption: `${itemTitle} · 第 ${imageIndex} 张图`,
      alt: `${itemTitle} 详情图 ${imageIndex}`
    };
  });
}

function buildGalleryEntries(sources, itemTitle, itemId, startIndex) {
  const fileEntries = buildGalleryEntriesFromFiles(sources.files || [], itemTitle, itemId, startIndex);
  const uploadEntries = buildGalleryEntriesFromUploads(
    sources.uploads || [],
    itemTitle,
    itemId,
    startIndex + fileEntries.length
  );
  return fileEntries.concat(uploadEntries);
}

function parseFileList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getCategoryConfig(categoryId) {
  const config = categoryMap[categoryId];
  if (!config) {
    throw new Error(`未知分类: ${categoryId}`);
  }
  return config;
}

function getCategory(collection, categoryId) {
  const category = collection.categories.find((entry) => entry.id === categoryId);
  if (!category) {
    throw new Error(`找不到分类: ${categoryId}`);
  }
  return category;
}

function findItem(collection, itemId) {
  for (const category of collection.categories) {
    const index = category.items.findIndex((item) => item.id === itemId);
    if (index >= 0) {
      return {
        category,
        item: category.items[index],
        index,
        config: getCategoryConfig(category.id)
      };
    }
  }
  throw new Error(`找不到卡片: ${itemId}`);
}

function buildCardInfo(config, input, existingCardInfo = []) {
  const explicitFieldValues = Array.isArray(input.fieldValues) ? input.fieldValues : null;
  return config.fields.map((field, index) => {
    const existingByLabel = existingCardInfo.find((entry) => entry.label === field.label);
    const fallbackByIndex = existingCardInfo[index];
    const value = explicitFieldValues
      ? explicitFieldValues[index]
      : input[field.key] ?? existingByLabel?.value ?? fallbackByIndex?.value ?? "";
    if (field.required && !String(value ?? "").trim()) {
      throw new Error(`缺少字段 ${field.label}`);
    }
    if (field.label === config.timeFieldLabel && parseTimeValue(value) < 0) {
      throw new Error(`${field.label} 必须使用 YY.MM 格式，例如 25.03`);
    }
    return {
      label: field.label,
      value: String(value ?? "").trim()
    };
  });
}

function inferTeaser(input, intro, title) {
  if (input.teaser) return String(input.teaser).trim();
  const source = String(intro || title || "").trim();
  if (!source) return "";
  return source.length > 48 ? `${source.slice(0, 48)}...` : source;
}

function generateItemId(categoryId, timeValue) {
  const timePart = String(timeValue || "0000").replace(".", "");
  return `${categoryId}-${timePart}-${randomBytes(2).toString("hex")}`;
}

function removeAssetByPublicPath(publicPath) {
  if (!publicPath) return;
  const normalized = publicPath.replace(/^\//, "");
  const absolute = path.join(publicDir, normalized);
  if (!absolute.startsWith(path.join(publicDir, "assets"))) return;
  if (fs.existsSync(absolute)) {
    fs.rmSync(absolute, { force: true });
  }
}

function resolveCover(input, itemId, existingCover = "") {
  if (input.coverFilePath) {
    return copyAssetFromFile(input.coverFilePath, thumbsDir, itemId);
  }
  if (input.coverUpload) {
    return copyAssetFromUpload(input.coverUpload, thumbsDir, itemId);
  }
  if (input.clearCover) {
    return "";
  }
  return existingCover;
}

function resetCollection(options = {}) {
  ensureDirectories();
  const collection = createEmptyCollection();
  if (!options.keepAssets) {
    emptyDirectory(thumbsDir);
    emptyDirectory(galleryDir);
  }
  return syncCollection(collection);
}

function formatListLine(item, category) {
  return `${item.id} | ${category.title} | ${item.timeValue || "--.--"} | ${item.title}`;
}

function addItem(input) {
  const categoryId = input.categoryId;
  if (!categoryId) {
    throw new Error("新增卡片必须提供 categoryId。");
  }

  const title = String(input.title || "").trim();
  if (!title) {
    throw new Error("新增卡片必须提供标题。");
  }

  const collection = loadCollection();
  const config = getCategoryConfig(categoryId);
  const category = getCategory(collection, categoryId);
  const cardInfo = buildCardInfo(config, input);
  const timeValue = cardInfo.find((entry) => entry.label === config.timeFieldLabel)?.value || "";
  const itemId = input.id || generateItemId(categoryId, timeValue);
  const cover = resolveCover(input, itemId);

  if (!cover) {
    throw new Error("新增卡片必须提供封面图。");
  }

  const intro = String(input.intro || "").trim();
  const review = String(input.review || "").trim();
  const gallery = buildGalleryEntries(
    {
      files: input.galleryFiles || [],
      uploads: input.galleryUploads || []
    },
    title,
    itemId,
    1
  );

  const item = {
    id: itemId,
    categoryId,
    order: 0,
    timeValue,
    sortKey: parseTimeValue(timeValue),
    title,
    subtitle: String(input.subtitle || "").trim(),
    teaser: inferTeaser(input, intro, title),
    cover,
    cardInfo,
    detail: {
      intro,
      review,
      gallery
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  category.items.push(item);
  const saved = syncCollection(collection);
  const savedCategory = getCategory(saved, categoryId);
  return savedCategory.items.find((entry) => entry.id === itemId);
}

function updateItem(input) {
  if (!input.id) {
    throw new Error("更新卡片必须提供 id。");
  }

  const collection = loadCollection();
  const { category, item, config } = findItem(collection, input.id);
  const cardInfo = buildCardInfo(config, input, item.cardInfo || []);
  const timeValue = cardInfo.find((entry) => entry.label === config.timeFieldLabel)?.value || item.timeValue || "";
  const title = input.title !== undefined ? String(input.title).trim() : item.title;
  const intro = input.intro !== undefined ? String(input.intro).trim() : item.detail?.intro || "";
  const review = input.review !== undefined ? String(input.review).trim() : item.detail?.review || "";

  item.title = title;
  item.subtitle = input.subtitle !== undefined ? String(input.subtitle).trim() : item.subtitle;
  item.cardInfo = cardInfo;
  item.timeValue = timeValue;
  item.sortKey = parseTimeValue(timeValue);
  item.cover = resolveCover(input, item.id, item.cover);
  item.detail = item.detail || {};
  item.detail.intro = intro;
  item.detail.review = review;
  item.teaser = input.teaser !== undefined ? String(input.teaser).trim() : item.teaser || inferTeaser({}, intro, title);
  item.updatedAt = new Date().toISOString();

  if (input.clearGallery) {
    item.detail.gallery = [];
  }

  if ((input.galleryFiles && input.galleryFiles.length > 0) || (input.galleryUploads && input.galleryUploads.length > 0)) {
    item.detail.gallery = buildGalleryEntries(
      {
        files: input.galleryFiles || [],
        uploads: input.galleryUploads || []
      },
      title,
      item.id,
      1
    );
  }

  const saved = syncCollection(collection);
  const savedCategory = getCategory(saved, category.id);
  return savedCategory.items.find((entry) => entry.id === item.id);
}

function addGalleryImages(input) {
  if (!input.id) {
    throw new Error("追加详情图必须提供 id。");
  }

  const collection = loadCollection();
  const { item } = findItem(collection, input.id);
  const currentGallery = Array.isArray(item.detail?.gallery) ? item.detail.gallery : [];
  const appended = buildGalleryEntries(
    {
      files: input.galleryFiles || [],
      uploads: input.galleryUploads || []
    },
    item.title,
    item.id,
    currentGallery.length + 1
  );

  item.detail.gallery = currentGallery.concat(appended);
  item.updatedAt = new Date().toISOString();
  const saved = syncCollection(collection);
  const { item: updatedItem } = findItem(saved, input.id);
  return updatedItem;
}

function deleteItem(input) {
  if (!input.id) {
    throw new Error("删除卡片必须提供 id。");
  }

  const collection = loadCollection();
  const { category, item, index } = findItem(collection, input.id);
  category.items.splice(index, 1);

  if (input.removeAssets) {
    removeAssetByPublicPath(item.cover);
    for (const image of item.detail?.gallery || []) {
      removeAssetByPublicPath(image.src);
    }
  }

  syncCollection(collection);
  return item;
}

function listItems(categoryId) {
  const collection = normalizeCollection(loadCollection());
  const categories = categoryId ? [getCategory(collection, categoryId)] : collection.categories;
  return categories.map((category) => ({
    category,
    lines: category.items.map((item) => formatListLine(item, category))
  }));
}

module.exports = {
  rootDir,
  dataDir,
  publicDir,
  thumbsDir,
  galleryDir,
  collectionPath,
  dbPath,
  schemaPath,
  seedPath,
  categoryConfigs,
  categoryMap,
  ensureDirectories,
  createEmptyCollection,
  loadCollection,
  saveCollection,
  parseTimeValue,
  normalizeCollection,
  syncCollection,
  resetCollection,
  parseFileList,
  getCategoryConfig,
  getCategory,
  findItem,
  addItem,
  updateItem,
  addGalleryImages,
  deleteItem,
  listItems,
  buildSchemaSql
};
