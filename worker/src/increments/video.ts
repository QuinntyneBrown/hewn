import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

export type Probe = (path: string) => Promise<VideoInfo>;

const MAX_SECONDS = 180;

/** L2-023 AC1: `docs/videos/{slug}/` holds the script, captions and a 1920x1080 MP4 of 3 minutes or less. */
export async function validateVideo(directory: string, slug: string, probe: Probe = ffprobe): Promise<string[]> {
  const folder = `docs/videos/${slug}`;
  const files = [`${folder}/${slug}.mp4`, `${folder}/script.md`, `${folder}/${slug}.vtt`];
  const missing = files.filter((f) => !existsSync(join(directory, f))).map((f) => `${f} does not exist`);
  if (missing.length) return missing;

  const info = await probe(join(directory, files[0]!));
  const problems: string[] = [];
  if (info.width !== 1920 || info.height !== 1080)
    problems.push(`The video is ${info.width}x${info.height}, not 1920x1080`);
  if (info.duration > MAX_SECONDS) {
    const s = Math.round(info.duration);
    problems.push(`The video runs ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}, over 3 minutes`);
  }
  return problems;
}

async function ffprobe(path: string): Promise<VideoInfo> {
  const { stdout } = await promisify(execFile)('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    path,
  ]).catch((error: NodeJS.ErrnoException) => {
    throw new Error(error.code === 'ENOENT' ? 'ffprobe is not installed' : `ffprobe could not read the video`);
  });
  const parsed = JSON.parse(stdout) as {
    streams?: { width?: number; height?: number }[];
    format?: { duration?: string };
  };
  return {
    width: parsed.streams?.[0]?.width ?? 0,
    height: parsed.streams?.[0]?.height ?? 0,
    duration: Number(parsed.format?.duration ?? 0),
  };
}
