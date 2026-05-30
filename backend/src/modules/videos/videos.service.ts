import { getAppContainer } from '../../lib/runtime/app-container.js';

export type VideoMetadata = {
  videoId: 'A' | 'B';
  sourceUrl: string;
  creator: string;
  followerCount: number;
  views: number;
  likes: number;
  comments: number;
  hashtags: string[];
  uploadDate: string;
  durationSeconds: number;
  engagementRate: number;
  transcriptPreview: string;
};

export async function getVideoMetadata(videoId: 'A' | 'B'): Promise<VideoMetadata | null> {
  const video = getAppContainer().videoRegistry.get(videoId);

  if (!video) {
    return null;
  }

  return {
    videoId: video.videoId,
    sourceUrl: video.sourceUrl,
    creator: video.creator,
    followerCount: video.followerCount,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    hashtags: video.hashtags,
    uploadDate: video.uploadDate,
    durationSeconds: video.durationSeconds,
    engagementRate: video.engagementRate,
    transcriptPreview: video.transcriptPreview
  };
}
