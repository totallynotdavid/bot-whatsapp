export interface BookData {
  readonly title: string;
  readonly author?: string;
  readonly thumbnail?: string;
  readonly link: string;
  readonly md5: string;
  readonly publisher?: string;
  readonly info?: string;
}

export interface BookInfo extends BookData {
  readonly mirror?: string;
  readonly description?: string;
  readonly format: string;
}
