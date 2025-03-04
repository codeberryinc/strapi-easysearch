export interface ContentType {
  uid: string;
  modelName: string;
  attributes: Record<string, any>;
}

export interface SearchResponseArgs {
  query: string;
  locale?: string;
}

export interface SearchResponseReturnType {
  query: string;
  locale?: string;
  auth: any;
}
