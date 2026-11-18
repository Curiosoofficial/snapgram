import { getDb, NoDatabaseError } from "./_lib/db.js";

// GET /api/images?id=… -> the uploaded image itself
// Images never change (a new photo gets a new id), so browsers and the
// Vercel CDN may cache them for a year.

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

    try {
      const id = new URL(request.url).searchParams.get("id");
      const db = await getDb();
      const [image] = id
        ? await db.query<{ content_type: string; data: string }>(
            `select content_type, data from images where id = $1`,
            [id]
          )
        : [];

      if (!image) return new Response("Not found", { status: 404 });

      return new Response(Buffer.from(image.data, "base64"), {
        headers: {
          "content-type": image.content_type,
          "cache-control": "public, max-age=31536000, immutable",
          // never run anything that might hide in an uploaded file
          "content-security-policy": "default-src 'none'; sandbox",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (error) {
      if (!(error instanceof NoDatabaseError)) console.error(error);
      return new Response("Server error", { status: 500 });
    }
  },
};
