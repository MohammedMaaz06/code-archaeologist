import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the Turbopack root to this folder so a stray package-lock.json in a parent
// directory (e.g. the user home folder) is not mistaken for the workspace root.
export default {
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};
