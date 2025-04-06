import React, { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const PASSWORD = "kanai0";

export default function EmojiFaceEditor() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("authenticated") === "true"
  );
  const [passwordInput, setPasswordInput] = useState("");

  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emojiList, setEmojiList] = useState(["😂", "😊", "😉", "🤣", "😁", "😄", "😍", "😚", "😋", "🤩", "😎", "😳"]);
  const [selectedEmoji, setSelectedEmoji] = useState("😎");
  const [overlays, setOverlays] = useState([]);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);

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
    setOverlays([]);
  };

  const detectFaces = async () => {
    const input = imageRef.current;
    if (!input || !input.complete || input.naturalWidth === 0) {
      console.log("画像がまだ読み込まれていません。");
      return;
    }

    const detections = await faceapi.detectAllFaces(input, new faceapi.TinyFaceDetectorOptions());
    console.log("顔検出結果:", detections);

    const newOverlays = detections.map((d) => ({
      x: d.box.x,
      y: d.box.y,
      size: d.box.width,
      emoji: selectedEmoji,
      id: Math.random().toString(36).substr(2, 9), // 一意なID
    }));

    setOverlays(newOverlays);
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    overlays.forEach((o) => {
      ctx.font = `${o.size}px serif`;
      ctx.fillText(o.emoji, o.x, o.y + o.size);
    });
  };

  useEffect(() => {
    if (imageRef.current && canvasRef.current) {
      drawCanvas();
    }
  }, [overlays, currentIndex]);
  const handleMouseDown = (index) => {
    setDraggingIndex(index);
  };

  const handleMouseUp = () => {
    setDraggingIndex(null);
  };

  const handleMouseMove = (e) => {
    if (draggingIndex === null) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setOverlays((prev) => {
      const updated = [...prev];
      updated[draggingIndex] = { ...updated[draggingIndex], x, y };
      return updated;
    });
  };

  const handleDeleteOverlay = (index) => {
    setOverlays((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddEmoji = () => {
    setOverlays((prev) => [
      ...prev,
      {
        x: 100,
        y: 100,
        size: 80,
        emoji: selectedEmoji,
        id: Math.random().toString(36).substr(2, 9),
      },
    ]);
  };

  const handleSizeChange = (index, delta) => {
    setOverlays((prev) => {
      const updated = [...prev];
      updated[index].size = Math.max(20, updated[index].size + delta);
      return updated;
    });
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setOverlays([]);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setOverlays([]);
    }
  };
  const handleSaveCurrentImage = () => {
    setSaving(true);
    const canvas = document.createElement("canvas");
    const img = imageRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    overlays.forEach((o) => {
      ctx.font = `${o.size}px serif`;
      ctx.fillText(o.emoji, o.x, o.y + o.size);
    });
    canvas.toBlob((blob) => {
      saveAs(blob, `image-${currentIndex + 1}.png`);
      setSaving(false);
    });
  };

  const handleSaveAllAsZip = () => {
    const zip = new JSZip();
    const promises = images.map((imgUrl, index) => {
      return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgUrl;
        img.onload = () => {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          if (index === currentIndex) {
            overlays.forEach((o) => {
              ctx.font = `${o.size}px serif`;
              ctx.fillText(o.emoji, o.x, o.y + o.size);
            });
          }

          canvas.toBlob((blob) => {
            zip.file(`image-${index + 1}.png`, blob);
            resolve();
          });
        };
      });
    });

    Promise.all(promises).then(() => {
      zip.generateAsync({ type: "blob" }).then((content) => {
        saveAs(content, "edited-images.zip");
      });
    });
  };

  const handleLogin = () => {
    if (passwordInput === PASSWORD) {
      localStorage.setItem("authenticated", "true");
      setIsAuthenticated(true);
    } else {
      alert("パスワードが違います");
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
    <div
      style={{
        fontFamily: "'Noto Sans JP', sans-serif",
        backgroundColor: "#fff0f5",
        padding: "1rem",
        minHeight: "100vh",
        boxSizing: "border-box",
        textAlign: "center",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <input type="file" multiple accept="image/*" onChange={handleImageUpload} />

      {images.length > 0 && (
        <>
          <div style={{ position: "relative", display: "inline-block", marginTop: "1rem" }}>
            <img
              src={images[currentIndex]}
              ref={imageRef}
              onLoad={detectFaces}
              alt="source"
              style={{ maxWidth: "100%", display: "block" }}
            />
            {overlays.map((o, i) => (
              <div
                key={o.id}
                onMouseDown={() => handleMouseDown(i)}
                style={{
                  position: "absolute",
                  top: o.y,
                  left: o.x,
                  fontSize: `${o.size}px`,
                  cursor: "move",
                  border: i === draggingIndex ? "2px solid #88f" : "none",
                }}
              >
                {o.emoji}
                <div>
                  <button onClick={() => handleSizeChange(i, 10)}>＋</button>
                  <button onClick={() => handleSizeChange(i, -10)}>−</button>
                  <button onClick={() => handleDeleteOverlay(i)}>🗑</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "1rem" }}>
            {emojiList.map((e) => (
              <button
                key={e}
                onClick={() => setSelectedEmoji(e)}
                style={{
                  fontSize: "1.5rem",
                  margin: "0.25rem",
                  padding: "0.5rem",
                  backgroundColor: selectedEmoji === e ? "#ffddee" : "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}
            <button
              onClick={handleAddEmoji}
              style={{
                fontSize: "1.5rem",
                margin: "0.25rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#ffcccc",
                border: "1px solid #ccc",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              ＋
            </button>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button onClick={goToPrev} disabled={currentIndex === 0}>
              ◀ 前へ
            </button>
            <span style={{ margin: "0 1rem" }}>
              {currentIndex + 1} / {images.length}
            </span>
            <button onClick={goToNext} disabled={currentIndex === images.length - 1}>
              次へ ▶
            </button>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button onClick={handleSaveCurrentImage} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={handleSaveAllAsZip} style={{ marginLeft: "1rem" }}>
              ZIP保存
            </button>
          </div>
        </>
      )}
    </div>
  );
}
