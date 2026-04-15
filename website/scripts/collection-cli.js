const {
  parseFileList,
  resetCollection,
  syncCollection,
  loadCollection,
  getCategory,
  listItems,
  addItem,
  updateItem,
  addGalleryImages,
  deleteItem
} = require("./collection-store");

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      result._.push(current);
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }
  return result;
}

function printHelp() {
  console.log(`
my-collection CLI

命令:
  reset
  sync
  sort
  list [--category movies|games|places]
  add --category <id> --title <标题> [category flags...]
  update --id <卡片ID> [fields...]
  gallery:add --id <卡片ID> --files "/path/a.png,/path/b.png"
  delete --id <卡片ID> [--remove-assets]

分类字段:
  movies: --type --time --origin --theme
  games:  --type --time --origin --theme
  places: --event --city --time --impression

通用字段:
  --subtitle
  --teaser
  --intro
  --review
  --cover-file "/abs/or/rel/path.png"
  --gallery-files "/a.png,/b.png"
  --clear-gallery
`.trim());
}

function buildCommonInput(args) {
  return {
    title: args.title,
    subtitle: args.subtitle,
    teaser: args.teaser,
    intro: args.intro,
    review: args.review,
    coverFilePath: args["cover-file"],
    galleryFiles: parseFileList(args["gallery-files"]),
    clearGallery: Boolean(args["clear-gallery"]),
    type: args.type,
    time: args.time,
    origin: args.origin,
    theme: args.theme,
    event: args.event,
    city: args.city,
    impression: args.impression
  };
}

function commandReset(args) {
  resetCollection({ keepAssets: Boolean(args["keep-assets"]) });
  console.log("Collection、SQLite、SQL seed 已重置为空。");
}

function commandSync() {
  syncCollection(loadCollection());
  console.log("已按时间倒序重排并同步 SQLite。");
}

function commandSort() {
  commandSync();
}

function commandList(args) {
  const groups = listItems(args.category);
  for (const group of groups) {
    console.log(`\n[${group.category.title}]`);
    if (group.lines.length === 0) {
      console.log("  (空)");
      continue;
    }
    group.lines.forEach((line) => console.log(`  ${line}`));
  }
}

function commandAdd(args) {
  const item = addItem({
    categoryId: args.category,
    ...buildCommonInput(args)
  });
  console.log(`已新增卡片: ${item.id}`);
}

function commandUpdate(args) {
  const item = updateItem({
    id: args.id,
    ...buildCommonInput(args)
  });
  const collection = loadCollection();
  const category = getCategory(collection, item.categoryId);
  console.log(`已更新卡片: ${item.id} (${category.title})`);
}

function commandGalleryAdd(args) {
  const item = addGalleryImages({
    id: args.id,
    galleryFiles: parseFileList(args.files)
  });
  console.log(`已追加详情图到 ${item.id}`);
}

function commandDelete(args) {
  const item = deleteItem({
    id: args.id,
    removeAssets: Boolean(args["remove-assets"])
  });
  console.log(`已删除卡片: ${item.id}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const [command] = args._;

  try {
    switch (command) {
      case "reset":
        commandReset(args);
        break;
      case "sync":
        commandSync();
        break;
      case "sort":
        commandSort();
        break;
      case "list":
        commandList(args);
        break;
      case "add":
        commandAdd(args);
        break;
      case "update":
        commandUpdate(args);
        break;
      case "gallery:add":
        commandGalleryAdd(args);
        break;
      case "delete":
        commandDelete(args);
        break;
      case "help":
      case "--help":
      case "-h":
      case undefined:
        printHelp();
        break;
      default:
        throw new Error(`未知命令: ${command}`);
    }
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
