// Set at build time in vite.config.ts (see chooseBackend there):
// "api"      -> own backend in /api (Vercel Functions + Postgres)
// "appwrite" -> Appwrite Cloud, like in the original tutorial
// "demo"     -> everything in the browser (localStorage), no server needed
export const backend = __SNAPGRAM_BACKEND__;

export const isDemoMode = backend === "demo";

// The Appwrite setup from the tutorial has no "follows" collection
export const canFollow = backend !== "appwrite";
