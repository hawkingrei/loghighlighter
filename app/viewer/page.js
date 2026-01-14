"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_RULES = [
  {
    id: "level-error",
    name: "Error Level",
    pattern: "\\b(ERROR|FATAL|CRITICAL)\\b",
    flags: "gi",
    color: "#ef6b6b",
    enabled: true,
    note: "Severity highlight",
  },
  {
    id: "level-warn",
    name: "Warning Level",
    pattern: "\\b(WARN|WARNING)\\b",
    flags: "gi",
    color: "#f0a202",
    enabled: true,
    note: "Warnings",
  },
  {
    id: "data-race",
    name: "DATA RACE",
    pattern: "DATA RACE",
    flags: "g",
    color: "#f77f00",
    enabled: true,
    note: "Go data race detector",
  },
  {
    id: "fail-token",
    name: "FAIL or Failure",
    pattern: "FAIL(?:URE)?\\b",
    flags: "g-i",
    color: "#f7a072",
    enabled: true,
    note: "Failure markers",
  },
  {
    id: "error-prefix",
    name: "Error (standalone or [ERROR])",
    pattern: "(?:(?<![\\w/])Error(?![\\w/])|\\[ERROR\\])",
    flags: "g-i",
    color: "#ff4d4f",
    enabled: true,
    note: "Standalone Error or bracketed ERROR",
  },
  {
    id: "error-with-space",
    name: "[error=]",
    pattern: "\\[error=",
    flags: "g-i",
    color: "#8f6b5e",
    enabled: true,
    note: "Bracketed lowercase error",
  },
  {
    id: "fatal-error",
    name: "fatal error",
    pattern: "fatal error",
    flags: "gi",
    color: "#d62828",
    enabled: true,
    note: "Fatal errors",
  },
  {
    id: "panic-nil",
    name: "panic: nil pointer",
    pattern: "panic: runtime error: invalid memory address or nil pointer dereference",
    flags: "g",
    color: "#d62828",
    enabled: true,
    note: "Go panic",
  },
  {
    id: "test-timeout",
    name: "Test timed out",
    pattern: "-- Test timed out",
    flags: "g-i",
    color: "#ffd166",
    enabled: true,
    note: "Test timeout",
  },
  {
    id: "separator",
    name: "========",
    pattern: "========",
    flags: "g",
    color: "#e9c46a",
    enabled: true,
    note: "Separator",
  },
  {
    id: "index-range",
    name: "index out of range",
    pattern: "index out of range",
    flags: "gi",
    color: "#d62828",
    enabled: true,
    note: "Index errors",
  },
  {
    id: "core-dumped",
    name: "core dumped",
    pattern: "core dumped",
    flags: "gi",
    color: "#d62828",
    enabled: true,
    note: "Core dumps",
  },
  {
    id: "should-not-happened",
    name: "should not happened",
    pattern: "should not happened",
    flags: "gi",
    color: "#f77f00",
    enabled: true,
    note: "Unexpected state",
  },
  {
    id: "potential-deadlock",
    name: "POTENTIAL DEADLOCK",
    pattern: "POTENTIAL DEADLOCK",
    flags: "g",
    color: "#f77f00",
    enabled: true,
    note: "Deadlock warning",
  },
  {
    id: "nogo-errors",
    name: "nogo errors",
    pattern: "errors found by nogo during build-time code analysis:",
    flags: "gi",
    color: "#f77f00",
    enabled: true,
    note: "Static analysis errors",
  },
  {
    id: "assert-failed",
    name: "assert failed",
    pattern: "assert failed",
    flags: "gi",
    color: "#d62828",
    enabled: true,
    note: "Assertion failures",
  },
  {
    id: "goleak",
    name: "goleak",
    pattern: "goleak",
    flags: "gi",
    color: "#f77f00",
    enabled: true,
    note: "Goroutine leaks",
  },
  {
    id: "race-detected",
    name: "race detected",
    pattern: "race detected",
    flags: "gi",
    color: "#f77f00",
    enabled: true,
    note: "Race detector output",
  },
];

const DEFAULT_RULE_MAP = DEFAULT_RULES.reduce((acc, rule) => {
  acc[rule.id] = rule;
  return acc;
}, {});

