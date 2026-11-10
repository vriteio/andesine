import { CLIError } from "../errors";
import { getUserConfigPath } from "../config/resolve";
import { chmod, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const stateDirectory = () => path.dirname(getUserConfigPath(process.env));
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";

/** Create private CLI storage. Windows uses a protected ACL inherited by new files. */
const ensurePrivateDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true, mode: 0o700 });

  const info = await lstat(directory);

  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new CLIError("CLI storage must be a real directory.");
  }

  if (process.platform !== "win32") {
    if (info.uid !== process.getuid?.()) {
      throw new CLIError("CLI storage must belong to the current user.");
    }

    await chmod(directory, 0o700);
    return;
  }

  try {
    await promisify(execFile)(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `
      $ErrorActionPreference = 'Stop'
      $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
      $acl = New-Object System.Security.AccessControl.DirectorySecurity
      $acl.SetOwner($sid)
      $acl.SetAccessRuleProtection($true, $false)
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
      $acl.AddAccessRule($rule)
      Set-Acl -LiteralPath $env:ANDESINE_STORAGE_PATH -AclObject $acl
    `
      ],
      {
        env: { ...process.env, ANDESINE_STORAGE_PATH: directory },
        timeout: 10_000,
        windowsHide: true
      }
    );
  } catch {
    throw new CLIError("Cannot restrict CLI storage to the current Windows account.");
  }
};

/** Write and sync a private temporary file before replacing the destination. */
const writePrivateJSON = async (file: string, value: unknown): Promise<void> => {
  const temporary = `${file}.${randomUUID()}.tmp`;

  await ensurePrivateDirectory(path.dirname(file));

  const handle = await open(temporary, "wx", 0o600);

  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    await rename(temporary, file);

    if (process.platform !== "win32") {
      const directory = await open(path.dirname(file), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    }
  } finally {
    await handle.close();
    await unlink(temporary).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
  }
};

export { stateDirectory, isMissing, ensurePrivateDirectory, writePrivateJSON };
