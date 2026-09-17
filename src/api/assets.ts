import { existsSync, mkdirSync } from "fs";
import { cfg } from "../config";
import { randomBytes } from "crypto";
import path from "node:path"

import type { ApiConfig } from "../config";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}


export function getMediaSubtype(file:File):string{
  return file.type.split("/")[1];
}

//Includes the '.' before the extension
export function getFileExtension(file:File):string{
  const extension = getMediaSubtype(file);
  return "." + extension;
}

export function generateAssetsPathURL(file:File){
    const randomBuffer = randomBytes(32).toString("base64url");
    const extension = getFileExtension(file);

    const URL = `${path.join(cfg.assetsRoot,randomBuffer)}${extension}`;

    return URL;
}