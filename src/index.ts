import { run } from "./run";
import { formatFailureBlock } from "./utils/errors";

run().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(formatFailureBlock(error));
  // Hard exit: soft exitCode alone leaves the process alive while workerpool
  // threads (often blocked in execSync) still hold the event loop open.
  process.exit(1);
});
