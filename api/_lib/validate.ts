import { HttpError } from "./http.js";

// Never trust the browser: every value is checked again on the server.

export function text(value: unknown, field: string, { min = 0, max = 2200 } = {}) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < min) throw new HttpError(400, `${field} is too short.`);
  if (result.length > max) throw new HttpError(400, `${field} is too long (max. ${max} characters).`);
  return result;
}

export function email(value: unknown) {
  const result = text(value, "Email", { min: 3, max: 200 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, "Please enter a valid email.");
  return result;
}

export function username(value: unknown) {
  const result = text(value, "Username", { min: 2, max: 30 });
  if (!/^[a-zA-Z0-9._]+$/.test(result)) {
    throw new HttpError(400, "Username may only contain letters, numbers, dots and underscores.");
  }
  return result;
}

export function tags(value: unknown) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return list
    .map((tag) => String(tag).replace(/[\s#]/g, "").slice(0, 30))
    .filter(Boolean)
    .slice(0, 10);
}

// ============================== IMAGES
// The browser scales photos down and sends them as a data URL. Only JPEG,
// PNG and WebP are accepted (no SVG: it can contain JavaScript), and the
// first bytes must really match the claimed type.

const MAX_IMAGE_BYTES = 1_500_000;

const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
};

export function image(value: unknown) {
  const match = typeof value === "string" ? /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(value) : null;
  if (!match) throw new HttpError(400, "The image must be a JPEG, PNG or WebP data URL.");

  const [, contentType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  const isValid = SIGNATURES[contentType];

  if (!isValid || !isValid(bytes)) throw new HttpError(400, "Only JPEG, PNG and WebP images are allowed.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "The image is too large (max. 1.5 MB).");

  return { contentType, base64: bytes.toString("base64") };
}
