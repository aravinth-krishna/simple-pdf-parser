"use client";

import { useState } from "react";
import styles from "./page.module.css";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import Groq from "groq-sdk";

export default function Home() {
  const [pdfText, setPdfText] = useState("");
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const groq = new Groq({
    apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus("Processing...");
    setPdfText("");

    try {
      const text = await extractTextFromPDF(file);
      setPdfText(text || "No text found in PDF");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      console.error("Extraction error:", error);
    }
  };

  const extractTextFromPDF = async (file: File) => {
    // Dynamically import only when needed
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text +=
        content.items
          .filter((item): item is TextItem => "str" in item)
          .map((item) => item.str)
          .join(" ") + "\n";
    }
    return text;
  };

  const generateSummary = async () => {
    if (!pdfText) return;

    setIsSummarizing(true);
    setSummaryError("");

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a PDF summarization expert. Provide a clear, concise summary of this document. Keep it under 150 words.",
          },
          {
            role: "user",
            content: `Summarize this PDF content: ${pdfText.substring(
              0,
              3000
            )}`, // Limit input size
          },
        ],
        model: "llama3-70b-8192",
      });

      setSummary(
        chatCompletion.choices[0]?.message?.content || "No summary generated"
      );
    } catch (error) {
      console.error("Summary error:", error);
      setSummaryError("Failed to generate summary. Please try again.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>PDF Text Extractor</h1>
        <p className={styles.subtitle}>Extract text from any PDF document</p>
      </header>

      <div className={styles.uploadSection}>
        <label className={styles.uploadLabel}>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className={styles.uploadInput}
          />
          <div className={styles.uploadBox}>
            <svg className={styles.uploadIcon} viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
            <p className={styles.uploadText}>
              {fileName || "Choose PDF file or drag here"}
            </p>
            <span className={styles.uploadButton}>Browse Files</span>
          </div>
        </label>

        {status === "Processing..." && (
          <div className={styles.processing}>
            <div className={styles.spinner}></div>
            <p>Processing PDF...</p>
          </div>
        )}

        {status === "success" && (
          <div className={styles.successMessage}>
            <svg viewBox="0 0 24 24" className={styles.successIcon}>
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            Text extracted successfully!
          </div>
        )}

        {status === "error" && (
          <div className={styles.errorMessage}>
            <svg viewBox="0 0 24 24" className={styles.errorIcon}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            Error processing PDF. Please try again.
          </div>
        )}
      </div>

      {pdfText && (
        <div className={styles.resultSection}>
          <div className={styles.resultHeader}>
            <h2>Extracted Text</h2>
            <div className={styles.buttonGroup}>
              <button
                onClick={() => navigator.clipboard.writeText(pdfText)}
                className={styles.copyButton}
              >
                Copy
              </button>
              <button
                onClick={generateSummary}
                className={styles.summaryButton}
                disabled={isSummarizing}
              >
                {isSummarizing ? "Summarizing..." : "Generate Summary"}
              </button>
            </div>
          </div>
          <pre className={styles.textOutput}>{pdfText}</pre>

          {isSummarizing && (
            <div className={styles.processing}>
              <div className={styles.spinner}></div>
              <p>Generating summary...</p>
            </div>
          )}

          {summaryError && (
            <div className={styles.errorMessage}>
              <svg viewBox="0 0 24 24" className={styles.errorIcon}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {summaryError}
            </div>
          )}

          {summary && (
            <div className={styles.summarySection}>
              <div className={styles.resultHeader}>
                <h2>AI Summary</h2>
                <button
                  onClick={() => navigator.clipboard.writeText(summary)}
                  className={styles.copyButton}
                >
                  Copy
                </button>
              </div>
              <div className={styles.summaryText}>{summary}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
