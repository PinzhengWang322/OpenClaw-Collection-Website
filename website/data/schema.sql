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
