import { useState, useEffect, useRef } from "react";
import { Bot, X, Minimize2, Send, Mic, MicOff, Image as ImageIcon, XCircle, Loader2, Volume2, Copy, RefreshCw, User, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import ShinyText from "@/components/ShinyText";

const API_URL = import.meta.env.VITE_API_URL;

interface Message {
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
  image?: string; // Base64 image data
}

export function MoviAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm Movi, your AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [contextPage, setContextPage] = useState("unknown");
  const [confirmationDialog, setConfirmationDialog] = useState<{
    open: boolean;
    message: string;
    consequenceInfo: any;
  }>({ open: false, message: "", consequenceInfo: null });

  // Voice interaction state
  const [voiceMode, setVoiceMode] = useState(false);

  // Image handling state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice interaction hook - always call (never conditionally)
  const voiceChat = useVoiceChat({
    sessionId: sessionId || '', // Pass empty string if not ready, hook will handle it
    contextPage: contextPage,
    onError: (error) => {
      console.error("Voice error:", error);
      // Format error message with line breaks if present
      const formattedError = error.split('\n').map((line: string, idx: number) => 
        idx === 0 ? `**Voice Error:** ${line}` : line
      ).join('\n');
      
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: formattedError,
          timestamp: new Date(),
        },
      ]);
    }
  });

  // Initialize chat session on mount
  useEffect(() => {
    setSessionId(`chat-session-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  }, []);

  // Synchronize voice messages with chat messages in real-time
  useEffect(() => {
    if (voiceMode && sessionId && voiceChat.messages && voiceChat.messages.length > 0) {
      // Get all voice messages
      const voiceMessages = voiceChat.messages;
      
      // Sync all voice messages to chat, updating existing ones
      setMessages(prev => {
        const updated = [...prev];
        
        voiceMessages.forEach((voiceMsg) => {
          // Find if this message already exists (by role and similar content or timestamp)
          const existingIndex = updated.findIndex(
            msg => {
              // Match by role and content similarity (for updates)
              if (msg.role === voiceMsg.type) {
                // If content is similar or empty, it's likely the same message being updated
                if (msg.content === voiceMsg.text || 
                    voiceMsg.text.includes(msg.content) || 
                    msg.content === "" ||
                    Math.abs(msg.timestamp.getTime() - voiceMsg.timestamp.getTime()) < 5000) {
                  return true;
                }
              }
              return false;
            }
          );
          
          if (existingIndex >= 0) {
            // Update existing message
            updated[existingIndex] = {
              role: voiceMsg.type,
              content: voiceMsg.text,
              timestamp: voiceMsg.timestamp
            };
          } else {
            // Add new message
            updated.push({
              role: voiceMsg.type,
              content: voiceMsg.text,
              timestamp: voiceMsg.timestamp
            });
          }
        });
        
        return updated;
      });
    }
  }, [voiceChat.messages, voiceMode, sessionId]);

  // Handle voice confirmation state
  useEffect(() => {
    if (sessionId && voiceChat.requiresConfirmation && voiceChat.consequenceInfo) {
      setConfirmationDialog({
        open: true,
        message: voiceChat.consequenceInfo.message,
        consequenceInfo: voiceChat.consequenceInfo
      });
    }
  }, [voiceChat.requiresConfirmation, voiceChat.consequenceInfo, sessionId]);

  // Detect current page context for tool filtering
  useEffect(() => {
    const currentPath = window.location.pathname;
    let detectedPage = "unknown";
    if (currentPath.includes("/buses")) detectedPage = "busDashboard";
    else if (currentPath.includes("/routes")) detectedPage = "routes";
    else if (currentPath.includes("/stops-paths")) detectedPage = "stops_paths";
    else if (currentPath.includes("/vehicles")) detectedPage = "vehicles";
    else if (currentPath.includes("/drivers")) detectedPage = "drivers";
    setContextPage(detectedPage);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle image paste from clipboard (ChatGPT-style)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            handleImageFile(blob);
          }
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isOpen]);

  // Convert image file to base64
  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSelectedImage(base64String);
      setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  // Handle file input change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageFile(file);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const [typingIndicator, setTypingIndicator] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  const quickActions = [
    { text: "Show unassigned vehicles", icon: Zap },
    { text: "List all vehicles", icon: Sparkles },
    { text: "How many vehicles are not assigned?", icon: Bot },
  ];

  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedImage) || isLoading) return;

    const userMessage = inputValue || "What's in this image?";
    const imageToSend = selectedImage;

    setInputValue("");

    // Add user message to chat with image
    setMessages(prev => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
        image: imageToSend || undefined,
      },
    ]);

    // Clear image after adding to chat
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setIsLoading(true);

    try {
      // Prepare request body
      const requestBody: any = {
        message: userMessage,
        session_id: sessionId,
        context_page: contextPage,
      };

      // Add image if present (extract base64 data)
      if (imageToSend) {
        // Remove data:image/xxx;base64, prefix if present
        const base64Data = imageToSend.includes("base64,")
          ? imageToSend.split("base64,")[1]
          : imageToSend;
        requestBody.image_base64 = base64Data;
      }

      // Call Movi API
      const response = await fetch(`${API_URL}/movi/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from Movi");
      }

      // Show typing indicator instead of creating empty message
      setTypingIndicator(true);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let accumulatedResponse = "";
      let messageCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.type === "token") {
              // Create message on first token
              if (!messageCreated) {
                setTypingIndicator(false);
                setMessages(prev => [
                  ...prev,
                  {
                    role: "assistant",
                    content: "",
                    timestamp: new Date(),
                  },
                ]);
                messageCreated = true;
              }

              accumulatedResponse += data.content;

              // Update the last message with new content
              setMessages(prev => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage.role === "assistant") {
                  lastMessage.content = accumulatedResponse;
                }
                return updatedMessages;
              });
            }
            else if (data.type === "confirmation") {
              // Handle HITL confirmation
              setConfirmationDialog({
                open: true,
                message: data.payload.message,
                consequenceInfo: data.payload,
              });
            }
            else if (data.type === "error") {
              console.error("Stream error:", data.content);
              // Optionally show error in chat
            }
          } catch (e) {
            console.error("Error parsing stream line:", line, e);
          }
        }
      }

    } catch (error) {
      console.error("Error calling Movi:", error);
      setTypingIndicator(false);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
    }
  };

  const handleConfirmAction = async (confirmed: boolean) => {
    setConfirmationDialog({ open: false, message: "", consequenceInfo: null });

    // If in voice mode, use voice chat confirmation
    if (voiceMode) {
      await voiceChat.sendConfirmation(confirmed);
      return;
    }

    // Text mode confirmation
    const confirmMessage = confirmed ? "yes" : "no";

    // Add user's confirmation message to chat
    setMessages(prev => [
      ...prev,
      {
        role: "user",
        content: confirmMessage,
        timestamp: new Date(),
      },
    ]);

    setIsLoading(true);

    try {
      // Send confirmation directly to backend
      const response = await fetch(`${API_URL}/movi/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: confirmMessage,
        session_id: sessionId,
        context_page: contextPage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from Movi");
      }

      // Show typing indicator instead of creating empty message
      setTypingIndicator(true);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let accumulatedResponse = "";
      let messageCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.type === "token") {
              // Create message on first token
              if (!messageCreated) {
                setTypingIndicator(false);
                setMessages(prev => [
                  ...prev,
                  {
                    role: "assistant",
                    content: "",
                    timestamp: new Date(),
                  },
                ]);
                messageCreated = true;
              }

              accumulatedResponse += data.content;

              // Update the last message with new content
              setMessages(prev => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage.role === "assistant") {
                  lastMessage.content = accumulatedResponse;
                }
                return updatedMessages;
              });
            }
            else if (data.type === "error") {
              console.error("Stream error:", data.content);
            }
          } catch (e) {
            console.error("Error parsing stream line:", line, e);
          }
        }
      }
    } catch (error) {
      console.error("Error sending confirmation:", error);
      setTypingIndicator(false);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your confirmation.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-primary via-purple-500 to-accent rounded-2xl shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center group animate-in fade-in zoom-in"
          style={{ zIndex: 9999 }}
          aria-label="Open Movi AI Assistant"
        >
          <Bot className="w-7 h-7 text-primary-foreground animate-float" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-card animate-pulse"></span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-6 right-6 w-[420px] h-[650px] bg-card rounded-3xl shadow-2xl flex flex-col border border-border/50 backdrop-blur-sm animate-in slide-in-from-bottom-4 slide-in-from-right-4 fade-in duration-300 overflow-hidden"
          style={{ zIndex: 9999 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 via-purple-500/10 to-accent/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg animate-float">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-foreground gradient-text">Movi</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                  AI Assistant
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted/50"
                onClick={() => {
                  setMessages([{
                    role: "assistant",
                    content: "Hi! I'm Movi, your AI assistant. How can I help you today?",
                    timestamp: new Date(),
                  }]);
                }}
                title="Clear chat"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted/50"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Context Indicator */}
          <div className="px-4 py-2 bg-gradient-to-r from-primary/5 to-accent/5 text-xs text-muted-foreground border-b border-border/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="font-medium">
                {contextPage === "busDashboard" ? "Bus Dashboard" :
                  contextPage === "routes" ? "Route Management" :
                    contextPage === "stops_paths" ? "Stops & Paths" :
                      contextPage === "vehicles" ? "Vehicle Management" :
                        contextPage === "drivers" ? "Driver Management" :
                          "General Context"}
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3 group",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {/* Avatar */}
                {message.role === "assistant" && (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3 relative",
                  message.role === "user"
                    ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md"
                    : "bg-muted text-foreground border border-border/50"
                )}>
                  {/* Message Actions */}
                  <div className={cn(
                    "absolute -top-8 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                    message.role === "user" && "left-0 right-auto"
                  )}>
                    {message.content && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full bg-card shadow-sm hover:bg-muted"
                        onClick={() => {
                          navigator.clipboard.writeText(message.content);
                          setCopiedMessageId(index);
                          setTimeout(() => setCopiedMessageId(null), 2000);
                        }}
                        title="Copy message"
                      >
                        {copiedMessageId === index ? (
                          <Loader2 className="w-3 h-3 animate-spin text-success" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Show image if present */}
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Uploaded content"
                      className="rounded-lg mb-2 max-w-full h-auto max-h-48 object-contain border border-border/50"
                    />
                  )}
                  
                  {/* Render markdown for assistant messages, plain text for user */}
                  {message.role === "assistant" ? (
                    message.content ? (
                      <div className="chat-markdown">
                        <ReactMarkdown
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            code: ({ node, inline, className, children, ...props }: any) => {
                              return inline ? (
                                <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono border border-border" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : null
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  
                  <span className="text-xs opacity-60 mt-2 block">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* User Avatar */}
                {message.role === "user" && (
                  <div className="w-8 h-8 bg-gradient-to-br from-accent to-primary rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            
            {/* Typing Indicator */}
            {typingIndicator && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3 border border-border/50">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length === 1 && (
            <div className="px-4 pb-3 space-y-2">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => setInputValue(action.text)}
                      className="flex items-center gap-2 text-xs px-3 py-2 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 border border-primary/20 rounded-xl transition-all text-foreground hover-lift"
                    >
                      <Icon className="w-3.5 h-3.5 text-primary" />
                      <span>{action.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            {/* Voice Mode Indicator */}
            {voiceMode && (
              <Card className="mb-3 p-3 bg-gradient-to-r from-primary/10 via-purple-500/10 to-accent/10 border-primary/30 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {voiceChat.isRecording && (
                      <div className="relative">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75"></div>
                      </div>
                    )}
                    {voiceChat.isLoading && (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    )}
                    {voiceChat.isSpeaking && (
                      <Volume2 className="w-5 h-5 text-primary animate-pulse" />
                    )}
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        {voiceChat.isRecording ? "Listening..." :
                          voiceChat.isLoading ? "Processing..." :
                            voiceChat.isSpeaking ? "Speaking..." :
                              "Voice Mode"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {voiceChat.isRecording ? "Speak now..." :
                          voiceChat.isLoading ? "Understanding your request..." :
                            voiceChat.isSpeaking ? "Playing response..." :
                              "Click mic to start"}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setVoiceMode(false);
                      voiceChat.stopRecording();
                      voiceChat.stopAudio();
                    }}
                  >
                    Exit
                  </Button>
                </div>
              </Card>
            )}

            {/* Image Preview (only in text mode) */}
            {!voiceMode && imagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="rounded-lg max-h-32 object-contain border-2 border-primary"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {!voiceMode ? (
                <>
                  {/* Text Mode Controls */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </Button>

                  <Input
                    ref={inputRef}
                    placeholder="Ask Movi anything... (Paste images with Ctrl+V)"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    className="flex-1 bg-muted/50 border-border rounded-xl focus:ring-2 focus:ring-primary/20"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => {
                      if (!sessionId) {
                        console.warn('⚠️ Session not ready yet');
                        return;
                      }
                      setVoiceMode(true);
                    }}
                    disabled={!sessionId}
                    title={sessionId ? "Switch to voice mode" : "Initializing..."}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>

                  <Button
                    size="icon"
                    className="h-9 w-9 flex-shrink-0 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-md hover:scale-105 transition-transform"
                    onClick={handleSend}
                    disabled={isLoading || (!inputValue.trim() && !selectedImage)}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </>
              ) : (
                <>
                  {/* Voice Mode Controls */}
                  <div className="flex-1 flex items-center justify-center">
                    <Button
                      size="lg"
                      className={cn(
                        "h-16 w-16 rounded-full transition-all",
                        voiceChat.isRecording
                          ? "bg-red-500 hover:bg-red-600 animate-pulse"
                          : "bg-gradient-to-br from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg"
                      )}
                      onClick={() => {
                        if (voiceChat.isRecording) {
                          voiceChat.stopRecording();
                        } else {
                          voiceChat.startRecording();
                        }
                      }}
                      disabled={voiceChat.isLoading || voiceChat.isSpeaking}
                    >
                      {voiceChat.isRecording ? (
                        <MicOff className="w-6 h-6" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </Button>
                  </div>

                  {voiceChat.isSpeaking && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => voiceChat.stopAudio()}
                      title="Stop speaking"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Human-in-the-Loop */}
      <AlertDialog open={confirmationDialog.open} onOpenChange={(open) =>
        !open && setConfirmationDialog({ open: false, message: "", consequenceInfo: null })
      }>
        <AlertDialogContent className="rounded-2xl border-2 border-warning/20">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-warning/20 to-orange-500/20 rounded-xl flex items-center justify-center border-2 border-warning/30">
                <Zap className="w-6 h-6 text-warning" />
              </div>
              <AlertDialogTitle className="text-xl gradient-text">Confirmation Required</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed pt-2">
              {confirmationDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              onClick={() => handleConfirmAction(false)}
              className="rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleConfirmAction(true)}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl shadow-md"
            >
              Confirm & Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
