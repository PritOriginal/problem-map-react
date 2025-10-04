export interface IResponse {
    status: 'succeeded' | 'failed';
    message?: string;
    payload?: {
        [key: string]: any;
    }
}

class BaseService {
    protected getResponse(response: Response) {
        if (!response.ok) {
            return Promise.reject();
        }
        return response.json();
    }
}

export default BaseService;