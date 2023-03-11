import { fileURLToPath } from "url";
import { join } from "path";
import shellac from "shellac";
import dotenv from "dotenv";

const DIRNAME = fileURLToPath(new URL("../", import.meta.url));

dotenv.config({ path: join(DIRNAME, ".env") });

await shellac.in(join(DIRNAME, "worker"))`
  $ export CLOUDFLARE_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN}

  $$ npx wrangler publish
`;
