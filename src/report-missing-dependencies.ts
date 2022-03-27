import { error } from './feedback';
import { main } from './main';

(async (): Promise<void> => {
  try {
    await main();
  } catch (e) {
    error('Something went wrong!');
    error(e);
    process.exit(1);
  }
})();
