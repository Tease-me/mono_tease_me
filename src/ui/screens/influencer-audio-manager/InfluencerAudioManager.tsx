// src/screens/InfluencerAudioManager.tsx
import axios from "axios";
import React, { useEffect, useState } from "react";

interface InfluencerAudioFile {
  key: string;
  download_url: string;
}

interface InfluencerAudioResponse {
  influencer_id: string;
  count: number;
  files: InfluencerAudioFile[];
}

interface Props {
  influencerId: string;
}

const API_BASE_URL = `${import.meta.env.VITE_TEASE_ME_PROTOCOL}://${
  import.meta.env.VITE_TEASE_ME_HOST
}`;

const InfluencerAudioManager: React.FC<Props> = ({ influencerId }) => {
  const [data, setData] = useState<InfluencerAudioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const fetchAudio = async () => {
    try {
      setLoading(true);

      const res = await axios.get<InfluencerAudioResponse>(
        `${API_BASE_URL}/influencer/influencer-audio/${influencerId}`
      );

      setData(res.data);
    } catch (err: any) {
      console.error(err);

      // SPECIAL CASE → backend returns 404 with:
      // { "detail": "Influencer has no audio file stored" }
      const detail = err?.response?.data?.detail;

      if (detail === "Influencer has no audio file stored") {
        setData({
          influencer_id: influencerId,
          count: 0,
          files: [],
        });
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudio();
  }, [influencerId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      await axios.post(
        `${API_BASE_URL}/influencer/influencer-audio/${influencerId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setFile(null);
      await fetchAudio();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <h2>Audio files for {influencerId}</h2>

      {/* UPLOAD BAR */}
      <div style={{ marginBottom: 24 }}>
        <input type="file" accept="audio/*" onChange={handleFileChange} />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            marginLeft: 12,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid #fff",
            background: "transparent",
            color: "#fff",
            cursor: !file || uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {/* LOADING */}
      {loading && <div>Loading audio files…</div>}

      {/* EMPTY */}
      {data && data.files.length === 0 && !loading && (
        <div>No audio files uploaded yet.</div>
      )}

      {/* LIST */}
      {data && data.files.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0" }}>
          {data.files.map((file) => (
            <li
              key={file.key}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 8 }}>{file.key}</div>

              <audio
                controls
                src={file.download_url}
                style={{ width: "100%", marginBottom: 8 }}
              />

              <button
                type="button"
                onClick={() => window.open(file.download_url, "_blank")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #fff",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Open in new tab
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InfluencerAudioManager;
