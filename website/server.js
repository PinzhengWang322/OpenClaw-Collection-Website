const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");
const {
  loadCollection,
  normalizeCollection,
  syncCollection,
  addItem,
  updateItem,
  addGalleryImages,
  deleteItem
} = require("./scripts/collection-store");

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT ? Number(process.env.PORT) : 4173;
const adminPassword = process.env.ADMIN_PASSWORD || "demo-password";
const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(rootDir, "data");
const collectionPath = path.join(dataDir, "collection.json");
const databasePath = path.join(dataDir, "my-collection.db");

function ensureDatabaseSnapshot() {
  if (fs.existsSync(databasePath)) return;
  syncCollection(loadCollection());
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function isWriteApiRequest(url, method) {
  if (!url.pathname.startsWith("/api/")) return false;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (url.pathname === "/api/items" && method === "POST") return true;
  if (/^\/api\/items\/[^/]+$/.test(url.pathname) && (method === "PATCH" || method === "DELETE")) return true;
  if (/^\/api\/items\/[^/]+\/gallery$/.test(url.pathname) && method === "POST") return true;
  return false;
}

function authorizeWriteRequest(req, res, url) {
  if (!isWriteApiRequest(url, req.method)) return true;

  const suppliedPassword = String(req.headers["x-admin-password"] || "").trim();
  if (suppliedPassword && suppliedPassword === adminPassword) {
    return true;
  }

  sendJson(res, 401, {
    error: "管理密码不正确。"
  });
  return false;
}

function getErrorStatus(error) {
  const message = String(error?.message || "");
  if (message.includes("找不到卡片")) return 404;
  if (message.includes("找不到分类")) return 404;
  if (message.includes("请求体过大")) return 413;
  return 400;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;

    req.on("data", (chunk) => {
      totalLength += chunk.length;
      if (totalLength > 40 * 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (totalLength === 0) {
        resolve({});
        return;
      }

      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new Error("请求体不是合法 JSON。"));
      }
    });

    req.on("error", reject);
  });
}

function openDatabase() {
  if (!fs.existsSync(databasePath)) {
    throw new Error("Database file not found. Run npm run collection:reset first.");
  }
  return new DatabaseSync(databasePath);
}

async function handleApi(req, res, url) {
  if (!authorizeWriteRequest(req, res, url)) {
    return true;
  }

  if (url.pathname === "/api/collection" && req.method === "GET") {
    try {
      sendJson(res, 200, normalizeCollection(loadCollection()));
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/items" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const item = addItem(payload);
      sendJson(res, 201, { ok: true, item });
    } catch (error) {
      sendJson(res, getErrorStatus(error), { error: error.message });
    }
    return true;
  }

  const galleryRouteMatch = url.pathname.match(/^\/api\/items\/([^/]+)\/gallery$/);
  if (galleryRouteMatch && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const item = addGalleryImages({
        id: decodeURIComponent(galleryRouteMatch[1]),
        galleryUploads: Array.isArray(payload.galleryUploads) ? payload.galleryUploads : []
      });
      sendJson(res, 200, { ok: true, item });
    } catch (error) {
      sendJson(res, getErrorStatus(error), { error: error.message });
    }
    return true;
  }

  const itemRouteMatch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
  if (itemRouteMatch && req.method === "PATCH") {
    try {
      const payload = await readJsonBody(req);
      const item = updateItem({
        id: decodeURIComponent(itemRouteMatch[1]),
        ...payload
      });
      sendJson(res, 200, { ok: true, item });
    } catch (error) {
      sendJson(res, getErrorStatus(error), { error: error.message });
    }
    return true;
  }

  if (itemRouteMatch && req.method === "DELETE") {
    try {
      const payload = await readJsonBody(req);
      const item = deleteItem({
        id: decodeURIComponent(itemRouteMatch[1]),
        removeAssets: payload.removeAssets !== false
      });
      sendJson(res, 200, { ok: true, item });
    } catch (error) {
      sendJson(res, getErrorStatus(error), { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/database/summary" && req.method === "GET") {
    let db;
    try {
      db = openDatabase();
      const rows = db
        .prepare(
          `
            SELECT
              c.id,
              c.title,
              c.summary,
              c.accent,
              COUNT(i.id) AS total
            FROM categories c
            LEFT JOIN items i ON i.category_id = c.id
            GROUP BY c.id, c.title, c.summary, c.accent
            ORDER BY c.sort_order ASC
          `
        )
        .all();

      sendJson(res, 200, {
        source: "sqlite",
        categories: rows.map((row) => ({
          ...row,
          total: Number(row.total)
        }))
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    } finally {
      if (db) db.close();
    }
    return true;
  }

  if (url.pathname === "/api/database/item" && req.method === "GET") {
    const categoryId = url.searchParams.get("category");
    const itemId = url.searchParams.get("id");

    if (!categoryId || !itemId) {
      sendJson(res, 400, { error: "Missing category or id" });
      return true;
    }

    let db;
    try {
      db = openDatabase();
      const row = db
        .prepare(
          `
            SELECT
              i.id,
              i.category_id AS categoryId,
              i.title,
              i.subtitle,
              i.teaser,
              i.cover_path AS coverPath,
              i.time_value AS timeValue,
              i.sort_key AS sortKey,
              i.card_info_json AS cardInfoJson,
              i.detail_json AS detailJson
            FROM items i
            WHERE i.category_id = ? AND i.id = ?
          `
        )
        .get(categoryId, itemId);

      if (!row) {
        sendJson(res, 404, { error: "Item not found" });
        return true;
      }

      sendJson(res, 200, {
        ...row,
        sortKey: Number(row.sortKey),
        cardInfo: JSON.parse(row.cardInfoJson),
        detail: JSON.parse(row.detailJson)
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    } finally {
      if (db) db.close();
    }
    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  return false;
}

function resolveStaticPath(urlPathname) {
  const cleanPath = urlPathname === "/" ? "/index.html" : urlPathname;
  const normalized = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  return path.join(publicDir, normalized);
}

async function serveStatic(res, filePath) {
  try {
    const fileBuffer = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(fileBuffer);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
}

ensureDatabaseSnapshot();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, url);
    if (handled) return;
  }

  const filePath = resolveStaticPath(url.pathname);
  const isInsidePublicDir = filePath.startsWith(publicDir);

  if (!isInsidePublicDir) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  await serveStatic(res, filePath);
});

server.listen(port, host, () => {
  console.log(`openclaw-collection-showcase is running at http://${host}:${port}`);
});
