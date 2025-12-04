import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

interface VoiceMessage {
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  audio?: string; // Base64 audio for assistant responses
}

interface UseVoiceChatOptions {
  sessionId: string;
  contextPage: string;
  onError?: (error: string) => void;
}

export function useVoiceChat({ sessionId, contextPage, onError }: UseVoiceChatOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [consequenceInfo, setConsequenceInfo] = useState<any>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Guard against empty sessionId
    if (!sessionId || sessionId.trim() === '') {
      return;
    }
    
    const wsUrl = API_URL.replace('http', 'ws') + '/movi/voice';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send initialization message
      ws.send(JSON.stringify({
        type: 'init',
        session_id: sessionId,
        context_page: contextPage
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'ready') {
        // Voice session ready
      } else if (data.type === 'transcription') {
        // Add user message to chat IMMEDIATELY
        setMessages(prev => [...prev, {
          type: 'user',
          text: data.text,
          timestamp: new Date()
        }]);
      } else if (data.type === 'processing') {
        setIsProcessing(true);
      } else if (data.type === 'text_chunk') {
        // Stream text response in real-time
        setMessages(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage && lastMessage.type === 'assistant') {
            // Update existing assistant message
            lastMessage.text = data.text;
          } else {
            // Create new assistant message
            updated.push({
              type: 'assistant',
              text: data.text,
              timestamp: new Date()
            });
          }
          return updated;
        });
      } else if (data.type === 'text_response') {
        // Final text response (before TTS)
        setIsProcessing(true); // Still processing (generating audio)
        
        // Always create/update assistant message with the full response
        setMessages(prev => {
          const updated = [...prev];
          // Find the last assistant message (if any)
          let lastAssistantIndex = -1;
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === 'assistant') {
              lastAssistantIndex = i;
              break;
            }
          }
          
          if (lastAssistantIndex >= 0) {
            // Update existing assistant message
            updated[lastAssistantIndex].text = data.text;
            updated[lastAssistantIndex].timestamp = new Date();
          } else {
            // Create new assistant message
            updated.push({
              type: 'assistant',
              text: data.text,
              timestamp: new Date()
            });
          }
          return updated;
        });
        
        // Check for confirmation requirement
        if (data.awaiting_confirmation && data.consequence_info) {
          setRequiresConfirmation(true);
          setConsequenceInfo(data.consequence_info);
        }
      } else if (data.type === 'audio_response') {
        setIsProcessing(false);
        
        // Update assistant message with audio (text should already be shown)
        setMessages(prev => {
          const updated = [...prev];
          // Find the last assistant message
          let lastAssistantIndex = -1;
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === 'assistant') {
              lastAssistantIndex = i;
              break;
            }
          }
          
          if (lastAssistantIndex >= 0) {
            // Update existing assistant message with audio
            updated[lastAssistantIndex].audio = data.data;
            // Update text if provided and different
            if (data.text && updated[lastAssistantIndex].text !== data.text) {
              updated[lastAssistantIndex].text = data.text;
            }
          } else {
            // Create new if somehow missing (shouldn't happen, but safety check)
            updated.push({
              type: 'assistant',
              text: data.text || 'Audio response received',
              timestamp: new Date(),
              audio: data.data
            });
          }
          return updated;
        });
        
        // Check for confirmation requirement (again, in case not set earlier)
        if (data.awaiting_confirmation && data.consequence_info) {
          setRequiresConfirmation(true);
          setConsequenceInfo(data.consequence_info);
        }
        
        // Play audio response
        playAudio(data.data);
      } else if (data.type === 'error') {
        setIsProcessing(false);
        onError?.(data.message);
      }
    };

    ws.onerror = (error) => {
      onError?.('Voice connection error');
    };

    ws.onclose = () => {
      // WebSocket disconnected
    };

    wsRef.current = ws;
  }, [sessionId, contextPage, onError]);

  // Initialize on mount
  useEffect(() => {
    // Only connect if sessionId is available and not empty
    if (!sessionId || sessionId.trim() === '') {
      return;
    }
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        // Only send close if WebSocket is open
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'close' }));
          } catch (err) {
            console.warn('Failed to send close message:', err);
          }
        }
        wsRef.current.close();
      }
      stopAudio();
    };
  }, [sessionId, contextPage]);

  // Update context when page changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_context',
        context_page: contextPage
      }));
    }
  }, [contextPage]);

  // Check microphone permission status
  const checkMicrophonePermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return 'denied';
      }
      
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permissionStatus.state as 'granted' | 'denied' | 'prompt';
    } catch (error) {
      // Permissions API not supported, will try getUserMedia directly
      return 'prompt';
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        onError?.('Microphone access not available. Please use a modern browser (Chrome, Firefox, Edge, Safari).');
        return;
      }

      // Check permission status first
      const permissionStatus = await checkMicrophonePermission();
      
      if (permissionStatus === 'denied') {
        onError?.('Microphone access was denied. Please enable microphone permissions in your browser settings and refresh the page.\n\nTo fix:\n1. Click the lock icon in your browser\'s address bar\n2. Allow microphone access\n3. Refresh this page');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create audio context for potential visualizations
      audioContextRef.current = new AudioContext();
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          
          // Send to WebSocket
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setIsProcessing(true);
            wsRef.current.send(JSON.stringify({
              type: 'audio',
              data: base64Audio,
              format: 'webm'
            }));
          }
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error: any) {
      
      // Provide specific error messages based on error type
      let errorMessage = 'Microphone access denied.';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access was denied. Please:\n\n1. Click the lock/padlock icon in your browser\'s address bar\n2. Allow microphone access for this site\n3. Refresh the page and try again';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application. Please close other apps using the microphone and try again.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone constraints could not be satisfied. Please check your microphone settings.';
      } else if (error.message) {
        errorMessage = `Microphone error: ${error.message}`;
      }
      
      onError?.(errorMessage);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Play audio response
  const playAudio = (base64Audio: string) => {
    // Stop any currently playing audio
    stopAudio();
    
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    currentAudioRef.current = audio;
    
    audio.onplay = () => {
      setIsSpeaking(true);
    };
    
    audio.onended = () => {
      setIsSpeaking(false);
    };
    
    audio.onerror = (error) => {
      console.error('❌ Audio playback error:', error);
      setIsSpeaking(false);
      onError?.('Failed to play audio response');
    };
    
    audio.play().catch(error => {
      console.error('❌ Failed to play audio:', error);
      setIsSpeaking(false);
    });
  };

  // Stop audio playback
  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setIsSpeaking(false);
    }
  };

  // Send confirmation response
  const sendConfirmation = async (confirmed: boolean) => {
    const confirmMessage = confirmed ? 'yes' : 'no';
    
    // Add user message
    setMessages(prev => [...prev, {
      type: 'user',
      text: confirmMessage,
      timestamp: new Date()
    }]);
    
    setRequiresConfirmation(false);
    setConsequenceInfo(null);
    
    // Convert text to audio and send
    // For simplicity, we'll use the text chat endpoint for confirmation
    // Alternatively, we could synthesize the word "yes"/"no" locally
    
    // Create a simple audio message (we could use Web Speech API here)
    // For now, send as text through the same pipeline
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // We'll create a synthetic transcription event
      setIsProcessing(true);
      
      // Send the confirmation text directly as if it was transcribed
      // The backend will process it through the same graph
      try {
        const response = await fetch(`${API_URL}/movi/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: confirmMessage,
            session_id: sessionId,
            context_page: contextPage
          })
        });
        
        const data = await response.json();
        
        // Convert response to speech
        const ttsResponse = await fetch(`${API_URL}/movi/voice/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: data.response
          })
        });
        
        const audioData = await ttsResponse.json();
        
        setMessages(prev => [...prev, {
          type: 'assistant',
          text: data.response,
          timestamp: new Date(),
          audio: audioData.audio_base64
        }]);
        
        playAudio(audioData.audio_base64);
        setIsProcessing(false);
      } catch (error) {
        console.error('Error sending confirmation:', error);
        setIsProcessing(false);
        onError?.('Failed to send confirmation');
      }
    }
  };

  return {
    isRecording,
    isProcessing,
    isLoading: isProcessing, // Alias for compatibility
    isSpeaking,
    messages,
    requiresConfirmation,
    consequenceInfo,
    startRecording,
    stopRecording,
    sendConfirmation,
    stopAudio
  };
}
