import { main } from './cli.js';
declare const __GYRO_VERSION__: string;
if (process.argv.length === 3 && process.argv[2] === '--version') console.log(`gyro ${__GYRO_VERSION__}`);
else process.exitCode = await main(process.argv.slice(2), { cwd: process.cwd(), out: s => console.log(s), err: s => console.error(s) });
