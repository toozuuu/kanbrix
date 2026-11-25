import React from 'react';
import { sanitizeRichText } from "../../lib/richText";

type MarkdownRendererProps = {
    content: string;
    className?: string;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    className = '',
}) => {
    const sanitizedContent = sanitizeRichText(content);

    return (
        <div
            className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
    );
};

export default MarkdownRenderer;
