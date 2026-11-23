import React from 'react';
import DOMPurify from 'dompurify';

type MarkdownRendererProps = {
    content: string;
    className?: string;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    className = '',
}) => {
    // Sanitize HTML to prevent XSS attacks
    const sanitizedContent = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'blockquote',
            'code', 'pre',
            'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'del', 'ins', 'mark',
        ],
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title',
            'class',
            'align', 'colspan', 'rowspan',
        ],
    });

    return (
        <div
            className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
    );
};

export default MarkdownRenderer;