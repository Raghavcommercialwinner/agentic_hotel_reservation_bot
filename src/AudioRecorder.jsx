import React, { useRef, useState } from "react";
import Recorder from "recorder-js";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const recorderRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const recorder = new Recorder(audioContext, {
        // Optional: output type and config
        type: 'audio/wav',
      });

      await recorder.init(stream);
      recorder.start();

      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or failed", err);
    }
  };

  const stopRecording = async () => {
    try {
      const { blob } = await recorderRef.current.stop();
      setIsRecording(false);
      setAudioBlob(blob);
      sendToBackend(blob);
    } catch (err) {
      console.error("Error stopping recording", err);
    }
  };

  const sendToBackend = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, "voice.wav");

    try {
      const response = await fetch("http://127.0.0.1:8000/chat/audio", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("Failed to upload audio", await response.text());
      } else {
        console.log("Audio uploaded successfully");
      }
    } catch (error) {
      console.error("Error uploading audio", error);
    }
  };

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h2>Audio Recorder</h2>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      {audioBlob && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Preview:</h4>
          <audio controls src={URL.createObjectURL(audioBlob)} />
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
