// Keep the desktop reader on the machine running Grok Bot.
if (process.platform === "win32") process.env.GROK_DESKTOP_OBSERVER ??= "1";

const nextCli = require.resolve("next/dist/bin/next");
process.argv.splice(1, 1, nextCli, "dev");
process.argv.push("--hostname", "127.0.0.1");
require(nextCli);
