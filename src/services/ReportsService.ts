import BaseService, { IResponse, unwrapList } from "./BaseService";
import { ListMeta } from "./http";
import { Mark } from "./MarksService";

export type ReportTargetType = "mark" | "check" | "comment";
export const REPORT_TARGET_TYPES: readonly ReportTargetType[] = ["mark", "check", "comment"];

export type ReportReason = "spam" | "offensive" | "wrong_place" | "duplicate" | "other";
export const REPORT_REASONS: readonly ReportReason[] = ["spam", "offensive", "wrong_place", "duplicate", "other"];

export type ReportStatus = "open" | "resolved" | "dismissed";
export const REPORT_STATUSES: readonly ReportStatus[] = ["open", "resolved", "dismissed"];

export interface AddReportRequest {
    target_type: ReportTargetType;
    target_id: number;
    reason: ReportReason;
    comment?: string;
}

/** A complaint in the moderation queue (`GET /moderation/queue`). */
export interface Report {
    report_id: number;
    target_type: ReportTargetType;
    target_id: number;
    reason: ReportReason;
    comment: string;
    reporter_id: number;
    status: ReportStatus;
    created_at: string;
    /** The reported mark (or the mark of the reported check/comment) when the backend expands it. */
    target?: Mark | null;
}

export interface GetQueueRequest {
    status?: ReportStatus;
    target_type?: ReportTargetType;
    limit?: number;
    offset?: number;
}

/** `GET /moderation/queue` returns `{ reports: Report[] }`; `payload` is unwrapped to the list. */
export interface GetQueueResponse extends IResponse {
    payload: Report[];
    meta?: ListMeta;
}

/** Complaints and the moderation queue (backend integration/wave-5). */
class ReportsService extends BaseService {
    /** `POST /reports`: 409 when the user already reported the target, 429 on the rate limit. */
    public addReport(req: AddReportRequest): Promise<IResponse> {
        return this.requestWithAuth("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify(req),
        });
    }

    /** Moderator/admin: the queue of complaints. */
    public getQueue(req: GetQueueRequest = {}): Promise<GetQueueResponse> {
        const params = new URLSearchParams();
        if (req.status) {
            params.set("status", req.status);
        }
        if (req.target_type) {
            params.set("target_type", req.target_type);
        }
        if (req.limit !== undefined) {
            params.set("limit", String(req.limit));
        }
        if (req.offset !== undefined) {
            params.set("offset", String(req.offset));
        }
        const query = params.toString();
        return this.requestWithAuth<GetQueueResponse>(`/api/moderation/queue${query ? `?${query}` : ""}`)
            .then((res) => ({ ...res, payload: unwrapList<Report>(res.payload, "reports") }));
    }

    /** Moderator/admin: closes a complaint. */
    public setReportStatus(id: number, status: "resolved" | "dismissed"): Promise<IResponse> {
        return this.requestWithAuth(`/api/moderation/reports/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json;charset=utf-8" },
            body: JSON.stringify({ status }),
        });
    }
}

export default new ReportsService();
