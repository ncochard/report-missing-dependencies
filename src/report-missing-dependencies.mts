import { error } from './feedback.mjs';
import { main } from './main.mjs';

(async (): Promise<void> => {
  try {
    await main();
  } catch (e) {
    error('Something went wrong!');
    error(e);
    process.exit(1);
  }
})();
