import BaseService, { IResponse } from "./BaseService";

export type TimeseriesStep = "day" | "week" | "month";

export interface AnalyticsRequest {
    boundary_id?: number;
    /** ISO date (YYYY-MM-DD). */
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
    open_older_than_30d: number;
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

export interface GetTimeseriesResponse extends IResponse {
    payload: TimeseriesPoint[];
}

export function analyticsParams(req: AnalyticsRequest, extra: Record<string, string> = {}): URLSearchParams {
    const params = new URLSearchParams();
    if (req.boundary_id !== undefined && req.boundary_id > 0) {
        params.set("boundary_id", String(req.boundary_id));
    }
    if (req.from) {
        params.set("from", req.from);
    }
    if (req.to) {
        params.set("to", req.to);
    }
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params;
}

class AnalyticsService extends BaseService {
    public getKpi(req: AnalyticsRequest): Promise<GetKpiResponse> {
        return this.request<GetKpiResponse>(`/api/analytics/kpi?${analyticsParams(req)}`);
    }

    public getTimeseries(req: AnalyticsRequest, step: TimeseriesStep = "week"): Promise<GetTimeseriesResponse> {
        return this.request<GetTimeseriesResponse>(`/api/analytics/timeseries?${analyticsParams(req, { step })}`);
    }
}

export default new AnalyticsService();
