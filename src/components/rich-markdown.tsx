import React from "react";

/**
 * Strips markdown symbols for clean display in excerpts and previews.
 */
export function stripMarkdown(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+/gm, "") // headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1") // italic
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/^[-*•]\s+/gm, "") // list items
    .replace(/^\d+\.\s+/gm, "") // ordered list items
    .replace(/---+|\*\*\*+/g, "") // dividers
    .replace(/\n+/g, " ") // newlines to single space
    .trim();
}

/**
 * Parses inline formatting: bold, italic, code, markdown links, and auto URLs.
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex tokenizing:
  // 1. Markdown link: [text](url)
  // 2. Bold: **text** or __text__
  // 3. Italic: *text* or _text_
  // 4. Inline code: `code`
  // 5. Raw URL: https?://...
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|https?:\/\/[^\s]+)/g;

  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Markdown link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <a
          key={idx}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#7A2E22] underline underline-offset-2 hover:text-[#9F2E22] font-semibold transition-colors"
        >
          {label}
        </a>
      );
    }

    // Bold: **text** or __text__
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-bold text-[#111111]">
          {inner}
        </strong>
      );
    }

    // Italic: *text* or _text_
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      const inner = part.slice(1, -1);
      return (
        <em key={idx} className="italic text-[#27272A]">
          {inner}
        </em>
      );
    }

    // Code: `text`
    if (part.startsWith("`") && part.endsWith("`")) {
      const inner = part.slice(1, -1);
      return (
        <code key={idx} className="bg-[#F4F4F5] px-1.5 py-0.5 rounded text-[11px] font-mono text-[#7A2E22] border border-[#E4E4E7]">
          {inner}
        </code>
      );
    }

    // Auto URL: https?://...
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#7A2E22] underline underline-offset-2 hover:text-[#9F2E22] break-all"
        >
          {part}
        </a>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

interface RichMarkdownProps {
  content?: string | null;
  className?: string;
}

/**
 * Renders full markdown text with rich typography adhering to Happy Place intranet standards.
 */
export function RichMarkdown({ content, className = "" }: RichMarkdownProps) {
  if (!content) return null;

  const rawLines = content.split("\n");
  const blocks: React.ReactNode[] = [];

  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  function flushList() {
    if (!currentList) return;
    const ListTag = currentList.type;
    const listKey = `list-${blocks.length}`;
    blocks.push(
      <ListTag
        key={listKey}
        className={
          currentList.type === "ul"
            ? "space-y-1.5 my-3 pl-5 list-disc marker:text-[#7A2E22] text-[#3F3F46] text-sm leading-relaxed"
            : "space-y-1.5 my-3 pl-5 list-decimal marker:font-bold marker:text-[#7A2E22] text-[#3F3F46] text-sm leading-relaxed"
        }
      >
        {currentList.items.map((item, i) => (
          <li key={i}>{parseInline(item)}</li>
        ))}
      </ListTag>
    );
    currentList = null;
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Empty lines flush active lists
    if (!trimmed) {
      flushList();
      continue;
    }

    // Horizontal Divider
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      flushList();
      blocks.push(<hr key={`hr-${i}`} className="my-6 border-t border-[#E5E7EB]" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith("#### ")) {
      flushList();
      blocks.push(
        <h4 key={`h4-${i}`} className="font-bold text-sm text-[#111111] mt-4 mb-2 tracking-wide">
          {parseInline(trimmed.replace(/^####\s+/, ""))}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push(
        <h3 key={`h3-${i}`} className="font-['Bodoni_Moda',Georgia,serif] font-bold text-base md:text-lg text-[#111111] mt-5 mb-2 leading-snug">
          {parseInline(trimmed.replace(/^###\s+/, ""))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push(
        <h2 key={`h2-${i}`} className="font-['Bodoni_Moda',Georgia,serif] font-bold text-lg md:text-xl text-[#111111] mt-6 mb-2.5 pb-1 border-b border-[#F4F4F5]">
          {parseInline(trimmed.replace(/^##\s+/, ""))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      blocks.push(
        <h1 key={`h1-${i}`} className="font-['Bodoni_Moda',Georgia,serif] font-bold text-xl md:text-2xl text-[#111111] mt-6 mb-3 pb-2 border-b border-[#E5E7EB]">
          {parseInline(trimmed.replace(/^#\s+/, ""))}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      flushList();
      const quoteText = trimmed.replace(/^>\s*/, "");
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-4 border-[#7A2E22] bg-[#FAF3F0] px-4 py-2.5 my-3 italic text-xs md:text-sm text-[#4A4A4A] rounded-r"
        >
          {parseInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    // Unordered list item (- item, * item, • item)
    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, "");
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Ordered list item (1. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, "");
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Standard paragraph
    flushList();
    blocks.push(
      <p key={`p-${i}`} className="text-sm text-[#3F3F46] leading-relaxed my-2">
        {parseInline(trimmed)}
      </p>
    );
  }

  // Flush any remaining list
  flushList();

  return <div className={`rich-markdown space-y-1 ${className}`}>{blocks}</div>;
}
