import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

interface VoiceMessage {
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  audio?: string; // Base64 audio for assistant responses
}

interface VoiceInteractionOptions {
  sessionId: string;
  contextPage: string;
  onError?: (error: string) => void;
}

export function useVoiceInteraction({ sessionId, contextPage, onError }: VoiceInteractionOptions) {
  const [recordingActive, setRecordingActive] = useState(false);
  const [processingActive, setProcessingActive] = useState(false);
  const [speakingActive, setSpeakingActive] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [consequenceDetails, setConsequenceDetails] = useState<any>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioDataRef = useRef<Blob[]>([]);
  const audioContextInstanceRef = useRef<AudioContext | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Guard against empty sessionId
    if (!sessionId || sessionId.trim() === '') {
      console.warn('⚠️ Cannot connect WebSocket without valid session ID');
      return;
    }
    
    const wsUrl = API_URL.replace('http', 'ws') + '/movi/voice';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🎤 Voice WebSocket connected');
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
        console.log('✅ Voice session ready');
      } else if (data.type === 'transcription') {
        console.log('📝 Transcription:', data.text);
        // Add user message to chat
        setVoiceMessages(prev => [...prev, {
          type: 'user',
          text: data.text,
          timestamp: new Date()
        }]);
      } else if (data.type === 'audio_response') {
        console.log('🔊 Received audio response');
        setProcessingActive(false);
        
        // Add assistant message to chat
        setVoiceMessages(prev => [...prev, {
          type: 'assistant',
          text: data.text,
          timestamp: new Date(),
          audio: data.data
        }]);
        
        // Check for confirmation requirement
        if (data.awaiting_confirmation && data.consequence_info) {
          setNeedsConfirmation(true);
          setConsequenceDetails(data.consequence_info);
        }
        
        // Play audio response
        playAudio(data.data);
      } else if (data.type === 'error') {
        console.error('❌ Voice error:', data.message);
        setProcessingActive(false);
        onError?.(data.message);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      onError?.('Voice connection error');
    };

    ws.onclose = () => {
      console.log('🔌 Voice WebSocket disconnected');
    };

    websocketRef.current = ws;
  }, [sessionId, contextPage, onError]);

  // Initialize on mount
  useEffect(() => {
    // Only connect if sessionId is available and not empty
    if (!sessionId || sessionId.trim() === '') {
      console.warn('⚠️ Session ID not ready, delaying WebSocket connection');
      return;
    }
    
    console.log(`🔌 Initializing voice WebSocket with session: ${sessionId}`);
    connectWebSocket();
    
    return () => {
      if (websocketRef.current) {
        // Only send close if WebSocket is open
        if (websocketRef.current.readyState === WebSocket.OPEN) {
          try {
            websocketRef.current.send(JSON.stringify({ type: 'close' }));
          } catch (err) {
            console.warn('Failed to send close message:', err);
          }
        }
        websocketRef.current.close();
      }
      stopAudio();
    };
  }, [sessionId, contextPage]);

  // Update context when page changes
  useEffect(() => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
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
      audioContextInstanceRef.current = new AudioContext();
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioDataRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioDataRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioDataRef.current, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          
          // Send to WebSocket
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            setProcessingActive(true);
            websocketRef.current.send(JSON.stringify({
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
      recorderRef.current = mediaRecorder;
      setRecordingActive(true);
      
      console.log('🎤 Recording started');
    } catch (error: any) {
      console.error('❌ Failed to start recording:', error);
      
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
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setRecordingActive(false);
      console.log('🛑 Recording stopped');
    }
  };

  // Play audio response
  const playAudio = (base64Audio: string) => {
    // Stop any currently playing audio
    stopAudio();
    
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    activeAudioRef.current = audio;
    
    audio.onplay = () => {
      setSpeakingActive(true);
      console.log('🔊 Playing audio');
    };
    
    audio.onended = () => {
      setSpeakingActive(false);
      console.log('✅ Audio playback finished');
    };
    
    audio.onerror = (error) => {
      console.error('❌ Audio playback error:', error);
      setSpeakingActive(false);
      onError?.('Failed to play audio response');
    };
    
    audio.play().catch(error => {
      console.error('❌ Failed to play audio:', error);
      setSpeakingActive(false);
    });
  };

  // Stop audio playback
  const stopAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
      setSpeakingActive(false);
    }
  };

  // Send confirmation response
  const sendConfirmation = async (confirmed: boolean) => {
    const confirmMessage = confirmed ? 'yes' : 'no';
    
    // Add user message
    setVoiceMessages(prev => [...prev, {
      type: 'user',
      text: confirmMessage,
      timestamp: new Date()
    }]);
    
    setNeedsConfirmation(false);
    setConsequenceDetails(null);
    
    // Convert text to audio and send
    // For simplicity, we'll use the text chat endpoint for confirmation
    // Alternatively, we could synthesize the word "yes"/"no" locally
    
    // Create a simple audio message (we could use Web Speech API here)
    // For now, send as text through the same pipeline
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      // We'll create a synthetic transcription event
      setProcessingActive(true);
      
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
        
        setVoiceMessages(prev => [...prev, {
          type: 'assistant',
          text: data.response,
          timestamp: new Date(),
          audio: audioData.audio_base64
        }]);
        
        playAudio(audioData.audio_base64);
        setProcessingActive(false);
      } catch (error) {
        console.error('Error sending confirmation:', error);
        setProcessingActive(false);
        onError?.('Failed to send confirmation');
      }
    }
  };

  return {
    isRecording,
    isProcessing,
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
