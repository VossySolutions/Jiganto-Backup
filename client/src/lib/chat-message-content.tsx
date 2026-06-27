import type { ReactNode } from "react";

const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const AUTO_URL = /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;

export function renderChatMessageContent(content: string): ReactNode[] {
  if (!content) return [];

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const urlParts = text.split(AUTO_URL);
    urlParts.forEach((segment, i) => {
      if (i % 2 === 1) {
        parts.push(
          <a
            key={`url-${key++}`}
            href={segment}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-300 underline underline-offset-2 break-all"
          >
            {segment}
          </a>,
        );
      } else if (segment) {
        parts.push(<span key={`t-${key++}`}>{segment}</span>);
      }
    });
  };

  for (const match of content.matchAll(MARKDOWN_LINK)) {
    const index = match.index ?? 0;
    pushText(content.slice(lastIndex, index));
    parts.push(
      <a
        key={`md-${key++}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 dark:text-indigo-300 underline underline-offset-2"
      >
        {match[1]}
      </a>,
    );
    lastIndex = index + match[0].length;
  }

  pushText(content.slice(lastIndex));
  return parts.length > 0 ? parts : [content];
}
