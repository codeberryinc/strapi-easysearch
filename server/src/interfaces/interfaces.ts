export interface SearchPluginConfig {
  contentTypes: ContentTypeConfig[];
}

export interface ContentTypeConfig {
  uid: string;
  transliterate?: boolean;
  fuzzysortOptions: FuzzysortOptions;
  populateFields?: string[];
}

export interface FuzzysortOptions {
  characterLimit?: number;
  threshold?: number;
  limit?: number;
  keys: { name: string; weight?: number }[];
}
