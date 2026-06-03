const fs = require("fs");
const path = require("path");

const logsDir = path.join(process.cwd(), "logs");

function write(level, message, error) {
  const stamp = new Date().toISOString();
  const detail = error ? ` ${error.stack || error.message || error}` : "";
  const line = `[${stamp}] [${level}] ${message}${detail}`;

  console.log(line);

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  fs.appendFileSync(path.join(logsDir, "bot.log"), `${line}\n`);
}

module.exports = {
  info: (message) => write("INFO", message),
  warn: (message) => write("WARN", message),
  error: (message, error) => write("ERROR", message, error)
};
