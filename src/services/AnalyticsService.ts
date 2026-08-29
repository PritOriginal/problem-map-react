import BaseService, { IResponse, unwrapList } from "./BaseService";
import { toRfc3339Range } from "../utils/dates";

export type TimeseriesStep = "day" | "week" | "month";

export interface AnalyticsRequest {
    boundary_id?: number;
    /** `YYYY-MM-DD` (from `<input type="date">`) or RFC3339; converted to an RFC3339 range by `analyticsParams`. */
    from?: string;
    to?: string;
}

export interface Kpi {
    total: number;
    by_status: Record<string, number>;
    avg_confirm_hours: number | null;
    median_confirm_hours: number | null;
    avg_close_hours: number | null;
    refuted_share: number | null;
    /** Not provided by the current backend (`models.KPI`); shown as 0 when absent. */
    open_older_than_30d?: number;
    sla_breach_share?: number | null;
    by_organization?: { organization_id: number; name: string; total: number; overdue: number }[];
}

export interface TimeseriesPoint {
    period: string;
    created: number;
    confirmed: number;
    closed: number;
    refuted: number;
}

export interface GetKpiResponse extends IResponse {
    payload: Kpi;
}

/** `GET /analytics/timeseries` returns `{ timeseries: TimeseriesPoint[] }`; `payload` is unwrapped to the list. */
export interface GetTimeseriesResponse extends IResponse {
    payload: TimeseriesPoint[];
}

export function analyticsParams(req: AnalyticsRequest, extra: Record<string, string> = {}): URLSearchParams {
    const params = new URLSearchParams();
    if (req.boundary_id !== undefined && req.boundary_id > 0) {
        params.set("boundary_id", String(req.boundary_id));
    }
    const { from, to } = toRfc3339Range(req.from, req.to);
    if (from) {
        params.set("from", from);
    }
    if (to) {
        params.set("to", to);
    }
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params;
}

class AnalyticsService extends BaseService {
    public getKpi(req: AnalyticsRequest): Promise<GetKpiResponse> {
        return this.request<GetKpiResponse>(`/api/analytics/kpi?${analyticsParams(req)}`);
    }

    public getTimeseries(req: AnalyticsRequest, step: TimeseriesStep = "week"): Promise<GetTimeseriesResponse> {
        return this.request<IResponse>(`/api/analytics/timeseries?${analyticsParams(req, { step })}`)
            .then((res) => ({ ...res, payload: unwrapList<TimeseriesPoint>(res.payload, "timeseries") }));
    }
}

export default new AnalyticsService();
