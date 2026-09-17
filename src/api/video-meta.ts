import { type ApiConfig } from "../config";
import { getBearerToken, validateJWT } from "../auth";
import { createVideo, deleteVideo, getVideo, getVideos } from "../db/videos";
import { respondWithJSON } from "./json";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import type { BunRequest } from "bun";
import { stderr, stdout } from "node:process";

export async function handlerVideoMetaCreate(cfg: ApiConfig, req: Request) {
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const { title, description } = await req.json();
  if (!title || !description) {
    throw new BadRequestError("Missing title or description");
  }

  const video = createVideo(cfg.db, {
    userID,
    title,
    description,
  });

  return respondWithJSON(201, video);
}

export async function handlerVideoMetaDelete(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }
  if (video.userID !== userID) {
    throw new UserForbiddenError("Not authorized to delete this video");
  }

  deleteVideo(cfg.db, videoId);
  return new Response(null, { status: 204 });
}

export async function handlerVideoGet(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  return respondWithJSON(200, video);
}

export async function handlerVideosRetrieve(cfg: ApiConfig, req: Request) {
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const videos = getVideos(cfg.db, userID);
  return respondWithJSON(200, videos);
}

const getOrientation = (width: number, height: number) => {
  const ratio = width / height;
  const target = 16 / 9;
  const tolerance = 0.01;

  if (Math.abs(ratio - target) <= tolerance) {
    return "landscape";
  }

  if (Math.abs(ratio - 1 / target) <= tolerance) {
    return "portrait";
  }

  return "other";
};

export async function getVideoAspectRatio(filePath:string): Promise<string>{

  const proc = Bun.spawn([
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    filePath,
  ],{
    stdout:"pipe",
    stderr:"pipe",
  } );

const stdoutText = await new Response(proc.stdout).text();
const stderrText = await new Response(proc.stderr).text();

if(await proc.exited !== 0){
  console.error(stderrText);
  throw new Error(stderrText);
}

const data = JSON.parse(stdoutText);


const width = data.streams[0]?.width;
const height = data.streams[0]?.height;

const orientation = getOrientation(width, height);
return orientation;

}