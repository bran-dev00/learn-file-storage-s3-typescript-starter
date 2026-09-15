import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "node:path"
import { bundlerModuleNameResolver } from "typescript";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};


export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const parsedData = await req.formData();
  const imageFile = parsedData.get("thumbnail");

  if(imageFile instanceof File){
    const MAX_UPLOAD_SPEED = 10 << 20;
    if(imageFile.size > MAX_UPLOAD_SPEED){
      throw new BadRequestError("Image file size too large");
    }

    const mediaType = imageFile.type;
    const mediaSubType = mediaType.split("/")[1];

    if(!mediaType.startsWith("image/png") || !mediaType.startsWith("image/jpeg")){
      throw new BadRequestError("Invalid file type");
    }

    // const arrBuffer = await image.arrayBuffer();

    const video = getVideo(cfg.db,videoId);

    if(!video){
      throw Error("Could not find video");
    }

    if(video && video.userID !== userID){
      throw new UserForbiddenError("User is not the owner of this video");
    }

    const imageURL = `${path.join(cfg.assetsRoot,videoId)}.${mediaSubType}`;
    const thumbnailPath = `http://localhost:${cfg.port}/assets/${videoId}.${mediaSubType}`;

    Bun.write(imageURL,imageFile);

    console.log(imageURL)
    console.log(thumbnailPath);

    video.thumbnailURL = thumbnailPath;
    updateVideo(cfg.db,video);

    return respondWithJSON(200, video);
  }else{
    throw new BadRequestError("Invalid File Type");
  }

}
