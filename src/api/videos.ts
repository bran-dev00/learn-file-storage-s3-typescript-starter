import { respondWithJSON } from "./json";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import {rm} from "fs/promises"

import { type ApiConfig } from "../config";
import {type BunRequest } from "bun";
import path from "node:path";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const UPLOAD_LIMIT = 1 << 30;

  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }
  
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db,videoId);
  if(!video){
    throw Error("Could not find video");
  }
  if(video && video.userID !== userID){
    throw new UserForbiddenError("User is not the owner of this video");
  }

  const parsedData = await req.formData();
  const videoFile = parsedData.get("video");
  
  if (!(videoFile instanceof File)) {
    throw new BadRequestError("Video file missing");
  } 
  if(videoFile.size > UPLOAD_LIMIT){
    throw new BadRequestError("Video file size is too large! Maximum Upload Size:1GB")
  } 
  if(videoFile.type !== "video/mp4"){
    throw new BadRequestError("Invalid file type, only MP4 is allowed");
  }

  //Save the uploaded file to a temp file on disk
  // console.log(`VideoID: ${videoId}`);
  const tempFilePath = path.join("/tmp",`${videoId}.mp4`)
  await Bun.write(tempFilePath,videoFile);

  let key = `${videoId}.mp4`
  const s3file = cfg.s3Client.file(key,{bucket: cfg.s3Bucket});
  await s3file.write(videoFile, {type:videoFile.type});

  const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
  video.videoURL = videoURL;

  updateVideo(cfg.db,video);

  //Delete temp file
  await Promise.all([rm(tempFilePath, {force:true})])

  return respondWithJSON(200, video)
}
