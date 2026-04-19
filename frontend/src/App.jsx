import { useState, useEffect } from "react";

const API = "http://localhost:8000";

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

function truncate(str, n = 42) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);
  const [latest, setLatest] = useState(null);

  const fetchLinks = async () => {
    try {
      const res = await fetch(`${API}/urls`);
      const data = await res.json();
      setLinks(data);
    } catch {}
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleShorten = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setLatest(null);
    try {
      const res = await fetch(`${API}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), custom_code: customCode.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      setLatest(data);
      setUrl("");
      setCustomCode("");
      fetchLinks();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (code) => {
    await fetch(`${API}/urls/${code}`, { method: "DELETE" });
    fetchLinks();
  };

  const handleCopy = (text, id) => {
    copyToClipboard(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="root">
      <div className="noise" />

      <header>
        <div className="logo">
          <span className="logo-icon">⌁</span>
          <span className="logo-text">snip<span className="accent">.</span>ly</span>
        </div>
        <p className="tagline">Shorten. Share. Track.</p>
      </header>

      <main>
        <section className="card shorten-card">
          <h2 className="card-title">New Short Link</h2>
          <div className="input-group">
            <label>Long URL</label>
            <input
              type="url"
              placeholder="https://your-very-long-url.com/that/nobody/wants/to-type"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleShorten()}
            />
          </div>
          <div className="input-group">
            <label>Custom alias <span className="optional">(optional)</span></label>
            <div className="alias-wrap">
              <span className="alias-prefix">snip.ly/</span>
              <input
                type="text"
                placeholder="my-link"
                value={customCode}
                onChange={e => setCustomCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleShorten()}
                className="alias-input"
              />
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <button className="btn-shorten" onClick={handleShorten} disabled={loading}>
            {loading ? <span className="spinner" /> : "Shorten →"}
          </button>

          {latest && (
            <div className="result-box">
              <span className="result-url">{latest.short_url}</span>
              <button
                className={`btn-copy ${copied === "latest" ? "copied" : ""}`}
                onClick={() => handleCopy(latest.short_url, "latest")}
              >
                {copied === "latest" ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          )}
        </section>

        {links.length > 0 && (
          <section className="card links-card">
            <h2 className="card-title">Recent Links</h2>
            <div className="links-list">
              {links.map((link) => (
                <div className="link-row" key={link.short_code}>
                  <div className="link-info">
                    <a
                      className="link-short"
                      href={link.short_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.short_url}
                    </a>
                    <span className="link-original" title={link.original_url}>
                      {truncate(link.original_url)}
                    </span>
                  </div>
                  <div className="link-meta">
                    <span className="clicks">
                      <span className="clicks-num">{link.clicks}</span>
                      <span className="clicks-label">clicks</span>
                    </span>
                    <button
                      className={`btn-icon btn-copy-sm ${copied === link.short_code ? "copied" : ""}`}
                      onClick={() => handleCopy(link.short_url, link.short_code)}
                      title="Copy"
                    >
                      {copied === link.short_code ? "✓" : "⎘"}
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => handleDelete(link.short_code)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}