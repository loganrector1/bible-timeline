// Runs Vitest from a path with an upper-case drive letter. On Windows a shell can start
// in "c:\..." (VS Code terminals often do); Vitest then loads itself under both "c:" and
// "C:", and every suite fails at its first `describe` with "reading 'config'".
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const bin = join(cwd, "node_modules", "vitest", "vitest.mjs");
const { status } = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(status ?? 1);
