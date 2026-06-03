const fs = require("fs");
const path = require("path");

function getJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return getJsFiles(fullPath);
    return entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

module.exports = {
  getJsFiles
};
