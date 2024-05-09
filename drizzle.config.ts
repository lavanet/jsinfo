import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schemas/jsinfoSchema.ts",
  out: "./drizzle",
} satisfies Config;
