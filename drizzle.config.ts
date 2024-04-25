import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schemas/jsinfo_schema.ts",
  out: "./drizzle",
} satisfies Config;
