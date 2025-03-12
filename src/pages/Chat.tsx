import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Paperclip, Bot, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getModelList, getConversationList, createConversation, updateConversation as apiUpdateConversation, deleteConversation as apiDeleteConversation, getConversationDetail } from "@/api/chat";
import { v4 as uuidv4 } from 'uuid';
import { CustomEventSource } from '@/api/chat';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';


// 与API接口匹配的消息结构
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
}

// 与API接口匹配的对话结构
interface Conversation {
  conversation_uid: string;
  title: string;
  model_name: string;
  messages: Message[];
  lastMessageTime: Date;
}

// 可用的模型列表
const availableModels = ["gpt-3.5-turbo", "gpt-4", "claude-2"];

// 文件大小限制（5MB）
// const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 检查文件是否符合要求
// const validateFile = (file: File): { valid: boolean; message?: string } => {
//   if (file.size > MAX_FILE_SIZE) {
//     return {
//       valid: false,
//       message: `文件 ${file.name} 太大，最大限制5MB`
//     };
//   }

//   // 可以根据需要添加文件类型检查
//   // const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', ...];
//   // if (!allowedTypes.includes(file.type)) {
//   //   return { valid: false, message: `不支持的文件类型: ${file.type}` };
//   // }

//   return { valid: true };
// };

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(availableModels[0]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<CustomEventSource | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // 加载对话列表和模型列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取模型列表
        const models = await getModelList();
        if (models && models.length > 0) {
          setModelOptions(models);
          setSelectedModel(models[0]);
        } else {
          setModelOptions(availableModels);
        }

        // 获取对话列表
        const convList = await getConversationList();
        if (convList && convList.length > 0) {
          const formattedConversations = convList.map(conv => ({
            conversation_uid: conv.conversation_uid,
            title: conv.title || "新对话",
            model_name: conv.model_name,
            messages: [],
            lastMessageTime: new Date(conv.created_at)
          }));

          setConversations(formattedConversations);

          // 设置活动对话为第一个对话
          setActiveConversation(formattedConversations[0].conversation_uid);

          // 加载第一个对话的详情
          const conversationDetail = await getConversationDetail(formattedConversations[0].conversation_uid);
          if (conversationDetail && conversationDetail.length > 0) {
            const formattedMessages = conversationDetail.map(msg => ({
              id: uuidv4(),
              content: msg.content,
              role: msg.role as 'user' | 'assistant' | 'system',
              timestamp: new Date(msg.created_at)
            }));
            setMessages(formattedMessages);
          }
        } else {
          // 如果没有对话，创建一个新对话
          createNewConversation();
        }
      } catch (error) {
        console.error("加载数据失败:", error);
        // 创建一个新对话作为后备方案
        createNewConversation();
      }
    };

    fetchData();
  }, []);

  // 当切换对话时，加载对话详情
  useEffect(() => {
    const loadConversationDetail = async () => {
      if (activeConversation) {
        try {
          const conversationDetail = await getConversationDetail(activeConversation);
          if (conversationDetail && conversationDetail.length > 0) {
            const formattedMessages = conversationDetail.map(msg => ({
              id: uuidv4(),
              content: msg.content,
              role: msg.role as 'user' | 'assistant' | 'system',
              timestamp: new Date(msg.created_at)
            }));
            setMessages(formattedMessages);
          } else {
            setMessages([]);
          }
        } catch (error) {
          console.error("加载对话详情失败:", error);
          setMessages([]);
        }
      }
    };

    loadConversationDetail();
  }, [activeConversation]);

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 创建新对话
  const createNewConversation = async () => {
    const newId = uuidv4();
    const newConversation: Conversation = {
      conversation_uid: newId,
      title: "新对话",
      model_name: selectedModel,
      messages: [],
      lastMessageTime: new Date()
    };

    setConversations([newConversation, ...conversations]);
    setActiveConversation(newId);
    setMessages([]);
    setInput("");
  };

  // 处理键盘输入
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 修改文件选择处理函数
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    // 重置input以便再次选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除已选择的文件
  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // 清空所有已选择的文件
  const clearFiles = () => {
    setSelectedFiles([]);
  };

  // 触发文件选择器点击
  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 发送消息 - 修改为使用createConversation的SSE流式功能
  const sendMessage = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || isStreamLoading) return;

    // 创建用户消息
    const userMessage: Message = {
      id: uuidv4(),
      content: input || (selectedFiles.length > 0 ? `[上传了${selectedFiles.length}个文件]` : ''),
      role: 'user',
      timestamp: new Date()
    };

    // 更新UI显示用户消息
    setMessages([...messages, userMessage]);

    // 提前创建助手消息占位
    const assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date()
    };

    // 添加空的助手消息，准备接收流式内容
    setMessages(prev => [...prev, assistantMessage]);
    setInput("");
    setIsStreamLoading(true);

    // 调整输入框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // 清理之前可能存在的EventSource连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // 使用createConversation创建SSE连接
      const params = {
        conversation_uid: activeConversation,
        model_name: selectedModel,
        query: input.trim(),
        files: selectedFiles,
      };

      const eventSource = await createConversation(params);
      eventSourceRef.current = eventSource;

      // 处理消息事件 - 累积更新助手回复内容
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 根据服务端返回的数据结构进行解析
          // 有些服务可能直接返回内容字符串，有些可能返回包含content字段的对象
          let content = '';
          let isDone = false;

          if (typeof data === 'string') {
            content = data;
          } else if (data && typeof data === 'object') {
            // 检查是否包含完成标志
            if (data.done === true || data.finished === true || data.end === true || data.complete === true) {
              isDone = true;
            }

            // 提取内容
            if (typeof data.content === 'string') {
              content = data.content;
            } else if (data.choices && data.choices[0] && data.choices[0].delta && typeof data.choices[0].delta.content === 'string') {
              // 处理OpenAI类型的响应
              content = data.choices[0].delta.content;
            } else if (typeof data === 'object' && Object.keys(data).length === 0) {
              // 空对象，可能是心跳包，忽略
              return;
            }
          }

          // 如果是完成事件
          if (isDone) {
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            setIsStreamLoading(false);
            updateConversationAfterResponse(input.trim());
            return;
          }

          // 更新助手消息内容
          if (content) {
            setMessages(prev => {
              const updatedMessages = [...prev];
              const assistantMessageIndex = updatedMessages.findIndex(
                msg => msg.id === assistantMessageId
              );

              if (assistantMessageIndex !== -1) {
                updatedMessages[assistantMessageIndex] = {
                  ...updatedMessages[assistantMessageIndex],
                  content: updatedMessages[assistantMessageIndex].content + content
                };
              }

              return updatedMessages;
            });
          }
        } catch (error) {
          console.error('解析SSE消息出错:', error);
        }
      };

      eventSource.ondone = () => {
        setIsStreamLoading(false);
        updateConversationAfterResponse(input.trim());
      };

      // 处理错误
      eventSource.onerror = (error) => {
        console.error("SSE连接错误:", error);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setIsStreamLoading(false);

        // 更新助手消息内容，显示错误
        setMessages(prev => {
          const updatedMessages = [...prev];
          const assistantMessageIndex = updatedMessages.findIndex(
            msg => msg.id === assistantMessageId
          );

          if (assistantMessageIndex !== -1) {
            updatedMessages[assistantMessageIndex] = {
              ...updatedMessages[assistantMessageIndex],
              content: updatedMessages[assistantMessageIndex].content + "\n\n[连接错误，请重试]"
            };
          }

          return updatedMessages;
        });
      };

      // 发送后清空文件
      clearFiles();
    } catch (error) {
      console.error("发送消息失败:", error);
      setIsStreamLoading(false);

      // 显示错误消息
      setMessages(prev => {
        // 查找刚添加的助手消息
        const hasAssistantMsg = prev.some(msg => msg.id === assistantMessageId);
        if (hasAssistantMsg) {
          // 更新助手消息为错误提示
          return prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: "消息发送失败，请稍后重试。" }
              : msg
          );
        } else {
          // 如果助手消息没有添加成功，添加一个错误消息
          const errorMessage: Message = {
            id: uuidv4(),
            content: "消息发送失败，请稍后重试。",
            role: 'system',
            timestamp: new Date()
          };
          return [...prev, errorMessage];
        }
      });
    }
  };

  // 成功响应后更新对话标题
  const updateConversationAfterResponse = (userInput: string) => {
    try {
      // 如果是新对话且当前只有一问一答，则更新标题
      const currentConv = conversations.find(c => c.conversation_uid === activeConversation);
      if (currentConv && currentConv.title === "新对话" && messages.filter(m => m.role === 'user').length === 1) {
        // 使用用户的第一条消息作为对话标题
        const newTitle = userInput.substring(0, 20) + (userInput.length > 20 ? "..." : "");
        const updatedConversations = conversations.map(conv =>
          conv.conversation_uid === activeConversation
            ? { ...conv, title: newTitle, lastMessageTime: new Date() }
            : conv
        );
        setConversations(updatedConversations);

        // 更新后端对话标题
        apiUpdateConversation(activeConversation, { title: newTitle }).catch(err => {
          console.error("更新对话标题失败:", err);
        });
      } else {
        // 只更新时间戳
        const updatedConversations = conversations.map(conv =>
          conv.conversation_uid === activeConversation
            ? { ...conv, lastMessageTime: new Date() }
            : conv
        );
        setConversations(updatedConversations);
      }
    } catch (error) {
      console.error("更新对话信息失败:", error);
    }
  };

  // 确保组件卸载时关闭SSE连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // 删除对话
  const deleteConversation = async (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    try {
      // 调用删除API
      await apiDeleteConversation(id);

      // 更新本地状态
      const newConversations = conversations.filter(conv => conv.conversation_uid !== id);

      if (newConversations.length === 0) {
        createNewConversation();
      } else if (activeConversation === id) {
        setActiveConversation(newConversations[0].conversation_uid);
      }

      setConversations(newConversations);
    } catch (error) {
      console.error("删除对话失败:", error);
      // 可以添加错误提示
    }
  };

  // 开始重命名对话
  const startRenaming = (id: string, title: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsRenaming(id);
    setNewTitle(title);
  };

  // 重命名对话
  const renameConversation = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!newTitle.trim()) return;

    try {
      // 调用更新API
      await apiUpdateConversation(id, { title: newTitle });

      // 更新本地状态
      const updatedConversations = conversations.map(conv =>
        conv.conversation_uid === id ? { ...conv, title: newTitle } : conv
      );

      setConversations(updatedConversations);
      setIsRenaming("");
    } catch (error) {
      console.error("重命名对话失败:", error);
      // 可以添加错误提示
    }
  };

  // 用户头像组件
  const UserAvatar = () => (
    <Avatar className="border-0">
      <AvatarFallback className="bg-blue-500 text-white font-semibold text-xs">
        用户
      </AvatarFallback>
    </Avatar>
  );

  // AI助手头像组件
  const AIAvatar = () => (
    <Avatar className="border-0">
      <AvatarFallback className="bg-violet-600 text-white">
        <Bot className="w-4 h-4" />
      </AvatarFallback>
    </Avatar>
  );

  // 在组件内添加或修改useEffect
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      // 小延迟确保DOM已更新
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isRenaming]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background rounded-sm">
      {/* 左侧会话列表 */}
      <div className="w-1/5 border-r border-border flex flex-col bg-slate-900 text-slate-50 h-full">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
          <h2 className="font-semibold text-lg text-white">会话列表</h2>
          <Button
            onClick={createNewConversation}
            variant="outline"
            size="sm"
            className="border-slate-700 bg-slate-800 text-slate-800 hover:bg-slate-700"
          >
            新建
          </Button>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-64px)]">
          <div className="p-2">
            {conversations.map(conv => (
              <div
                key={conv.conversation_uid}
                onClick={() => setActiveConversation(conv.conversation_uid)}
                className={cn(
                  "p-3 mb-2 rounded-md cursor-pointer flex justify-between items-center group",
                  conv.conversation_uid === activeConversation
                    ? "bg-slate-700 text-white"
                    : "hover:bg-slate-800 text-slate-300"
                )}
              >
                {isRenaming === conv.conversation_uid ? (
                  <form
                    onSubmit={(e) => renameConversation(conv.conversation_uid, e)}
                    className="flex-1 flex"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      autoFocus
                      onBlur={() => renameConversation(conv.conversation_uid)}
                      className="w-full bg-slate-800 text-white rounded px-2 py-1 text-sm"
                    />
                  </form>
                ) : (
                  <div className="truncate w-full text-sm text-left pr-2">
                    <p className="font-medium text-left">{conv.title || '新对话'}</p>
                  </div>
                )}

                {isRenaming !== conv.conversation_uid && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">更多选项</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 text-slate-100 border-slate-700">
                      <DropdownMenuItem
                        className="hover:bg-slate-700 cursor-pointer"
                        onClick={(e) => startRenaming(conv.conversation_uid, conv.title, e)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        <span>重命名</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="hover:bg-red-600 cursor-pointer"
                        onClick={(e) => deleteConversation(conv.conversation_uid, e)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>删除</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧聊天界面 */}
      <div className="flex-1 flex flex-col h-full max-h-full">
        <Card className="flex-1 flex flex-col border-0 rounded-none shadow-none h-full">
          <CardContent className="flex-1 p-0 overflow-hidden h-[calc(100vh-90px)]">
            <ScrollArea className="h-full">
              <div className="p-6">
                {messages.length === 0 ? (
                  <div className="h-[calc(100vh-200px)] flex items-center justify-center text-muted-foreground">
                    <p>发送消息开始对话吧！</p>
                  </div>
                ) : (
                  messages.map(message => (
                    <div
                      key={message.id}
                      className={cn(
                        "mb-6 flex items-start",
                        message.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      {/* 头像 */}
                      <div className={cn(
                        "shrink-0",
                        message.role === 'user' ? "ml-2" : "mr-2"
                      )}>
                        {message.role === 'user' ? (
                          <UserAvatar />
                        ) : (
                          <AIAvatar />
                        )}
                      </div>

                      {/* 消息内容 */}
                      <div className={cn(
                        "max-w-[75%] rounded-lg p-3 whitespace-pre-line text-sm text-left",
                        message.role === 'user'
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted rounded-tl-none"
                      )}>
                        {message.content.includes('[上传了') ? (
                          <div>
                            <div className="flex items-center mb-2">
                              <Paperclip className="w-4 h-4 mr-1" />
                              <span>{message.content}</span>
                            </div>
                            <div className="text-xs opacity-75">等待模型处理文件...</div>
                          </div>
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !props.inline && match ? (
                                  <SyntaxHighlighter
                                    style={oneDark as any}
                                    language={match[1]}
                                    PreTag="div"
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              // 添加自定义列表渲染
                              ol({ ...props }) {
                                return <ol style={{ listStyleType: 'decimal', marginLeft: '1.5em' }} {...props} />;
                              },
                              ul({ ...props }) {
                                return <ul style={{ listStyleType: 'disc', marginLeft: '1.5em' }} {...props} />;
                              },
                              li({ ...props }) {
                                return <li style={{ margin: '0.25em 0' }} {...props} />;
                              }
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                        <div className="text-xs opacity-50 mt-1 text-right">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
          <div className="pl-4 pt-2 flex justify-start gap-4 items-center">
            {/* <div className="group flex items-center text-xs text-center text-slate-800 border border-slate-200 rounded-full hover:bg-slate-100 p-1 cursor-pointer" onClick={createNewConversation}>
              <SquarePlus className="w-4 h-4" />
              <p className="max-w-0 overflow-hidden group-hover:max-w-20 transition-all duration-600 ease-in-out whitespace-nowrap text-slate-800">
                <span className="pl-1">新建会话</span>
              </p>
            </div> */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="group flex items-center text-xs text-center text-slate-800 border border-slate-200 rounded-full hover:bg-slate-100 p-1 cursor-pointer">
                  <Bot className="w-4 h-4" />
                  <p className="max-w-200 whitespace-nowrap text-slate-800">
                    <span className="pl-1">{selectedModel}</span>
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-white">
                {modelOptions.map(model => (
                  <DropdownMenuItem
                    key={model}
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => setSelectedModel(model)}
                  >
                    {model}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 隐藏的文件输入 */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />

            {/* 文件上传按钮 */}
            <div
              className="group flex items-center text-xs text-center text-slate-800 border border-slate-200 rounded-full hover:bg-slate-100 p-1 cursor-pointer"
              onClick={openFileSelector}
            >
              <Paperclip className="w-4 h-4" />
              <p className="max-w-0 overflow-hidden group-hover:max-w-20 transition-all duration-600 ease-in-out whitespace-nowrap text-slate-800">
                <span className="pl-1">上传文件</span>
              </p>
            </div>

            {/* 显示已选择的文件 */}
            {selectedFiles.length > 0 && (
              <div className="max-w-full w-full gap-2 flex flex-row">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center bg-sky-200 rounded-sm text-xs pl-2">
                    <span className="truncate flex-1">{file.name}</span>
                    {/* <span className="text-slate-500 mx-1">({(file.size / 1024).toFixed(1)}KB)</span> */}
                    <button
                      onClick={() => removeFile(index)}
                      className="!bg-sky-200 text-slate-500 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <CardFooter className="pl-4 pt-2 shrink-0">
            <div className="flex w-full gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Shift+Enter 换行, Enter 发送)"
                className="flex-1 min-h-[40px] resize-none"
                rows={1}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isStreamLoading}
                className="self-end h-10"
              >
                {isStreamLoading ? "发送中..." : "发送"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
