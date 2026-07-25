import { invoke } from "@tauri-apps/api/core";
import type { RestRequest, RestResponse } from "../domain/rest";

interface TauriCommandError {
  code?: string;
  message?: string;
}

export async function invokeRestRequest(
  request: RestRequest,
): Promise<RestResponse> {
  try {
    return await invoke<RestResponse>("send_rest_request", { request });
  } catch (error) {
    if (isTauriCommandError(error) && error.message) {
      throw new Error(error.message);
    }

    throw new Error(
      "The native request engine could not complete the request.",
    );
  }
}

function isTauriCommandError(value: unknown): value is TauriCommandError {
  return typeof value === "object" && value !== null;
}
