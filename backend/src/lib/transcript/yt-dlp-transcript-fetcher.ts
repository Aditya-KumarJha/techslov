import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { join, parse, resolve } from 'node:path';

import { env } from '../../config/env.js';
import type { TranscriptSegment, VideoSourceMetadata } from './transcript.types.js';
import { detectVideoPlatform, deriveSourceId } from './video-source.js';

function getCommandPath(command: string) {
  if (command === 'yt-dlp') {
    const localPath = resolve(process.cwd(), 'bin/yt-dlp');
    if (existsSync(localPath)) {
      return localPath;
    }
  }
  return command;
}

function execFile(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    const resolvedCommand = getCommandPath(command);
    const childProcess = spawn(resolvedCommand, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
        resolvePromise({ stdout, stderr });
        return;
      }

      reject(new Error(stderr || `Command failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

type CaptionTrack = {
  lang: string;
  url: string;
  ext?: string;
};

function parseVttTime(value: string) {
  const cleaned = value.trim().replace(',', '.');
  const parts = cleaned.split(':').map(Number);

  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }

  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }

  return parts[0] ?? 0;
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseXmlCaptions(body: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const cueRegex = /<text start="([^"]+)" dur="([^"]+)">([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = cueRegex.exec(body)) !== null) {
    const startTimeSeconds = Number.parseFloat(match[1] ?? '0');
    const durationSeconds = Number.parseFloat(match[2] ?? '0');
    const text = decodeEntities(match[3] ?? '').replace(/<[^>]+>/g, '').trim();

    if (!text) {
      continue;
    }

    segments.push({
      text,
      startTimeSeconds,
      endTimeSeconds: startTimeSeconds + durationSeconds
    });
  }

  return segments;
}

function parseVttCaptions(body: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = body.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = (lines[index] ?? '').trim();

    if (!line.includes('-->')) {
      index += 1;
      continue;
    }

    const [rawStart, rawEnd] = line.split('-->').map((value) => value.trim().split(' ')[0] ?? '0');
    const startTimeSeconds = parseVttTime(rawStart ?? '0');
    const endTimeSeconds = parseVttTime(rawEnd ?? '0');
    index += 1;

    const textLines: string[] = [];
    while (index < lines.length && (lines[index] ?? '').trim() !== '') {
      const cueLine = (lines[index] ?? '').replace(/<[^>]+>/g, '').trim();
      if (cueLine) {
        textLines.push(cueLine);
      }
      index += 1;
    }

    const text = decodeEntities(textLines.join(' ').trim());
    if (!text) {
      continue;
    }

    segments.push({ text, startTimeSeconds, endTimeSeconds });
  }

  return segments;
}

function parseJson3Captions(body: string): TranscriptSegment[] {
  const payload = JSON.parse(body);
  const events = Array.isArray(payload?.events) ? payload.events : [];

  return events
    .map((event: any) => {
      const segs = Array.isArray(event?.segs) ? event.segs : [];
      const text = segs.map((segment: any) => String(segment?.utf8 ?? '')).join('').replace(/\n/g, ' ').trim();
      const startTimeSeconds = Number(event?.tStartMs ?? 0) / 1000;
      const durationSeconds = Number(event?.dDurationMs ?? 0) / 1000;

      return {
        text,
        startTimeSeconds,
        endTimeSeconds: startTimeSeconds + durationSeconds
      } as TranscriptSegment;
    })
    .filter((segment: TranscriptSegment) => segment.text.length > 0);
}

function normalizeTracks(rawTracks: unknown, lang: string): CaptionTrack[] {
  if (!rawTracks) {
    return [];
  }

  if (Array.isArray(rawTracks)) {
    return rawTracks
      .filter((track): track is { url: string; ext?: string } => Boolean((track as any)?.url))
      .map((track) => ({ lang, url: track.url, ext: track.ext }));
  }

  if (typeof rawTracks === 'object' && (rawTracks as any).url) {
    const track = rawTracks as { url: string; ext?: string };
    return [{ lang, url: track.url, ext: track.ext }];
  }

  return [];
}

function pickCaptionTrack(payload: any): CaptionTrack | null {
  const bucketCandidates = [
    payload?.requested_subtitles,
    payload?.subtitles,
    payload?.automatic_captions
  ];

  const tracks = bucketCandidates.flatMap((bucket) => {
    if (!bucket || typeof bucket !== 'object') {
      return [] as CaptionTrack[];
    }

    return Object.entries(bucket).flatMap(([lang, values]) => normalizeTracks(values, lang));
  });

  if (!tracks.length) {
    return null;
  }

  const extPriority = ['json3', 'srv3', 'ttml', 'vtt'];
  const englishTracks = tracks.filter((track) => track.lang.toLowerCase().startsWith('en'));
  const rankedTracks = englishTracks.length ? englishTracks : tracks;

  rankedTracks.sort((a, b) => {
    const aRank = a.ext ? extPriority.indexOf(a.ext) : extPriority.length;
    const bRank = b.ext ? extPriority.indexOf(b.ext) : extPriority.length;
    return aRank - bRank;
  });

  return rankedTracks[0] ?? null;
}

function extractHashtagsFromText(text: string) {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(matches.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean))];
}

function uniqueTags(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

async function parseCaptionTracks(captionTrack: CaptionTrack): Promise<TranscriptSegment[]> {
  const response = await fetch(captionTrack.url);
  if (!response.ok) {
    return [];
  }

  const body = await response.text();

  try {
    if (captionTrack.ext === 'json3' || captionTrack.ext === 'srv3' || body.trim().startsWith('{')) {
      return parseJson3Captions(body);
    }
  } catch {
    // Fall through to alternate parsers.
  }

  if (body.includes('<text start=')) {
    return parseXmlCaptions(body);
  }

  if (body.includes('WEBVTT') || body.includes('-->')) {
    return parseVttCaptions(body);
  }

  return [];
}

export class YtDlpTranscriptFetcher {
  private async fetchYtDlpPayload(sourceUrl: string) {
    const output = await execFile('yt-dlp', ['--dump-single-json', '--skip-download', '--no-playlist', sourceUrl]);
    return JSON.parse(output.stdout);
  }

  private async fetchTranscriptWithWhisper(sourceUrl: string): Promise<TranscriptSegment[]> {
    if (!env.LOCAL_WHISPER_FALLBACK) {
      return [];
    }

    const workingDirectory = await mkdtemp(join(tmpdir(), 'social-rag-whisper-'));

    try {
      await execFile('yt-dlp', [
        '--no-playlist',
        '-x',
        '--audio-format',
        'mp3',
        '-o',
        join(workingDirectory, 'audio.%(ext)s'),
        sourceUrl
      ]);

      const files = await readdir(workingDirectory);
      const audioFileName = files.find((name) => name.startsWith('audio.') && name.endsWith('.mp3'));
      if (!audioFileName) {
        return [];
      }

      const audioFilePath = join(workingDirectory, audioFileName);

      await execFile(env.WHISPER_COMMAND, [
        audioFilePath,
        '--model',
        env.WHISPER_MODEL,
        '--output_format',
        'json',
        '--output_dir',
        workingDirectory,
        ...(env.WHISPER_LANGUAGE ? ['--language', env.WHISPER_LANGUAGE] : [])
      ]);

      const transcriptJsonPath = join(workingDirectory, `${parse(audioFileName).name}.json`);
      const whisperResult = JSON.parse(await readFile(transcriptJsonPath, 'utf8'));
      const segments = Array.isArray(whisperResult?.segments) ? whisperResult.segments : [];

      return segments
        .map((segment: any) => ({
          text: String(segment?.text ?? '').replace(/\s+/g, ' ').trim(),
          startTimeSeconds: Number(segment?.start ?? 0),
          endTimeSeconds: Number(segment?.end ?? 0)
        }))
        .filter((segment: TranscriptSegment) => segment.text.length > 0);
    } catch {
      return [];
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }

  async fetchMetadata(sourceUrl: string): Promise<VideoSourceMetadata> {
    const payload = await this.fetchYtDlpPayload(sourceUrl);

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
    const metadata = await this.fetchYtDlpPayload(sourceUrl);
    const captionTrack = pickCaptionTrack(metadata);

    const captionSegments = captionTrack ? await parseCaptionTracks(captionTrack) : [];
    if (captionSegments.length) {
      return captionSegments;
    }

    return this.fetchTranscriptWithWhisper(sourceUrl);
  }
}
