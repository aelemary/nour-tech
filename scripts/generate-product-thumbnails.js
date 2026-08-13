const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const envPath = path.join(ROOT_DIR, ".env");
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const divider = line.indexOf("=");
      if (divider > 0) env[line.slice(0, divider).trim()] = line.slice(divider + 1).trim();
    });
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
const STORAGE_BUCKET = env.SUPABASE_STORAGE_BUCKET;
const refreshThumbnails = process.argv.includes("--refresh");

if (!SUPABASE_URL || !SUPABASE_KEY || !STORAGE_BUCKET) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_STORAGE_BUCKET are required.");
}

function thumbnailObjectPath(objectPath) {
  const extensionIndex = objectPath.lastIndexOf(".");
  const name = extensionIndex > objectPath.lastIndexOf("/") ? objectPath.slice(0, extensionIndex) : objectPath;
  return `thumbnails/${name}.webp`;
}

function storageObjectPath(imageUrl) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/`;
  return imageUrl.startsWith(prefix) ? imageUrl.slice(prefix.length) : null;
}

function toWebp(buffer) {
  return new Promise((resolve, reject) => {
    const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "nour-tech-thumbnail-"));
    const inputPath = path.join(temporaryDir, "source-image");
    const outputPath = path.join(temporaryDir, "thumbnail.webp");
    fs.writeFileSync(inputPath, buffer);
    const converter = spawn("cwebp", ["-quiet", "-q", "72", "-m", "6", "-mt", "-resize", "480", "0", inputPath, "-o", outputPath]);
    const errors = [];
    const finish = (error, data) => {
      fs.rmSync(temporaryDir, { recursive: true, force: true });
      if (error) reject(error);
      else resolve(data);
    };
    converter.stderr.on("data", (chunk) => errors.push(chunk));
    converter.on("error", (error) => finish(error));
    converter.on("close", (code) => {
      if (code !== 0) {
        finish(new Error(Buffer.concat(errors).toString("utf8") || `cwebp exited with ${code}`));
        return;
      }
      finish(null, fs.readFileSync(outputPath));
    });
  });
}

async function uploadThumbnail(objectPath, data) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(STORAGE_BUCKET)}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "image/webp",
        "cache-control": "max-age=31536000",
        "x-upsert": "true",
      },
      body: data,
    }
  );
  if (!response.ok) throw new Error(await response.text());
}

async function main() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,images&order=title.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!response.ok) throw new Error(await response.text());
  const products = await response.json();
  const sourceImages = new Map();
  products.forEach((product) => {
    const firstImage = Array.isArray(product.images) ? product.images[0] : product.images;
    const objectPath = firstImage ? storageObjectPath(firstImage) : null;
    if (objectPath) sourceImages.set(objectPath, firstImage);
  });

  let complete = 0;
  for (const [objectPath, imageUrl] of sourceImages) {
    const thumbnailPath = thumbnailObjectPath(objectPath);
    const existingThumbnail = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${thumbnailPath}`,
      { method: "HEAD" }
    );
    if (existingThumbnail.ok && !refreshThumbnails) {
      complete += 1;
      console.log(`${complete}/${sourceImages.size} thumbnails available`);
      continue;
    }
    const sourceResponse = await fetch(imageUrl);
    if (!sourceResponse.ok) throw new Error(`Could not download ${objectPath}`);
    const thumbnail = await toWebp(Buffer.from(await sourceResponse.arrayBuffer()));
    await uploadThumbnail(thumbnailPath, thumbnail);
    complete += 1;
    console.log(`${complete}/${sourceImages.size} thumbnails created`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
