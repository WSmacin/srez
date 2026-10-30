import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const outFile = path.resolve(__dirname, "../deploy-payload.json");

const MIME = {
  html: "text/html; charset=utf-8",
  js: "application/javascript",
  css: "text/css",
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
  json: "application/json",
  txt: "text/plain",
  map: "application/json",
  woff: "font/woff",
  woff2: "font/woff2",
};

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Same as wrangler hashFile: blake3(base64(contents) + extension).hex.slice(0,32) */
function hashFile(filepath) {
  const contents = fs.readFileSync(filepath);
  const base64Contents = contents.toString("base64");
  const extension = path.extname(filepath).substring(1);
  return bytesToHex(blake3(utf8ToBytes(base64Contents + extension))).slice(0, 32);
}

const files = walk(distDir).map((full) => {
  const rel = path.relative(distDir, full).split(path.sep).join("/");
  const contents = fs.readFileSync(full);
  const ext = path.extname(full).substring(1).toLowerCase();
  return {
    path: rel,
    hash: hashFile(full),
    contentType: MIME[ext] || "application/octet-stream",
    size: contents.length,
    base64: contents.toString("base64"),
  };
});

const manifest = Object.fromEntries(files.map((f) => [`/${f.path}`, f.hash]));
fs.writeFileSync(outFile, JSON.stringify({ files, manifest }, null, 2));
console.log(`Prepared ${files.length} files -> ${outFile}`);
