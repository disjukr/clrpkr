import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const packageDir = process.cwd();
const tmpDir = path.resolve(packageDir, "tmp");
const upstreamDir = process.env.LCMS_UPSTREAM_DIR
  ? path.resolve(process.env.LCMS_UPSTREAM_DIR)
  : path.join(tmpDir, "Little-CMS");
const repoUrl = "https://github.com/mm2/Little-CMS.git";

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });

    child.on("error", reject);
  });
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

if (process.env.LCMS_UPSTREAM_DIR) {
  console.log(`Using override upstream directory: ${upstreamDir}`);
  process.exit(0);
}

await mkdir(tmpDir, { recursive: true });

if (!(await exists(path.join(upstreamDir, ".git")))) {
  await run("git", ["clone", "--depth", "1", repoUrl, upstreamDir], packageDir);
  console.log(`Cloned upstream into ${upstreamDir}`);
  process.exit(0);
}

await run("git", ["-C", upstreamDir, "fetch", "--depth", "1", "origin", "master"], packageDir);
await run("git", ["-C", upstreamDir, "checkout", "--force", "FETCH_HEAD"], packageDir);
console.log(`Updated upstream checkout in ${upstreamDir}`);
