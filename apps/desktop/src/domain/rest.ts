export type HttpMethod =
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface RestHeader {
  name: string;
  value: string;
}

export interface RestRequest {
  method: HttpMethod;
  url: string;
  headers: RestHeader[];
  body: string | null;
  variables: RestVariable[];
}

export interface RestVariable {
  name: string;
  value: string;
}

export interface RestResponse {
  status: number;
  statusText: string;
  headers: RestHeader[];
  body: string;
  durationMs: number;
  sizeBytes: number;
  contentType: string | null;
}

export interface RestRequestSnapshot extends RestRequest {
  sentAt: string;
}
