import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schemas/jsinfoSchema/*",
  out: "./drizzle",
} satisfies Config;
