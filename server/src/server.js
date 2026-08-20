import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`Manzaneque Helpdesk API listening on port ${env.port}`); // eslint-disable-line no-console
});
