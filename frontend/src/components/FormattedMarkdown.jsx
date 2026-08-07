import React from 'react';

function renderInlineMarkdown(text) {
  if (!text) return '';

  const regex = /(\*\*.*?\*\*|`.*?`|@[a-zA-Z0-9._-]+)/g;
  const tokens = text.split(regex);

  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-muted/80 font-mono text-xs text-primary border border-border">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('@')) {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold bg-primary/15 border border-primary/30 text-primary"
        >
          {token}
        </span>
      );
    }
    return token;
  });
}

export default function FormattedMarkdown({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inList = null; // 'ul' | 'ol'
  let listItems = [];

  const flushList = (key) => {
    if (!inList || listItems.length === 0) return;
    if (inList === 'ul') {
      elements.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 my-1.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
    } else if (inList === 'ol') {
      elements.push(
        <ol key={`ol-${key}`} className="list-decimal pl-5 space-y-1 my-1.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
    }
    inList = null;
    listItems = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList(i);
      elements.push(
        <h3 key={i} className="font-display font-bold text-base text-foreground mt-3 mb-1">
          {renderInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList(i);
      elements.push(
        <h2 key={i} className="font-display font-bold text-lg text-foreground mt-3.5 mb-1.5">
          {renderInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
        </h2>
      );
    } else if (trimmed.startsWith('# ')) {
      flushList(i);
      elements.push(
        <h1 key={i} className="font-display font-bold text-xl text-foreground mt-4 mb-2">
          {renderInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
        </h1>
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      // Unordered list item
      if (inList !== 'ul') {
        flushList(i);
        inList = 'ul';
      }
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
    } else if (/^\d+\.\s+/.test(trimmed)) {
      // Ordered list item
      if (inList !== 'ol') {
        flushList(i);
        inList = 'ol';
      }
      listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
    } else if (trimmed === '') {
      flushList(i);
    } else {
      flushList(i);
      elements.push(
        <p key={i} className="my-1 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    }
  });

  flushList('final');

  return <div className="space-y-0.5">{elements}</div>;
}
