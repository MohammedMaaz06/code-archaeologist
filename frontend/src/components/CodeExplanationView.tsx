"use client";

import React, { useState } from "react";
import { ArrowUpRight, FileCode2, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui";
import { api, type ExplanationResponse } from "@/lib/api";

const questions = [
  { label: "Understand a symbol", value: "What does [symbol name] do?" },
  { label: "Trace a request", value: "How does [request or action] flow through the code?" },
  { label: "Find implementation", value: "Where is [behavior] implemented?" },
];

function renderCitedAnswer(answer: string) {
  return answer.split(/(\[[^\]]+:\d+(?:-\d+)?\])/g).map((part, index) =>
    /^\[[^\]]+:\d+(?:-\d+)?\]$/.test(part) ? (
      <span key={index} className="explanation-citation">{part}</span>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );
}

export default function CodeExplanationView({
  repositoryPath,
  repositoryName,
}: {
  repositoryPath?: string;
  repositoryName?: string;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ExplanationResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const explainCode = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const prompt = query.trim();

    if (!prompt) {
      setError("Ask a specific question about a symbol, file, or behavior.");
      setResult(null);
      return;
    }
    if (!repositoryPath) {
      setError("Scan a repository before asking for an explanation.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.explain(prompt, 3, repositoryPath);
      if (!response.explanation?.trim()) {
        setError("No explanation came back. Try again or check the backend logs.");
      } else {
        setResult(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not explain this code.");
    } finally {
      setLoading(false);
    }
  };

  const sources = result?.raw_context?.matched_chunks
    ? [...new Map(
        result.raw_context.matched_chunks.map((source) => [
          `${source.file_path}:${source.lines}`,
          source,
        ])
      ).values()]
    : [];

  return (
    <div className="explanation-workspace dashboard-view-enter">
      <Panel
        title="Ask about the code"
        subtitle={
          repositoryName
            ? `Answers about ${repositoryName}, grounded in its indexed source.`
            : "Scan and index a repository to get answers grounded in its source."
        }
      >
        <form onSubmit={explainCode} className="explanation-form">
          <label htmlFor="code-explanation-question" className="explanation-label">
            One clear question works best
          </label>
          <div className="explanation-input-wrap">
            <MessageSquareText className="explanation-input-icon h-4 w-4" aria-hidden="true" />
            <textarea
              id="code-explanation-question"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (error) setError("");
              }}
              placeholder="For example: What calls resolve_repository_path, and what does it return?"
              rows={3}
              maxLength={500}
              className="explanation-input"
            />
            <span className="explanation-character-count">{query.length}/500</span>
          </div>

          <div className="explanation-question-row">
            <span className="explanation-hint">Try asking</span>
            {questions.map((question) => (
              <button
                key={question.label}
                type="button"
                onClick={() => {
                  setQuery(question.value);
                  setError("");
                }}
                className="explanation-question-chip"
              >
                {question.label}
              </button>
            ))}
            <span className="explanation-hint explanation-question-note">
              Replace the bracketed text with a name or behavior.
            </span>
          </div>

          <div className="explanation-submit-row">
            <p className="explanation-promise">
              <Sparkles className="h-3.5 w-3.5" />
              Concise answers. No guessing beyond the indexed code.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="explanation-submit"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              {loading ? "Reading the code…" : "Get an explanation"}
            </button>
          </div>
        </form>
      </Panel>

      {error && (
        <div role="alert" className="explanation-error">
          {error}
        </div>
      )}

      {result && (
        <Panel
          className="explanation-result"
          title="Explanation"
          subtitle={result.query || query.trim()}
          actions={
            sources.length > 0 ? (
              <span className="explanation-source-count">
                {sources.length} {sources.length === 1 ? "source" : "sources"}
              </span>
            ) : undefined
          }
        >
          <div className="explanation-answer">
            {renderCitedAnswer(result.explanation)}
          </div>
          {sources.length > 0 && (
            <div className="explanation-sources">
              <p className="explanation-sources-title">From the repository</p>
              <div className="explanation-source-list">
                {sources.map((source) => (
                  <div
                    key={`${source.file_path}:${source.lines}`}
                    className="explanation-source"
                  >
                    <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="explanation-source-path" title={source.file_path}>
                      {source.file_path}
                    </span>
                    <span className="explanation-source-lines">lines {source.lines}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
