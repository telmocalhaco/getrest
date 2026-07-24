import { invokeRestRequest } from "../adapters/tauriRestAdapter";
import type { HttpMethod, RestRequest, RestResponse } from "../domain/rest";

export interface SendRestRequestInput {
  method: HttpMethod;
  url: string;
  body: string;
}

export async function sendRestRequest(
  input: SendRestRequestInput,
): Promise<RestResponse> {
  const url = validateUrl(input.url);
  const body = input.body.trim();
  const canHaveBody = !["GET", "HEAD"].includes(input.method);

  const request: RestRequest = {
    method: input.method,
    url: url.toString(),
    headers:
      canHaveBody && body
        ? [{ name: "content-type", value: "application/json" }]
        : [],
    body: canHaveBody && body ? body : null,
  };

  return invokeRestRequest(request);
}

function validateUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid request URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS request URLs are supported.");
  }

  return url;
}
