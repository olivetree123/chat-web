import { request } from "./http";

interface ChatResult {
  conversation_uid: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens: number;
  created_at: string;
}

interface ConversationResult {
  conversation_uid: string;
  model_name: string;
  title?: string;
  created_at: string;
}

interface CreateConversationRequest {
  conversation_uid: string;
  model_name: string;
  query: string;
  files?: File[];
}

interface UpdateConversationRequest {
  title: string;
}

// 自定义SSE接口，与原生EventSource保持类似
export interface CustomEventSource {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((error: any) => void) | null;
  onopen: (() => void) | null;
  close: () => void;
  ondone?: () => void;
}

// 获取模型列表
export const getModelList = async (): Promise<string[]> => {
  return request.get<string[]>("/api/tuning/base_models");
};

// 发送对话请求 - 使用POST方法的SSE实现
export const createConversation = async (params: CreateConversationRequest): Promise<CustomEventSource> => {
  // const token = localStorage.getItem('auth_token') || '';
  // const token = '5e765a9c-9e51-4c1c-a50d-393a1f21374e';
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const formData = new FormData();

  // 添加基本参数
  formData.append('conversation_uid', params.conversation_uid);
  formData.append('model_name', params.model_name);
  formData.append('query', params.query);

  // 添加文件(如果有)
  if (params.files && params.files.length > 0) {
    params.files.forEach((file) => {
      formData.append(`files`, file);
    });
    // 添加文件数量信息
    // formData.append('file_count', params.files.length.toString());
  }

  // 设置头部信息
  const headers: Record<string, string> = {
    'Authorization': `${token}`
  };

  const response = await fetch('/api/chat/create', {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('响应缺少body');
  }

  // 获取响应流的Reader
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // 用于存储未完整处理的数据
  let buffer = '';

  // 创建自定义的SSE对象
  const eventSource: CustomEventSource = {
    onmessage: null,
    onerror: null,
    onopen: null,
    close: () => {
      reader.cancel();
    }
  };

  // 通知连接已打开
  if (eventSource.onopen) {
    eventSource.onopen();
  }

  // 处理数据流
  const processStream = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // 解码二进制数据
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 处理缓冲区中的完整SSE消息
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // 保留最后一个可能不完整的消息

        for (const message of messages) {
          if (!message.trim()) continue;

          // 解析SSE消息
          const dataMatch = message.match(/^data: (.+)$/m);
          if (dataMatch && eventSource.onmessage) {
            try {
              const data = dataMatch[1].trim();

              // 检查是否为结束信号
              if (data === "[DONE]") {
                // 关闭读取器
                reader.cancel();

                // 触发完成事件
                if (eventSource.ondone) {
                  eventSource.ondone();
                }

                break; // 跳出循环，停止处理
              } else {
                // 正常处理数据
                eventSource.onmessage({ data });
              }
            } catch (e) {
              console.error('解析SSE消息出错:', e);
            }
          }

          // 检查是否为完成事件
          const eventMatch = message.match(/^event: (.+)$/m);
          if (eventMatch) {
            const eventType = eventMatch[1].trim();
            if (['done', 'end', 'complete', 'finished'].includes(eventType)) {
              eventSource.close();
            }
          }
        }
      }
    } catch (error: any) {
      if (eventSource.onerror) {
        eventSource.onerror(error);
      }
    }
  };

  // 开始处理流
  processStream();

  return eventSource;
};

// 获取会话列表
export const getConversationList = async (): Promise<ConversationResult[]> => {
  return request.get<ConversationResult[]>("/api/chat/conversation/list");
};

// 更新会话
export const updateConversation = async (conversationId: string, params: UpdateConversationRequest): Promise<ChatResult> => {
  return request.post<ChatResult>(`/api/chat/conversation/${conversationId}/update`, params);
};

// 删除会话
export const deleteConversation = async (conversationId: string): Promise<ChatResult> => {
  return request.post<ChatResult>(`/api/chat/conversation/${conversationId}/delete`);
};

// 获取会话详情
export const getConversationDetail = async (conversationId: string): Promise<ChatResult[]> => {
  return request.get<ChatResult[]>(`/api/chat/conversation/${conversationId}/chats`);
};
