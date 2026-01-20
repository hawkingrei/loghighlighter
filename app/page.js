"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PENDING_LOG_KEY = "loghighlighter.pendingLog.v1";

export default function Home() {
  const router = useRouter();
  const [urlValue, setUrlValue] = useState("");
  const [urlStatus, setUrlStatus] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const [downloadState, setDownloadState] = useState({
    active: false,
    loaded: 0,
    total: 0,
  });

  const handleRenderFromUrl = async () => {
    setUrlStatus("");
    const url = urlValue.trim();

    if (!url) {
      setUrlStatus("Please enter a URL.");
      return;
    }

    setUrlStatus("Loading...");
    setDownloadState({ active: true, loaded: 0, total: 0 });

    try {
      const response = await fetch(`/api/fetch-log?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message);
      }
      const contentLength = Number(response.headers.get("content-length") || 0);
      const reader = response.body?.getReader();
      let text = "";

      if (reader) {
        const decoder = new TextDecoder();
        const chunks = [];
        let received = 0;
        setDownloadState({ active: true, loaded: 0, total: contentLength });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          chunks.push(decoder.decode(value, { stream: true }));
          setDownloadState({
            active: true,
            loaded: received,
            total: contentLength,
          });
        }

        text = chunks.join("") + decoder.decode();
      } else {
        text = await response.text();
      }

      sessionStorage.setItem(PENDING_LOG_KEY, text);
      router.push("/viewer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load.";
      setUrlStatus(message);
      setDownloadState({ active: false, loaded: 0, total: 0 });
      return;
    } finally {
      setDownloadState((prev) => ({ ...prev, active: false }));
    }
  };

  const handleFileUpload = (event) => {
    setFileStatus("");
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      sessionStorage.setItem(PENDING_LOG_KEY, result);
      router.push("/viewer");
    };
    reader.onerror = () => {
      setFileStatus("Unable to read file.");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">LogHighlighter</p>
          <h1>Make noisy logs readable in seconds.</h1>
          <p className="subtitle">
            Load logs by URL or file, highlight with regex rules, and keep your setup saved in the
            browser.
          </p>
        </div>
        <div className="hero-card">
          <div className="chip">No backend</div>
          <div className="chip">Local persistence</div>
          <div className="chip">Regex-driven</div>
        </div>
      </header>

      <section className="panel landing-panel">
        <h2>Log Input</h2>
        <label className="field">
          <span>Log download URL</span>
          <div className="row">
            <input
              type="url"
              placeholder="https://example.com/logs.txt"
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
              aria-label="Log download URL"
            />
            <button className="primary-button" onClick={handleRenderFromUrl} type="button">
              Render
            </button>
          </div>
          <small className="status">{urlStatus}</small>
          {downloadState.active ? (
            <div className="progress-wrap" aria-live="polite">
              <progress
                className="progress-bar"
                value={downloadState.total ? downloadState.loaded : undefined}
                max={downloadState.total || undefined}
              />
              <span className="progress-label">
                {formatProgress(downloadState.loaded, downloadState.total)}
              </span>
            </div>
          ) : null}
        </label>

        <label className="field">
          <span>Upload log</span>
          <input
            className="file-input"
            type="file"
            accept=".log,.txt,text/plain"
            onChange={handleFileUpload}
          />
          <small className="status">{fileStatus}</small>
        </label>
      </section>

      <footer className="footer">
        <span>Made by</span>
        <a href="https://github.com/hawkingrei" target="_blank" rel="noreferrer">
          hawkingrei
        </a>
      </footer>
    </div>
  );
}

async function readErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    if (payload?.error) return payload.error;
  }
  return `Unable to load (${response.status}).`;
}

function formatProgress(loaded, total) {
  const loadedText = formatBytes(loaded);
  if (!total) return `${loadedText} downloaded`;
  const percent = Math.min(100, Math.round((loaded / total) * 100));
  return `${loadedText} / ${formatBytes(total)} (${percent}%)`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
}
