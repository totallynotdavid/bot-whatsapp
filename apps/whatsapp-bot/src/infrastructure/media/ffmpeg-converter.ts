import ffmpeg from "fluent-ffmpeg";
import type { MediaConverter } from "../../application/ports/media-converter";

export class FfmpegConverter implements MediaConverter {
  gifToMp4(inputPath: string, outputPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(["-movflags", "faststart"])
        .toFormat("mp4")
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .save(outputPath);
    });
  }
}
