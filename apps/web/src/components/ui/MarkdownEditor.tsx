import React, { useState } from 'react';

type MarkdownEditorProps = {
    initialContent?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
};

type MarkdownToolbarButtonProps = {
    label: string;
    onClick: () => void;
    shortcut?: string;
};

function MarkdownToolbarButton({ label, onClick, shortcut }: MarkdownToolbarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="px-2 py-0.5 text-xs bg-secondary hover:bg-secondary/60 rounded border border-border/40"
            title={label}>
            {label}
            {shortcut && <span className="ml-1 text-[10px] opacity-60">[{shortcut}]</span>}
        </button>
    );
}

export function RichMarkdownEditor({
    initialContent = '',
    onChange,
    placeholder = 'Enter your content...',
    className = '',
}: MarkdownEditorProps) {
    const [content, setContent] = useState(initialContent);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        setContent(initialContent);
    }, [initialContent]);

    const insertText = (before: string, after: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        const newValue = text.substring(0, start) + before + selected + after + text.substring(end);
        const newCursorPos = start + before.length + selected.length;

        setContent(newValue);
        onChange(newValue);
        setTimeout(() => {
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
        const marker = e.key === "b" ? "**" : e.key === "i" ? "*" : "";
        if (marker) { e.preventDefault(); insertText(marker, marker); }
    };

    return (
        <div className={`flex flex-col ${className}`}>
            <div className="flex flex-wrap gap-1 mb-2">
                <MarkdownToolbarButton
                    label="Bold"
                    onClick={() => insertText('**', '**')}
                    shortcut="B"
                />
                <MarkdownToolbarButton
                    label="Italic"
                    onClick={() => insertText('*', '*')}
                    shortcut="I"
                />
                <MarkdownToolbarButton
                    label="Code"
                    onClick={() => insertText('`', '`')}
                />
                <MarkdownToolbarButton
                    label="Code Block"
                    onClick={() => insertText('\n```\n', '\n```\n')}
                />
                <MarkdownToolbarButton
                    label="Heading"
                    onClick={() => insertText('\n## ')}
                />
                <MarkdownToolbarButton
                    label="List"
                    onClick={() => insertText('\n- ')}
                />
                <MarkdownToolbarButton
                    label="Quote"
                    onClick={() => insertText('\n> ')}
                />
                <MarkdownToolbarButton
                    label="Link"
                    onClick={() => {
                        const url = window.prompt('Enter URL:', '');
                        if (url) insertText(`[${url}](${url})`, '');
                    }}
                />
            </div>
            <textarea
                ref={textareaRef}
                className="w-full rounded-md border border-input bg-card p-2 text-sm font-mono"
                rows={4}
                placeholder={placeholder}
                value={content}
                onChange={(e) => {setContent(e.target.value);onChange(e.target.value);}}
                aria-label={placeholder}
                onKeyDown={(e) => handleKeyDown(e)}
            />
        </div>
    );
}

export default RichMarkdownEditor;