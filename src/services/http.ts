export interface IResponse {
    success: boolean;
    error?: {
        message: string;
    };
    payload?: unknown;
}

/** Error returned by the backend API (or a transport failure), with the HTTP status. */
export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

export function getErrorMessage(error: unknown, fallback: string = "Произошла ошибка"): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === "string" && error) {
        return error;
    }
    return fallback;
}

/**
 * Parses a fetch Response. On a non-OK status (or `success: false` in the body)
 * rejects with an ApiError whose message is taken from the backend body
 * (`{ success, error: { message } }`) when available.
 */
export async function parseResponse<T extends IResponse = IResponse>(response: Response): Promise<T> {
    let body: Partial<IResponse> | null = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }

    if (!response.ok || (body !== null && body.success === false)) {
        const message = body?.error?.message
            || response.statusText
            || `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status);
    }

    return body as T;
}
