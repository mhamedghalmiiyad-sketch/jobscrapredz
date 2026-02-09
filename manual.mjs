import { runOnce } from './run-once.mjs';

console.log("🚀 Starting manual run...");
runOnce().then(() => console.log("✅ Done!"));