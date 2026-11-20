// API 호출 래퍼
export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(method, url, body) {
  const opts = { method, headers: { 'x-miart': '1' }, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error || `요청 실패 (${res.status})`, data);
  return data;
}

export const api = {
  get: (url) => request('GET', `/api${url}`),
  post: (url, body = {}) => request('POST', `/api${url}`, body),
  put: (url, body = {}) => request('PUT', `/api${url}`, body),
  patch: (url, body = {}) => request('PATCH', `/api${url}`, body),
  del: (url, body) => request('DELETE', `/api${url}`, body),
};
