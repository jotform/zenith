import { run } from "./run";
import { formatFailureBlock } from "./utils/errors";

run().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(formatFailureBlock(error));
  process.exitCode = 1;
});
