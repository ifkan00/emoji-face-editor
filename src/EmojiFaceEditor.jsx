import React, { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";

const PASSWORD = "kanai0";

export default function EmojiFaceEditor() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("authenticated") === "true"
  );
  const [passwordInput, setPasswordInput] = useState("");

  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emoji, setEmoji] = useState("😎");
  const [emojiList] = useState(["😂", "😊", "😉", "🤣", "😁", "😄", "😍", "😚", "😋", "🤩", "😎", "😳"]);
  const [emojiOverlays, setEmojiOverlays] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      console.log("✅ モデル読み込み完了");
    };
    loadModels();
  }, []);

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    const imageUrls = await Promise.all(files.map((file) => URL.createObjectURL(file)));
    setImages(imageUrls);
    setCurrentIndex(0);
    setEmojiOverlays([]);
  };

  const detectFaces = async () => {
    const input = imageRef.current;
    if (!input.complete || input.naturalWidth === 0) {
      console.log("画像がまだ読み込まれていません。");
      return;
    }
    console.log("画像サイズ:", input.naturalWidth, input.naturalHeight);
    const detections = await faceapi.detectAllFaces(input, new faceapi.TinyFaceDetectorOptions());
    console.log("顔検出結果:", detections);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = input.naturalWidth;
    canvas.height = input.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(input, 0, 0, canvas.width, canvas.height);

    const newOverlays = detections.map((det) => ({
      x: det.box.x,
      y: det.box.y,
      size: det.box.width,
      emoji: emoji,
    }));

    console.log("🎯 オーバーレイ:", newOverlays);
    setEmojiOverlays(newOverlays);
    setUndoStack([]);
  };

  const drawEmojis = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    emojiOverlays.forEach((item) => {
      ctx.font = `${item.size}px serif`;
      ctx.fillText(item.emoji, item.x, item.y + item.size);
    });
    console.log("🎨 drawEmojis() 実行中");
    console.log("🧩 emojiOverlays:", emojiOverlays);
  };

  useEffect(() => {
    if (imageRef.current && canvasRef.current && emojiOverlays.length > 0) {
      drawEmojis();
    }
  }, [emojiOverlays]);

  const handleUndo = () => {
    if (emojiOverlays.length === 0) return;
    const newOverlays = [...emojiOverlays];
    const removed = newOverlays.pop();
    setUndoStack((prev) => [...prev, removed]);
    setEmojiOverlays(newOverlays);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `edited-image-${currentIndex + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleLogin = () => {
    if (passwordInput === PASSWORD) {
      localStorage.setItem("authenticated", "true");
      setIsAuthenticated(true);
    } else {
      alert("パスワードが間違っています。");
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: "2rem", fontFamily: "Noto Sans JP", textAlign: "center" }}>
        <h2>🔐 パスワードを入力してください</h2>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="パスワード"
          style={{ padding: "0.5rem", fontSize: "1rem", width: "200px" }}
        />
        <br />
        <button
          onClick={handleLogin}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            background: "#f9c5d1",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          ログイン
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", fontFamily: "Noto Sans JP" }}>
      <input type="file" multiple accept="image/*" onChange={handleImageUpload} />

      {images.length > 0 && (
        <>
          <div>
            <img
              src={images[currentIndex]}
              ref={imageRef}
              alt="Uploaded"
              style={{
                maxWidth: "100%",
                visibility: "hidden",
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: -1,
              }}
              onLoad={detectFaces}
            />
            <canvas
              ref={canvasRef}
              style={{ maxWidth: "100%", border: "1px solid #ccc", marginTop: "1rem" }}
            />
          </div>

          <div style={{ marginTop: "1rem" }}>
            {emojiList.map((e) => (
              <button
                key={e}
                style={{
                  margin: "0.25rem",
                  padding: "0.5rem",
                  backgroundColor: emoji === e ? "#ffddee" : "#fff",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                }}
                onClick={() => setEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button onClick={handleUndo} style={{ marginRight: "1rem" }}>戻す</button>
            <button onClick={handleDownload}>保存</button>
          </div>
        </>
      )}
    </div>
  );
}
