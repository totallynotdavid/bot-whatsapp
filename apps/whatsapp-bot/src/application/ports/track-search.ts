export interface TrackInfo {
  readonly name: string;
  readonly artists: string[];
  readonly albumName: string;
  readonly previewUrl: string;
}

export interface TrackSearch {
  isConfigured(): boolean;
  // Null means no matching track has a preview; every failure to find out
  // throws.
  searchTrack(query: string, signal?: AbortSignal): Promise<TrackInfo | null>;
}
