import React, { useState } from 'react';

type MarkdownInputProps = {
    initialContent?: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

type ToolbarButtonProps = {
    label: string;
    onClick: () => void;
    shortcut?: string;
};

function ToolbarButton({ label, onClick, shortcut }: ToolbarButtonProps) {
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

export function MarkdownInput({
    initialContent = '',
    onChange,
    placeholder = 'Enter your content...',
}: MarkdownInputProps) {
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
        setTimeout(() => {
            textarea.value = newValue;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }, 0);
    };

    const handleBlur = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.ctrlKey && !e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    insertText('**', '**');
                    break;
                case 'i':
                    e.preventDefault();
                    insertText('*', '*');
                    break;
            }
        }
    };

    return (
        <div className="flex flex-col">
            <div className="flex flex-wrap gap-1 mb-2">
                <ToolbarButton
                    label="Bold"
                    onClick={() => insertText('**', '**')}
                    shortcut="B"
                />
                <ToolbarButton
                    label="Italic"
                    onClick={() => insertText('*', '*')}
                    shortcut="I"
                />
                <ToolbarButton
                    label="Code"
                    onClick={() => insertText('`', '`')}
                />
                <ToolbarButton
                    label="Code Block"
                    onClick={() => insertText('\n```\n', '\n```\n')}
                />
                <ToolbarButton
                    label="Heading"
                    onClick={() => insertText('\n## ')}
                />
                <ToolbarButton
                    label="List"
                    onClick={() => insertText('\n- ')}
                />
                <ToolbarButton
                    label="Quote"
                    onClick={() => insertText('\n> ')}
                />
                <ToolbarButton
                    label="Link"
                    onClick={() => {
                        const url = window.prompt('Enter URL:', '');
                        if (url) insertText(`[${url}](${url})`, '');
                    }}
                />
            </div>
            <textarea
                ref={textareaRef}
                className="w-full rounded-md border border-input bg-card p-2 text-sm font-mono resize-y min-h-[80px]"
                rows={4}
                placeholder={placeholder}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={(e) => handleBlur(e)}
                onKeyDown={(e) => handleKeyDown(e)}
            />
        </div>
    );
}

export default MarkdownInput;