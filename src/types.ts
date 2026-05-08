export interface AudioStem {
  id: string;
  name: string;
  color: string;
  volume: number;
  buffer: AudioBuffer | null;
  isActive: boolean;
  isMuted?: boolean;
  isSolo?: boolean;
}

export interface VideoInfo {
  title: string;
  author: string;
  thumbnail: string;
  duration: string;
}
