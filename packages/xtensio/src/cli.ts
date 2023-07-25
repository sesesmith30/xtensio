import createCommand from "./create";
import generateCommand from "./generate";
import buildCommand from "./build";
import { Commands, CreateValues, GenerateValues } from "../types";
import devCommand from "./dev";
import path from "path";
import { execute } from "./helper";

export async function xtensioCLI<T extends Commands>(
  binaryPath: string,
  _cwd: string,
  command: T,
  value: GenerateValues | CreateValues
) {
  const cwd = process.cwd();
  switch (command) {
    case "create":
      createCommand(cwd, value as CreateValues);
      return;
    case "generate":
      generateCommand(cwd, value as GenerateValues);
      return;
    case "build":
      await buildCommand(cwd);
      const buildPath = path.join(cwd, "./.xtensio/build");
      execute(`yarn web-ext build --source-dir ${buildPath} -o --artifacts-dir=zips`)
      return;
    case "dev": 
      await devCommand(cwd);
      const devPath = path.join(cwd, "./.xtensio/dev");
      execute(`yarn web-ext run --source-dir ${devPath} --target=chromium`)
      return; 
    default:
      throw Error(`Command ${command} was not found!`);
  }
}
