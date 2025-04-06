import React, { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./App.css";

export default function EmojiFaceEditor() {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emoji, setEmoji] = useState("😎");
  const [emojiList] = useState(["😂", "😊", "😉", "🤣", "😁", "😄", "😍", "😚", "😋", "🤩", "😎", "😳"]);
  const [emojiOverlaysList, setEmojiOverlaysList] = useState([]);
  const [selectedEmojiIndex, setSelectedEmojiIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const imageRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      console.log("✅ モデル読み込み完了");
    };
    loadModels();
  }, []);

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files).slice(0, 10);
    const imageUrls = await Promise.all(files.map((file) => URL.createObjectURL(file)));
    setImages(imageUrls);
    setCurrentIndex(0);
    setEmojiOverlaysList(Array(imageUrls.length).fill([]));
    setSelectedEmojiIndex(null);
  };

  const detectFaces = async () => {
    const input = imageRef.current;
    if (!input || !input.complete || input.naturalWidth === 0) return;

    const scale = 0.3;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = input.naturalWidth * scale;
    tempCanvas.height = input.naturalHeight * scale;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(input, 0, 0, tempCanvas.width, tempCanvas.height);

    const detections = await faceapi.detectAllFaces(
      tempCanvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 })
    );

    const ratioX = input.clientWidth / input.naturalWidth;
    const ratioY = input.clientHeight / input.naturalHeight;

    const newOverlays = detections.map((det) => ({
      x: det.box.x / scale * ratioX,
      y: det.box.y / scale * ratioY,
      size: det.box.width / scale * ratioX,
      emoji: emoji,
    }));

    setEmojiOverlaysList((prev) => {
      const updated = [...prev];
      updated[currentIndex] = newOverlays;
      return updated;
    });
  };

  const handlePointerDown = (e, index) => {
    e.stopPropagation();
    setSelectedEmojiIndex(index);
    dragOffset.current = {
      x: emojiOverlaysList[currentIndex][index].x - e.clientX,
      y: emojiOverlaysList[currentIndex][index].y - e.clientY,
    };

    const move = (moveEvent) => {
      setEmojiOverlaysList((prev) => {
        const updated = [...prev];
        updated[currentIndex][index] = {
          ...updated[currentIndex][index],
          x: moveEvent.clientX + dragOffset.current.x,
          y: moveEvent.clientY + dragOffset.current.y,
        };
        return updated;
      });
    };

    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const handleSizeChange = (delta) => {
    if (selectedEmojiIndex === null) return;
    setEmojiOverlaysList((prev) => {
      const updated = [...prev];
      updated[currentIndex][selectedEmojiIndex].size = Math.max(
        10,
        updated[currentIndex][selectedEmojiIndex].size + delta
      );
      return updated;
    });
  };

  const handleDeleteEmoji = () => {
    if (selectedEmojiIndex === null) return;
    setEmojiOverlaysList((prev) => {
      const updated = [...prev];
      updated[currentIndex] = updated[currentIndex].filter((_, i) => i !== selectedEmojiIndex);
      return updated;
    });
    setSelectedEmojiIndex(null);
  };

  const handleAddEmoji = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const newEmoji = {
      x: img.clientWidth / 2 - 20,
      y: img.clientHeight / 2 - 20,
      size: 40,
      emoji: emoji,
    };
    setEmojiOverlaysList((prev) => {
      const updated = [...prev];
      updated[currentIndex] = [...updated[currentIndex], newEmoji];
      return updated;
    });
  };

  const handlePrev = () => {
    setSelectedEmojiIndex(null);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSelectedEmojiIndex(null);
    setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveMessage("すべて保存中です...");

    const zip = new JSZip();

    for (let i = 0; i < images.length; i++) {
      const img = new Image();
      img.src = images[i];
      await new Promise((res) => (img.onload = res));

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const scaleX = canvas.width / imageRef.current.clientWidth;
      const scaleY = canvas.height / imageRef.current.clientHeight;

      emojiOverlaysList[i].forEach((item) => {
        ctx.font = `${item.size * scaleX}px serif`;
        ctx.fillText(item.emoji, item.x * scaleX, (item.y + item.size) * scaleY);
      });

      const blob = await new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/png")
      );
      zip.file(`image-${i + 1}.png`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, "emoji_images.zip");

    setIsSaving(false);
    setSaveMessage("すべて保存しました！");
    setTimeout(() => setSaveMessage(""), 2000);
  };

  return (
    <div className="main-container">
      <input type="file" multiple accept="image/*" onChange={handleImageUpload} />

      {images.length > 0 && (
        <>
          <div className="image-wrapper">
            <img
              src={images[currentIndex]}
              ref={imageRef}
              alt="Uploaded"
              onLoad={detectFaces}
              style={{ width: "100%", display: "block" }}
            />

            {emojiOverlaysList[currentIndex]?.map((item, index) => (
              <div
                key={index}
                onPointerDown={(e) => handlePointerDown(e, index)}
                style={{
                  position: "absolute",
                  top: item.y,
                  left: item.x,
                  fontSize: `${item.size}px`,
                  cursor: "grab",
                  userSelect: "none",
                  border: selectedEmojiIndex === index ? "2px solid blue" : "none",
                  borderRadius: "50%",
                  backgroundColor: "transparent",
                  touchAction: "none",
                }}
              >
                {item.emoji}
              </div>
            ))}
          </div>

          {selectedEmojiIndex !== null && (
            <div className="controls">
              <button onClick={() => handleSizeChange(5)}>＋</button>
              <button onClick={() => handleSizeChange(-5)}>−</button>
              <button onClick={handleDeleteEmoji} style={{ color: "red" }}>🗑</button>
            </div>
          )}

          <div className="emoji-list">
            {emojiList.map((e) => {
              const isSelected =
                selectedEmojiIndex !== null
                  ? emojiOverlaysList[currentIndex]?.[selectedEmojiIndex]?.emoji === e
                  : emoji === e;

              return (
                <button
                  key={e}
                  style={{
                    backgroundColor: isSelected ? "#ffb3cc" : "#fff",
                    border: isSelected ? "2px solid #ff69b4" : "1px solid #ccc"
                  }}
                  onClick={() => {
                    if (selectedEmojiIndex !== null) {
                      setEmojiOverlaysList((prev) => {
                        const updated = [...prev];
                        updated[currentIndex][selectedEmojiIndex].emoji = e;
                        return updated;
                      });
                    } else {
                      setEmoji(e);
                    }
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>

          <div className="controls">
            <button onClick={handlePrev} disabled={currentIndex === 0}>◀ 前へ</button>
            <button onClick={handleNext} disabled={currentIndex === images.length - 1}>次へ ▶</button>
            <button onClick={handleAddEmoji}>＋ 絵文字を追加</button>
            <button onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存（ZIP）"}
            </button>
          </div>

          {saveMessage && <div style={{ color: "green" }}>{saveMessage}</div>}
        </>
      )}
    </div>
  );
}
