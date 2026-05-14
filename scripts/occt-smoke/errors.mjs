export class SmokePageError extends Error {
  details;

  constructor(details) {
    super(details.message);
    this.name = "SmokePageError";
    this.details = details;
  }
}

export function parseSmokePageResult(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new SmokePageError({
      code: "SMOKE_PAGE_RESULT_PARSE_FAILED",
      stage: "page",
      message:
        error instanceof Error
          ? error.message
          : "Failed to parse geometry worker smoke page result.",
      workerStarted: false,
      wasmLoadStatus: "unknown"
    });
  }
}

export function parseSmokePageError(text) {
  if (!text) {
    return {
      code: "SMOKE_PAGE_FAILED",
      stage: "page",
      message: "Geometry worker smoke page failed.",
      workerStarted: false,
      wasmLoadStatus: "unknown"
    };
  }

  try {
    const result = JSON.parse(text);

    if (result?.error) {
      return result.error;
    }
  } catch {
    // Fall through to the text-shaped error below.
  }

  return {
    code: "SMOKE_PAGE_FAILED",
    stage: "page",
    message: text,
    workerStarted: false,
    wasmLoadStatus: "unknown"
  };
}

export function createSmokeErrorDetails(error) {
  if (error instanceof SmokePageError) {
    return error.details;
  }

  return {
    code: "SMOKE_RUNNER_FAILURE",
    stage: "runner",
    message: error instanceof Error ? error.message : "OCCT smoke failed.",
    workerStarted: false,
    wasmLoadStatus: "unknown"
  };
}
