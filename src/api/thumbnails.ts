import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const parsedData = await req.formData();
  const image = parsedData.get("thumbnail");

  if(image instanceof File){
    const MAX_UPLOAD_SPEED = 10 << 20;
    if(image.size > MAX_UPLOAD_SPEED){
      throw new BadRequestError("Image file size too large");
    }

    const mediaType = image.type;
    const arrBuffer = await image.arrayBuffer();

    const video = getVideo(cfg.db,videoId);

    if(!video){
      throw Error("Could not find video");
    }

    if(video && video.userID !== userID){
      throw new UserForbiddenError("User is not the owner of this video");
    }

    const thumbnail: Thumbnail = {
      data: arrBuffer,
      mediaType: mediaType
    }

    videoThumbnails.set(video.id,thumbnail);

    const thumbnailURL = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`;
    video.thumbnailURL = thumbnailURL;

    updateVideo(cfg.db,video);

    return respondWithJSON(200, video);
  }else{
    throw new BadRequestError("Invalid File Type");
  }

}
