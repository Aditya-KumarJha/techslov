export type VideoId = 'A' | 'B';

export type SocialVideoMetadata = {
  videoId: VideoId;
  sourceUrl: string;
  creator: string;
  followerCount: number;
  views: number;
  likes: number;
  comments: number;
  hashtags: string[];
  uploadDate: string;
  durationSeconds: number;
};

export type Citation = {
  videoId: VideoId;
  chunkId: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
};
