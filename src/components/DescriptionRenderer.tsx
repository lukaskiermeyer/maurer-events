"use client";

import ReactMarkdown from "react-markdown";
import sanitizeHtml from "sanitize-html";
import parse from "html-react-parser";

export default function DescriptionRenderer({ content }: { content: string }) {
  const value = content || "";
  const isHtml = /<[a-z][\s\S]*>/i.test(value);
  if (isHtml) {
    const safe = sanitizeHtml(value.replace(/\r\n|\r|\n/g, "<br>"), {
      allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a", "h2", "h3"],
      allowedAttributes: { a: ["href", "target", "rel"] },
    });
    return <div className="event-prose font-sans text-base-dark/80 max-w-none">{parse(safe)}</div>;
  }
  return (
    <div className="event-prose font-sans text-base-dark/80 max-w-none">
      <ReactMarkdown>{value}</ReactMarkdown>
    </div>
  );
}