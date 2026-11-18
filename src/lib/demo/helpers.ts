// Small helpers for the browser-only demo backend.

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const nowIso = () => new Date().toISOString();

// Fake network latency, so loaders behave like with a real backend
export const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// Passwords are never stored in plain text, not even in the demo.
// crypto.subtle only exists on https:// and localhost, so there is a fallback.
export async function hashPassword(password: string) {
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (const char of password) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `fallback-${hash}`;
}

const AVATAR_COLORS = ["#877EFF", "#FF5A5A", "#FFB620", "#2A9D8F", "#E07A5F", "#3A86FF"];

// Same idea as Appwrite's avatars.getInitials(): a coloured circle with initials
export function initialsAvatar(name: string) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const colorIndex =
    [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${AVATAR_COLORS[colorIndex]}"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${initials}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Photos are scaled down to max. 1080px and saved as JPEG before they are
// stored (localStorage holds only about 5 MB) or uploaded (smaller requests).
// keepSvg: false also turns SVGs into JPEGs (the server does not accept SVG).
export async function fileToDataUrl(file: File, { maxSize = 1080, keepSvg = true } = {}) {
  if (keepSvg && file.type === "image/svg+xml") return readAsDataUrl(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    // SVGs without width/height report 0
    const width = image.width || maxSize;
    const height = image.height || maxSize;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not supported.");

    // JPEG has no transparency: white instead of black behind transparent PNGs
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
