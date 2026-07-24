import ApiHelper from '@api/utils/api.js';
import { env } from '@common/config/index.js';

const BASE_URL = `${env.MS_PRIVATE_BASE_URL}/<service-name>`;
const API_SECRET = env.API_SECRET;

const api = ApiHelper.create({
  baseURL: BASE_URL,
  headers: { 'api-secret': API_SECRET },
});

export default class ServiceNameClient {
  static async methodName(params) {
    const res = await api.method('/<version>/<resource>', params);

    return {
      resObject: res.context,
      status: res.status,
      data: res.data,
    };
  }
}
