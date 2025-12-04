import { useState, useEffect, useRef } from "react";
import { Bot, X, Minimize2, Send, Mic, MicOff, Image as ImageIcon, XCircle, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useVoiceInteraction } from "@/hooks/useVoiceInteraction";
import ShinyText from "@/components/ui/ShinyText";

const API_URL = import.meta.env.VITE_API_URL;

interface Message {
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
  image?: string; // Base64 image data
}

export function FleetChatAssistant() {
  const [chatWindowOpen, setChatWindowOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm Movi, your AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatSessionId, setChatSessionId] = useState("");
  const [currentContextPage, setCurrentContextPage] = useState("unknown");
  const [confirmationState, setConfirmationState] = useState<{
    isVisible: boolean;
    alertMessage: string;
    consequenceDetails: any;
  }>({ isVisible: false, alertMessage: "", consequenceDetails: null });

  // Voice interaction state
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // Image handling state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Voice interaction hook - always call (never conditionally)
  const voiceInteraction = useVoiceInteraction({
    sessionId: chatSessionId || '', // Pass empty string if not ready, hook will handle it
    contextPage: currentContextPage,
    onError: (error) => {
      console.error("Voice error:", error);
      // Format error message with line breaks if present
      const formattedError = error.split('\n').map((line: string, idx: number) => 
        idx === 0 ? `**Voice Error:** ${line}` : line
      ).join('\n');
      
      setChatMessages(prev => [
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
    setChatSessionId(`chat-session-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  }, []);

  // Synchronize voice messages with chat messages
  useEffect(() => {
    if (isVoiceActive && chatSessionId && voiceInteraction.messages && voiceInteraction.messages.length > 0) {
      // Convert voice messages to chat message format
      const latestVoiceMessage = voiceInteraction.messages[voiceInteraction.messages.length - 1];
      const latestChatMessage = chatMessages[chatMessages.length - 1];

      // Only add if it's a new message
      if (!latestChatMessage || latestVoiceMessage.timestamp > latestChatMessage.timestamp) {
        setChatMessages(prev => [...prev, {
          role: latestVoiceMessage.type,
          content: latestVoiceMessage.text,
          timestamp: latestVoiceMessage.timestamp
        }]);
      }
    }
  }, [voiceInteraction.messages, isVoiceActive, chatSessionId]);

  // Handle voice confirmation state
  useEffect(() => {
    if (chatSessionId && voiceInteraction.requiresConfirmation && voiceInteraction.consequenceInfo) {
      setConfirmationState({
        isVisible: true,
        alertMessage: voiceInteraction.consequenceInfo.message,
        consequenceDetails: voiceInteraction.consequenceInfo
      });
    }
  }, [voiceInteraction.requiresConfirmation, voiceInteraction.consequenceInfo, chatSessionId]);

  // Detect current page context for tool filtering
  useEffect(() => {
    const currentPath = window.location.pathname;
    let detectedPage = "unknown";
    if (currentPath.includes("/buses")) detectedPage = "busDashboard";
    else if (currentPath.includes("/routes")) detectedPage = "routes";
    else if (currentPath.includes("/stops-paths")) detectedPage = "stops_paths";
    else if (currentPath.includes("/vehicles")) detectedPage = "vehicles";
    else if (currentPath.includes("/drivers")) detectedPage = "drivers";
    setCurrentContextPage(detectedPage);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Handle image paste from clipboard (ChatGPT-style)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!chatWindowOpen) return;

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
  }, [chatWindowOpen]);

  // Convert image file to base64
  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setUploadedImage(base64String);
      setImagePreviewUrl(base64String);
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
    setUploadedImage(null);
    setImagePreviewUrl(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
  };

  const quickActions = [
    "Show unassigned vehicles",
    "List all vehicles",
    "How many vehicles are not assigned?",
  ];

  const handleSend = async () => {
    if ((!userInput.trim() && !uploadedImage) || isProcessing) return;

    const userMessage = userInput || "What's in this image?";
    const imageToSend = uploadedImage;

    setUserInput("");

    // Add user message to chat with image
    setChatMessages(prev => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
        image: imageToSend || undefined,
      },
    ]);

    // Clear image after adding to chat
    setUploadedImage(null);
    setImagePreviewUrl(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }

    setIsProcessing(true);

    try {
      // Prepare request body
      const requestBody: any = {
        message: userMessage,
        session_id: chatSessionId,
        context_page: currentContextPage,
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

      // Create a placeholder message for the assistant response
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let accumulatedResponse = "";

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
              accumulatedResponse += data.content;

              // Update the last message with new content
              setChatMessages(prev => {
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
              setConfirmationState({
                isVisible: true,
                alertMessage: data.payload.message,
                consequenceDetails: data.payload,
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
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async (confirmed: boolean) => {
    setConfirmationState({ isVisible: false, alertMessage: "", consequenceDetails: null });

    // If in voice mode, use voice chat confirmation
    if (isVoiceActive) {
      await voiceInteraction.sendConfirmation(confirmed);
      return;
    }

    // Text mode confirmation
    const confirmMessage = confirmed ? "yes" : "no";

    // Add user's confirmation message to chat
    setChatMessages(prev => [
      ...prev,
      {
        role: "user",
        content: confirmMessage,
        timestamp: new Date(),
      },
    ]);

    setIsProcessing(true);

    try {
      // Send confirmation directly to backend
      const response = await fetch(`${API_URL}/movi/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: confirmMessage,
        session_id: chatSessionId,
        context_page: currentContextPage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from Movi");
      }

      // Create a placeholder message for the assistant response
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let accumulatedResponse = "";

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
              accumulatedResponse += data.content;

              // Update the last message with new content
              setChatMessages(prev => {
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
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your confirmation.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!chatWindowOpen && (
        <button
          onClick={() => setChatWindowOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-primary rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group z-50 animate-in fade-in zoom-in"
        >
          <Bot className="w-7 h-7 text-primary-foreground" />
        </button>
      )}

      {/* Chat Panel */}
      {chatWindowOpen && (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-card rounded-2xl shadow-2xl flex flex-col z-50 border border-border animate-in slide-in-from-bottom-4 slide-in-from-right-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Movi</h3>
                <p className="text-xs text-muted-foreground">AI Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setChatWindowOpen(false)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setChatWindowOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Context Indicator */}
          <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground border-b border-border">
            Context: {
              currentContextPage === "busDashboard" ? "Bus Dashboard (Trips, Vehicles, Drivers)" :
                currentContextPage === "routes" ? "Routes (Route Management)" :
                  currentContextPage === "stops_paths" ? "Stops & Paths (Stop & Path Configuration)" :
                    currentContextPage === "vehicles" ? "Vehicles (Vehicle Management)" :
                      currentContextPage === "drivers" ? "Drivers (Driver Management)" :
                        "General"
            }
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {/* Show image if present */}
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Uploaded content"
                      className="rounded-lg mb-2 max-w-full h-auto max-h-48 object-contain"
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
                    ) : (
                      <ShinyText text="Thinking..." speed={3} />
                    )
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <span className="text-xs opacity-70 mt-1 block">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={chatScrollRef} />
          </div>

          {/* Quick Actions */}
          {chatMessages.length === 1 && (
            <div className="px-4 pb-3 space-y-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => setUserInput(action)}
                  className="w-full text-left text-sm px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-fast text-foreground"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            {/* Voice Mode Indicator */}
            {isVoiceActive && (
              <div className="mb-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {voiceInteraction.isRecording && (
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    )}
                    {voiceInteraction.isProcessing && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    {voiceInteraction.isSpeaking && (
                      <Volume2 className="w-4 h-4 text-primary animate-pulse" />
                    )}
                    <span className="text-sm font-medium">
                      {voiceInteraction.isRecording ? "🎤 Listening..." :
                        voiceInteraction.isProcessing ? "⏳ Processing..." :
                          voiceInteraction.isSpeaking ? "🔊 Speaking..." :
                            "Voice Mode Active"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsVoiceActive(false);
                      voiceInteraction.stopRecording();
                      voiceInteraction.stopAudio();
                    }}
                  >
                    Exit Voice Mode
                  </Button>
                </div>
              </div>
            )}

            {/* Image Preview (only in text mode) */}
            {!isVoiceActive && imagePreviewUrl && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreviewUrl}
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
              {!isVoiceActive ? (
                <>
                  {/* Text Mode Controls */}
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => imageFileInputRef.current?.click()}
                    title="Upload image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </Button>

                  <Input
                    ref={textInputRef}
                    placeholder="Ask Movi anything... (Paste images with Ctrl+V)"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    className="flex-1 bg-muted border-border"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => {
                      if (!chatSessionId) {
                        console.warn('⚠️ Session not ready yet');
                        return;
                      }
                      setIsVoiceActive(true);
                    }}
                    disabled={!chatSessionId}
                    title={chatSessionId ? "Switch to voice mode" : "Initializing..."}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>

                  <Button
                    size="icon"
                    className="h-9 w-9 flex-shrink-0 bg-primary hover:bg-primary-dark"
                    onClick={handleSend}
                    disabled={isProcessing || (!userInput.trim() && !uploadedImage)}
                  >
                    {isProcessing ? (
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
                        voiceInteraction.isRecording
                          ? "bg-red-500 hover:bg-red-600 animate-pulse"
                          : "bg-primary hover:bg-primary-dark"
                      )}
                      onClick={() => {
                        if (voiceInteraction.isRecording) {
                          voiceInteraction.stopRecording();
                        } else {
                          voiceInteraction.startRecording();
                        }
                      }}
                      disabled={voiceInteraction.isProcessing || voiceInteraction.isSpeaking}
                    >
                      {voiceInteraction.isRecording ? (
                        <MicOff className="w-6 h-6" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </Button>
                  </div>

                  {voiceInteraction.isSpeaking && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => voiceInteraction.stopAudio()}
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
      <AlertDialog open={confirmationState.isVisible} onOpenChange={(isVisible) =>
        !isVisible && setConfirmationState({ isVisible: false, alertMessage: "", consequenceDetails: null })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmation Required</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationState.alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmAction(false)}>
              No, Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmAction(true)}>
              Yes, Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
