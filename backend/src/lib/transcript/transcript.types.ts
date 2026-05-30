export type VideoPlatform = 'youtube' | 'instagram' | 'unknown';

export type TranscriptSegment = {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
};

export type VideoSourceMetadata = {
  platform: VideoPlatform;
  url: string;
  videoId: string;
  title: string;
  creator: string;
  followerCount: number;
  views: number;
  likes: number;
  comments: number;
  hashtags: string[];
  uploadDate: string;
  durationSeconds: number;
};
