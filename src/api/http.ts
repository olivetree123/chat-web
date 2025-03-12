import axios, { AxiosRequestConfig } from "axios";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 创建 axios 实例
const http = axios.create({
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "Authorization": "b4be1354-2099-470c-8abe-a96367db4686"
  },
});

// 请求拦截器
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    // const token = "b4be1354-2099-470c-8abe-a96367db4686"

    // 如果有 token 且不是登录/注册接口，则添加到 header
    if (
      token &&
      !config.url?.includes("/login") &&
      !config.url?.includes("/signup")
    ) {
      config.headers.Authorization = token;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
http.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse<any>;

    if (res.code !== 0) {
      throw new Error(res.message || "请求失败");
    }

    return res.data;
  },
  (error) => {
    // 如果是 401 未授权，说明 token 过期或无效，需要重新登录
    if (error.response?.status === 401) {
      // 清除本地存储的登录信息
      localStorage.removeItem("token");
      localStorage.removeItem("userId");

      // 跳转到登录页
      window.location.href = "/login";

      return Promise.reject(new Error("请重新登录"));
    }

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error(error.message || "网络错误，请稍后重试");
  },
);

// 封装请求方法
export const request = {
  get: <T>(url: string, config?: AxiosRequestConfig) => {
    return http.get<any, T>(url, config);
  },
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return http.post<any, T>(url, data, config);
  },
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return http.put<any, T>(url, data, config);
  },
  delete: <T>(url: string, config?: AxiosRequestConfig) => {
    return http.delete<any, T>(url, config);
  },
};

export default http;
