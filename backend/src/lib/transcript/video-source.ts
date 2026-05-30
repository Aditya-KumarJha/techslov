import { URL } from 'node:url';

import type { VideoPlatform } from './transcript.types.js';

export function detectVideoPlatform(rawUrl: string): VideoPlatform {
  try {
    const parsedUrl = new URL(rawUrl);
    const host = parsedUrl.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return 'youtube';
    }

    if (host.includes('instagram.com')) {
      return 'instagram';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function deriveSourceId(rawUrl: string) {
  try {
    const parsedUrl = new URL(rawUrl);
    return parsedUrl.pathname.split('/').filter(Boolean).at(-1) ?? rawUrl;
  } catch {
    return rawUrl;
  }
}
