import { spawn } from 'node:child_process';

import type { TranscriptSegment, VideoSourceMetadata } from './transcript.types.js';
import { detectVideoPlatform, deriveSourceId } from './video-source.js';

function execFile(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const childProcess = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    childProcess.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    childProcess.on('error', reject);
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr || `Command failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

function pickCaptionUrl(payload: any) {
  const tracks = [
    ...(payload?.requested_subtitles ? Object.values(payload.requested_subtitles) : []),
    ...(payload?.subtitles ? Object.values(payload.subtitles).flat() : []),
    ...(payload?.automatic_captions ? Object.values(payload.automatic_captions).flat() : [])
  ] as Array<{ url?: string }>;

  return tracks.find((track) => track?.url)?.url;
}

function extractHashtagsFromText(text: string) {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(matches.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean))];
}

function uniqueTags(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

async function parseCaptionTracks(captionUrl: string): Promise<TranscriptSegment[]> {
  const response = await fetch(captionUrl);
  const body = await response.text();

  const segments: TranscriptSegment[] = [];
  const cueRegex = /<text start="([^"]+)" dur="([^"]+)">([^<]*)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = cueRegex.exec(body)) !== null) {
    const startTimeSeconds = Number.parseFloat(match[1] ?? '0');
    const durationSeconds = Number.parseFloat(match[2] ?? '0');
    const text = match[3]?.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') ?? '';

    segments.push({
      text,
      startTimeSeconds,
      endTimeSeconds: startTimeSeconds + durationSeconds
    });
  }

  return segments;
}

export class YtDlpTranscriptFetcher {
  async fetchMetadata(sourceUrl: string): Promise<VideoSourceMetadata> {
    const output = await execFile('yt-dlp', ['--dump-single-json', '--skip-download', sourceUrl]);
    const payload = JSON.parse(output.stdout);

    const platform = detectVideoPlatform(sourceUrl);
    const sourceId = deriveSourceId(sourceUrl);
    const description = String(payload?.description ?? '');
    const descriptionHashtags = extractHashtagsFromText(description);
    const captionHashtags = uniqueTags(Array.isArray(payload?.tags) ? payload.tags : []);
    const hashtags = uniqueTags([...captionHashtags, ...descriptionHashtags]).slice(0, 20);

    return {
      platform,
      url: sourceUrl,
      videoId: sourceId,
      title: String(payload?.title ?? sourceId),
      description,
      creator: String(payload?.uploader ?? payload?.channel ?? 'Unknown creator'),
      followerCount: Number(payload?.channel_follower_count ?? 0),
      views: Number(payload?.view_count ?? 0),
      likes: Number(payload?.like_count ?? 0),
      comments: Number(payload?.comment_count ?? 0),
      hashtags,
      uploadDate: String(payload?.upload_date ?? ''),
      durationSeconds: Number(payload?.duration ?? 0)
    };
  }

  async fetchTranscript(sourceUrl: string): Promise<TranscriptSegment[]> {
    const metadata = JSON.parse((await execFile('yt-dlp', ['--dump-single-json', '--skip-download', sourceUrl])).stdout);
    const captionUrl = pickCaptionUrl(metadata);

    if (!captionUrl) {
      return [];
    }

    return parseCaptionTracks(captionUrl);
  }
}