const STORAGE_KEY = "loghighlighter.rules.v1";
const PENDING_LOG_KEY = "loghighlighter.pendingLog.v1";
const COLLAPSE_MAX_LINES = 14;
const COLLAPSE_MAX_CHARS = 1200;
const PREVIEW_LINES = 2;
const PREVIEW_CHARS = 160;

export default function Home() {
  const previewRef = useRef(null);
  const [logText, setLogText] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [urlStatus, setUrlStatus] = useState("");
  const [wrapLines, setWrapLines] = useState(true);
  const [globalFlags, setGlobalFlags] = useState("gi");
  const [useAdvancedFlags, setUseAdvancedFlags] = useState(true);
  const [lineTextColor, setLineTextColor] = useState("#BE6DAB");
  const [showSettings, setShowSettings] = useState(false);
  const [flagEditorId, setFlagEditorId] = useState("");
  const [overrides, setOverrides] = useState({});
  const [customRules, setCustomRules] = useState([]);

  useEffect(() => {
    const stored = loadStored();
    setOverrides(stored.overrides);
    setCustomRules(stored.custom);
    setGlobalFlags(stored.settings.globalFlags);
    setUseAdvancedFlags(true);
    setLineTextColor(stored.settings.lineTextColor);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = sessionStorage.getItem(PENDING_LOG_KEY);
    if (pending) {
      setLogText(pending);
      sessionStorage.removeItem(PENDING_LOG_KEY);
    }
  }, []);

  useEffect(() => {
    storeState({
      overrides,
      custom: customRules,
      settings: { globalFlags, useAdvancedFlags, lineTextColor },
    });
  }, [overrides, customRules, globalFlags, useAdvancedFlags, lineTextColor]);

  useEffect(() => {
    if (!useAdvancedFlags) setFlagEditorId("");
  }, [useAdvancedFlags]);

  const rules = useMemo(() => {
    const mergedDefaults = DEFAULT_RULES.map((rule, index) => ({
      ...rule,
      ...(overrides[rule.id] || {}),
      order: index,
      source: "default",
    }));

    const custom = customRules.map((rule, index) => ({
      ...rule,
      order: DEFAULT_RULES.length + index,
      source: "custom",
    }));

    return [...mergedDefaults, ...custom];
  }, [overrides, customRules]);

  const flagEditorRule = useMemo(() => {
    return rules.find((rule) => rule.id === flagEditorId) || null;
  }, [rules, flagEditorId]);

  const highlightedHtml = useMemo(() => {
    return buildHighlightedHtml(logText, rules, globalFlags, useAdvancedFlags, lineTextColor);
  }, [logText, rules, globalFlags, useAdvancedFlags, lineTextColor]);

  const handleLogChange = (event) => {
    setLogText(event.target.value);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setLogText(result);
    };
    reader.onerror = () => {
      setUrlStatus("Unable to read file.");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleRuleUpdate = (ruleId, source, partial) => {
    if (source === "default") {
      setOverrides((prev) => {
        const base = DEFAULT_RULE_MAP[ruleId];
        const nextRule = { ...base, ...(prev[ruleId] || {}), ...partial };
        return { ...prev, [ruleId]: nextRule };
      });
      return;
    }

    setCustomRules((prev) => {
      return prev.map((rule) => (rule.id === ruleId ? { ...rule, ...partial } : rule));
    });
  };

  const handleRemoveRule = (rule) => {
    if (rule.source === "default") {
      setOverrides((prev) => {
        const base = DEFAULT_RULE_MAP[rule.id];
        return { ...prev, [rule.id]: { ...base, ...prev[rule.id], enabled: false } };
      });
      return;
    }

    if (rule.source === "custom-remove") {
      setCustomRules((prev) => {
        return prev.filter((item) => item.id !== rule.id);
      });
      return;
    }

    setCustomRules((prev) => {
      return prev.map((item) =>
        item.id === rule.id ? { ...item, enabled: !item.enabled } : item
      );
    });
  };

  const handleAddRule = () => {
    const rule = {
      id: `custom-${crypto.randomUUID()}`,
      name: "Custom Rule",
      pattern: "",
      flags: "g",
      color: "#9ad1d4",
      enabled: true,
      note: "",
    };

    setCustomRules((prev) => {
      return [...prev, rule];
    });
  };

  const handleResetDefaults = () => {
    setOverrides({});
  };

  const handleLoadUrl = async () => {
    setUrlStatus("");
    const url = urlValue.trim();

    if (!url) {
      setUrlStatus("Please enter a URL.");
      return;
    }

    setUrlStatus("Loading...");

    try {
      const response = await fetch(`/api/fetch-log?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message);
      }
      const text = await response.text();
      setLogText(text);
      setUrlStatus(`Loaded ${text.length.toLocaleString()} chars.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load.";
      setUrlStatus(message);
    }
  };

  const handleCopy = async () => {
    const content = previewRef.current?.innerText || "";

    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      const temp = document.createElement("textarea");
      temp.value = content;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "logs.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <main className="layout">
        <section className="panel input-panel">
          <h2>Log Input</h2>
          <label className="field">
            <span>Log download URL</span>
            <div className="row">
              <input
                type="url"
                value={urlValue}
                onChange={(event) => setUrlValue(event.target.value)}
                placeholder="https://example.com/logs.txt"
              />
              <button className="primary" onClick={handleLoadUrl}>
                Load
              </button>
            </div>
            <small className="status">{urlStatus}</small>
          </label>

          <label className="field">
            <span>Upload log</span>
            <input
              className="file-input"
              type="file"
              accept=".log,.txt,text/plain"
              onChange={handleFileUpload}
            />
          </label>

          <div className="row gap">
            <button className="ghost" onClick={() => setLogText("")}>
              Clear
            </button>
            <button className="ghost" onClick={handleCopy}>
              Copy Highlighted
            </button>
            <button className="ghost" onClick={handleDownload}>
              Download
            </button>
          </div>
        </section>

        <section className="panel preview">
          <div className="row space">
            <h2>Preview</h2>
            <div className="row gap">
              <button className="ghost" onClick={() => setShowSettings(true)}>
                Settings
              </button>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={wrapLines}
                  onChange={(event) => setWrapLines(event.target.checked)}
                />
                <span>Wrap lines</span>
              </label>
            </div>
          </div>
          <div
            ref={previewRef}
            className={`preview-window ${wrapLines ? "" : "nowrap"}`}
            dangerouslySetInnerHTML={{
              __html: highlightedHtml || "<em>No log content yet.</em>",
            }}
          />
        </section>
      </main>
      <footer className="footer">
        <span>Made by</span>
        <a href="https://github.com/hawkingrei" target="_blank" rel="noreferrer">
          hawkingrei
        </a>
      </footer>
      {showSettings && (
        <div className="settings-overlay" role="dialog" aria-modal="true">
          <div className="panel settings-panel">
            <div className="row space">
              <h2>Highlight Rules</h2>
              <div className="row gap">
                <button className="primary" onClick={handleAddRule}>
                  Add Rule
                </button>
                <button className="ghost" onClick={handleResetDefaults}>
                  Reset Defaults
                </button>
              </div>
            </div>
            <div className="settings-section">
              <h3>Global flags</h3>
              <div className="flag-grid">
                {buildFlagOptions(globalFlags).map((flag) => (
                  <label className="flag-item" key={flag.key}>
                    <input
                      type="checkbox"
                      checked={flag.checked}
                      disabled={flag.locked}
                      onChange={() => setGlobalFlags(toggleFlag(globalFlags, flag.key))}
                    />
                    <span>{flag.label}</span>
                  </label>
                ))}
              </div>
              <small className="status">g is always on for full highlighting.</small>
            </div>
            <div className="settings-section">
              <h3>Matched line text color</h3>
              <div className="row gap">
                <input
                  className="color-input"
                  type="color"
                  value={lineTextColor}
                  onChange={(event) => setLineTextColor(event.target.value)}
                />
                <span className="status">Applies to non-keyword text in matched lines.</span>
              </div>
            </div>
            <div className="rules-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pattern</th>
                    <th>
                      Flags <span className="flag-label">(per-rule overrides)</span>
                    </th>
                    <th>Color</th>
                    <th>Note</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => {
                    const error = getRuleError(rule, globalFlags, useAdvancedFlags);
                    return (
                      <tr key={rule.id}>
                        <td>
                          <input
                            className="rule-cell"
                            type="text"
                            value={rule.name}
                            onChange={(event) =>
                              handleRuleUpdate(rule.id, rule.source, {
                                name: event.target.value || "Untitled Rule",
                              })
                            }
                            placeholder="Rule name"
                          />
                        </td>
                        <td>
                          <input
                            className="rule-cell"
                            type="text"
                            value={rule.pattern}
                            onChange={(event) =>
                              handleRuleUpdate(rule.id, rule.source, { pattern: event.target.value })
                            }
                            placeholder="Regex pattern"
                          />
                          {error ? <span className="rule-error">{error}</span> : null}
                        </td>
                        <td>
                          <button
                            className="flag-cell"
                            type="button"
                            onClick={() => {
                              if (useAdvancedFlags) setFlagEditorId(rule.id);
                            }}
                            disabled={!useAdvancedFlags}
                          >
                            {describeRuleFlags(rule.flags, useAdvancedFlags)}
                          </button>
                        </td>
                        <td>
                          <input
                            className="rule-color"
                            type="color"
                            value={rule.color}
                            onChange={(event) =>
                              handleRuleUpdate(rule.id, rule.source, { color: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="rule-cell"
                            type="text"
                            value={rule.note || ""}
                            onChange={(event) =>
                              handleRuleUpdate(rule.id, rule.source, { note: event.target.value })
                            }
                            placeholder="Optional note"
                          />
                        </td>
                        <td>
                          {rule.source === "default" ? (
                            <button className="ghost" onClick={() => handleRemoveRule(rule)}>
                              Disable
                            </button>
                          ) : (
                            <div className="row gap action-buttons">
                              <button className="ghost" onClick={() => handleRemoveRule(rule)}>
                                {rule.enabled ? "Disable" : "Enable"}
                              </button>
                              <button
                                className="ghost"
                                onClick={() => handleRemoveRule({ ...rule, source: "custom-remove" })}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flag-legend">
              Flags legend: g = match all, i = ignore case, m = multiline, s = dot matches newline,
              u = unicode, y = sticky. Use -i or !i to remove global ignore-case for a rule.
            </div>

            <div className="hint">
              <strong>Tip:</strong> Rules apply in order and skip overlapping matches.
            </div>
            <div className="settings-actions">
              <button className="primary" onClick={() => setShowSettings(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {flagEditorRule ? (
        <div className="flag-editor-overlay" role="dialog" aria-modal="true">
          <div className="flag-editor">
            <div className="row space">
              <h3>Flags for {flagEditorRule.name}</h3>
              <button className="ghost" onClick={() => setFlagEditorId("")}>
                Close
              </button>
            </div>
            <div className="flag-grid compact">
              {buildRuleFlagOptions(flagEditorRule.flags, globalFlags).map((flag) => (
                <label className="flag-item" key={flag.key}>
                  <input
                    type="checkbox"
                    checked={flag.checked}
                    disabled={flag.locked}
                    onChange={(event) =>
                      handleRuleUpdate(flagEditorRule.id, flagEditorRule.source, {
                        flags: updateRuleFlags(
                          flagEditorRule.flags,
                          globalFlags,
                          flag.key,
                          event.target.checked
                        ),
                      })
                    }
                  />
                  <span>{flag.label}</span>
                </label>
              ))}
            </div>
            <div className="flag-editor-actions">
              <button
                className="ghost"
                onClick={() =>
                  handleRuleUpdate(flagEditorRule.id, flagEditorRule.source, { flags: "" })
                }
              >
                Use global flags
              </button>
            </div>
            <small className="status">g is always on. Uncheck i to enforce case-sensitive.</small>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function loadStored() {
  if (typeof window === "undefined") {
    return {
      overrides: {},
      custom: [],
      settings: { globalFlags: "gi", useAdvancedFlags: true, lineTextColor: "#BE6DAB" },
    };
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      overrides: parsed?.overrides ?? {},
      custom: parsed?.custom ?? [],
      settings: {
        globalFlags: parsed?.settings?.globalFlags ?? "gi",
        useAdvancedFlags: parsed?.settings?.useAdvancedFlags ?? true,
        lineTextColor: parsed?.settings?.lineTextColor ?? "#BE6DAB",
      },
    };
  } catch (error) {
    return {
      overrides: {},
      custom: [],
      settings: { globalFlags: "gi", useAdvancedFlags: true, lineTextColor: "#BE6DAB" },
    };
  }
}

function storeState(state) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getRuleError(rule, globalFlags, useAdvancedFlags) {
  if (!rule.pattern) return "Pattern required.";

  try {
    const flags = getEffectiveFlags(rule, globalFlags, useAdvancedFlags);
    new RegExp(rule.pattern, flags);
    return "";
  } catch (error) {
    return "Invalid regex.";
  }
}

function getEffectiveFlags(rule, globalFlags, useAdvancedFlags) {
  const ruleFlags = rule.flags || "";
  const removeInsensitive = ruleFlags.includes("-i") || ruleFlags.includes("!i");
  const cleaned = ruleFlags.replaceAll("-i", "").replaceAll("!i", "");
  const merged = mergeFlags(globalFlags, useAdvancedFlags ? cleaned : "");
  return removeInsensitive ? merged.replaceAll("i", "") : merged;
}

function mergeFlags(flags, extra) {
  const merged = new Set((flags + extra + "g").split(""));
  return [...merged].join("");
}

function toggleFlag(current, key) {
  if (key === "g") return current;
  if (current.includes(key)) {
    return current.replaceAll(key, "");
  }
  return `${current}${key}`;
}

const FLAG_LABELS = {
  g: "Match all occurrences",
  i: "Ignore case",
  m: "Multiline anchors",
  s: "Dot matches newline",
  u: "Unicode mode",
  y: "Sticky matching",
};

const FLAG_ORDER = ["g", "i", "m", "s", "u", "y"];

function buildFlagOptions(globalFlags) {
  return FLAG_ORDER.map((key) => ({
    key,
    label: FLAG_LABELS[key],
    locked: key === "g",
    checked: key === "g" ? true : globalFlags.includes(key),
  }));
}

function parseRuleFlags(flags) {
  const value = flags || "";
  const removeInsensitive = value.includes("-i") || value.includes("!i");
  const cleaned = value.replaceAll("-i", "").replaceAll("!i", "");
  const addFlags = new Set(cleaned.split("").filter((key) => FLAG_ORDER.includes(key)));
  return { addFlags, removeInsensitive };
}

function buildRuleFlagOptions(ruleFlags, globalFlags) {
  const globalSet = new Set(globalFlags.split(""));
  const { addFlags, removeInsensitive } = parseRuleFlags(ruleFlags);

  return FLAG_ORDER.map((key) => {
    if (key === "g") {
      return { key, label: FLAG_LABELS[key], locked: true, checked: true };
    }

    if (key === "i") {
      const checked = !removeInsensitive && (addFlags.has("i") || globalSet.has("i"));
      return { key, label: FLAG_LABELS[key], locked: false, checked };
    }

    const checked = addFlags.has(key) || globalSet.has(key);
    const locked = globalSet.has(key);
    return { key, label: FLAG_LABELS[key], locked, checked };
  });
}

function updateRuleFlags(ruleFlags, globalFlags, key, checked) {
  const globalSet = new Set(globalFlags.split(""));
  const { addFlags, removeInsensitive } = parseRuleFlags(ruleFlags);
  const nextAdds = new Set(addFlags);
  let nextRemoveInsensitive = removeInsensitive;

  if (key === "i") {
    if (checked) {
      nextRemoveInsensitive = false;
      if (!globalSet.has("i")) {
        nextAdds.add("i");
      } else {
        nextAdds.delete("i");
      }
    } else {
      nextRemoveInsensitive = true;
      nextAdds.delete("i");
    }
  } else if (key !== "g") {
    if (checked) {
      nextAdds.add(key);
    } else {
      nextAdds.delete(key);
    }
  }

  const ordered = FLAG_ORDER.filter((flag) => nextAdds.has(flag));
  const suffix = nextRemoveInsensitive ? "-i" : "";
  return `${ordered.join("")}${suffix}`;
}

function describeRuleFlags(ruleFlags, useAdvancedFlags) {
  if (!useAdvancedFlags) return "Follow global flags (enable Advanced to override)";
  if (!ruleFlags) return "Follow global flags";
  return `Custom: ${ruleFlags}`;
}

function buildHighlightedHtml(text, rules, globalFlags, useAdvancedFlags, lineTextColor) {
  if (!text) return "";

  const { plain, map } = stripAnsi(text);
  const lines = buildLines(plain, map);
  const matches = [];

  rules.forEach((rule) => {
    if (!rule.enabled || !rule.pattern) return;

    try {
      const flags = getEffectiveFlags(rule, globalFlags, useAdvancedFlags);
      const regex = new RegExp(rule.pattern, flags);
      let match;

      while ((match = regex.exec(plain)) !== null) {
        if (match[0] === "") {
          regex.lastIndex += 1;
          continue;
        }

        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          rule,
        });
      }
    } catch (error) {
      // Invalid rules are surfaced via inline validation.
    }
  });

  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return a.rule.order - b.rule.order;
  });

  const filtered = [];
  let cursor = 0;

  // Skip overlapping matches to keep a clean highlight layer.
  for (const match of matches) {
    if (match.start >= cursor) {
      filtered.push(match);
      cursor = match.end;
    }
  }

  const lineMatches = lines.map(() => []);
  const lineHasMatch = lines.map(() => false);

  for (const match of filtered) {
    addMatchToLines(match, lines, lineMatches, lineHasMatch);
  }

  let output = "";
  let index = 0;

  while (index < lines.length) {
    if (lineHasMatch[index]) {
      const line = lines[index];
      output += renderLineWithHighlights(
        text,
        plain,
        map,
        line,
        lineMatches[index],
        lineTextColor
      );
      index += 1;
      continue;
    }

    const groupStart = index;
    while (index < lines.length && !lineHasMatch[index]) {
      index += 1;
    }
    const groupLines = lines.slice(groupStart, index);
    const plainSegment = groupLines
      .map((line) => plain.slice(line.start, line.endWithNewline))
      .join("");
    const rawSegment = groupLines
      .map((line) => text.slice(line.rawStart, line.rawEndWithNewline))
      .join("");
    output += renderPlainSegment(rawSegment, plainSegment);
  }

  return output;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPlainSegment(rawSegment, plainSegment) {
  if (!plainSegment) return "";
  if (!shouldCollapse(plainSegment)) return renderAnsi(rawSegment);

  const lineCount = countLines(plainSegment);
  const summaryText =
    lineCount > 1
      ? `Hidden ${lineCount} lines (click to expand)`
      : "Hidden long line (click to expand)";
  const snippet = buildSnippet(plainSegment);

  return `<details class="fold-block"><summary>${escapeHtml(
    summaryText
  )}<span class="fold-snippet">${escapeHtml(
    snippet
  )}</span></summary><div class="fold-full">${renderAnsi(rawSegment)}</div></details>`;
}

function shouldCollapse(segment) {
  return segment.length > COLLAPSE_MAX_CHARS || countLines(segment) > COLLAPSE_MAX_LINES;
}

function countLines(text) {
  if (!text) return 0;
  return text.split("\n").length;
}

function buildSnippet(segment) {
  const lines = segment.split("\n");
  if (lines.length <= 1) {
    const line = lines[0] || "";
    if (line.length <= PREVIEW_CHARS * 2 + 20) return line;
    return `${line.slice(0, PREVIEW_CHARS)}\n...\n${line.slice(-PREVIEW_CHARS)}`;
  }

  const head = lines.slice(0, PREVIEW_LINES).join("\n");
  const tail = lines.slice(-PREVIEW_LINES).join("\n");
  return `${head}\n...\n${tail}`;
}

function stripAnsi(text) {
  const map = [];
  let plain = "";
  let index = 0;

  while (index < text.length) {
    if (text[index] === "\u001b" && text[index + 1] === "[") {
      const end = text.indexOf("m", index);
      if (end === -1) break;
      index = end + 1;
      continue;
    }

    map.push(index);
    plain += text[index];
    index += 1;
  }

  while (index < text.length) {
    map.push(index);
    plain += text[index];
    index += 1;
  }

  map.push(text.length);
  return { plain, map };
}

function buildLines(plain, map) {
  const lines = [];
  let start = 0;

  for (let i = 0; i < plain.length; i += 1) {
    if (plain[i] === "\n") {
      const end = i;
      const endWithNewline = i + 1;
      lines.push({
        start,
        end,
        endWithNewline,
        rawStart: map[start],
        rawEnd: map[end],
        rawEndWithNewline: map[endWithNewline],
      });
      start = i + 1;
    }
  }

  const end = plain.length;
  lines.push({
    start,
    end,
    endWithNewline: end,
    rawStart: map[start],
    rawEnd: map[end],
    rawEndWithNewline: map[end],
  });

  return lines;
}

function addMatchToLines(match, lines, lineMatches, lineHasMatch) {
  let startLine = findLineIndex(lines, match.start);
  let endLine = findLineIndex(lines, Math.max(match.end - 1, match.start));

  for (let i = startLine; i <= endLine; i += 1) {
    const line = lines[i];
    const segStart = Math.max(match.start, line.start);
    const segEnd = Math.min(match.end, line.end);
    if (segStart >= segEnd) continue;
    lineHasMatch[i] = true;
    lineMatches[i].push({ start: segStart, end: segEnd, rule: match.rule });
  }
}

function findLineIndex(lines, index) {
  let low = 0;
  let high = lines.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const line = lines[mid];
    if (index < line.start) {
      high = mid - 1;
    } else if (index >= line.endWithNewline) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return Math.max(0, Math.min(lines.length - 1, low));
}

function renderLineWithHighlights(rawText, plainText, map, line, matches, lineTextColor) {
  const linePlain = plainText.slice(line.start, line.end);
  const lineRaw = rawText.slice(line.rawStart, line.rawEnd);
  const sorted = matches.slice().sort((a, b) => a.start - b.start);
  let output = "";
  let cursor = line.start;

  for (const match of sorted) {
    if (match.start > cursor) {
      const rawStart = map[cursor];
      const rawEnd = map[match.start];
      output += renderAnsi(rawText.slice(rawStart, rawEnd));
    }
    const rawStart = map[match.start];
    const rawEnd = map[match.end];
    output += `<span class="keyword-highlight" style="background:${match.rule.color}" title="${escapeHtml(
      match.rule.note || match.rule.name
    )}">${renderAnsi(rawText.slice(rawStart, rawEnd))}</span>`;
    cursor = match.end;
  }

  if (cursor < line.end) {
    const rawStart = map[cursor];
    const rawEnd = map[line.end];
    output += renderAnsi(rawText.slice(rawStart, rawEnd));
  }

  const colorStyle = lineTextColor ? ` style="color:${lineTextColor}"` : "";
  return `<div class="line-hit"${colorStyle}>${output || "&nbsp;"}</div>`;
}

function renderAnsi(segment) {
  const parts = [];
  let lastIndex = 0;
  const regex = /\u001b\[([0-9;]*)m/g;
  let match;
  let state = { color: null, background: null, bold: false };

  while ((match = regex.exec(segment)) !== null) {
    const chunk = segment.slice(lastIndex, match.index);
    if (chunk) {
      parts.push(wrapAnsiSpan(chunk, state));
    }
    state = applyAnsiState(state, match[1]);
    lastIndex = regex.lastIndex;
  }

  const tail = segment.slice(lastIndex);
  if (tail) {
    parts.push(wrapAnsiSpan(tail, state));
  }

  return parts.join("");
}

function wrapAnsiSpan(text, state) {
  const style = buildAnsiStyle(state);
  const escaped = escapeHtml(text);
  if (!style) return escaped;
  return `<span style="${style}">${escaped}</span>`;
}

function buildAnsiStyle(state) {
  const styles = [];
  if (state.color) styles.push(`color:${state.color}`);
  if (state.background) styles.push(`background:${state.background}`);
  if (state.bold) styles.push("font-weight:600");
  return styles.join(";");
}

function applyAnsiState(state, codeString) {
  if (!codeString) return { color: null, background: null, bold: false };
  const codes = codeString.split(";").map((item) => Number(item));
  const next = { ...state };

  for (const code of codes) {
    if (code === 0) {
      next.color = null;
      next.background = null;
      next.bold = false;
    } else if (code === 1) {
      next.bold = true;
    } else if (code >= 30 && code <= 37) {
      next.color = ansiPalette(code - 30, false);
    } else if (code >= 90 && code <= 97) {
      next.color = ansiPalette(code - 90, true);
    } else if (code >= 40 && code <= 47) {
      next.background = ansiPalette(code - 40, false);
    } else if (code >= 100 && code <= 107) {
      next.background = ansiPalette(code - 100, true);
    }
  }

  return next;
}

function ansiPalette(index, bright) {
  const base = bright
    ? ["#c7c7c7", "#ff6b6b", "#8ce99a", "#ffd43b", "#74c0fc", "#d0bfff", "#66d9e8", "#f8f9fa"]
    : ["#212529", "#c92a2a", "#2f9e44", "#e67700", "#1864ab", "#5f3dc4", "#0b7285", "#f1f3f5"];
  return base[index] || null;
}

async function readErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    if (payload?.error) return payload.error;
  }
  return `Unable to load (${response.status}).`;
}
