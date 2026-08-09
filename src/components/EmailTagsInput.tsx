import React, { useState, useEffect, useRef } from 'react';

interface EmailTagsInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  focusColorClass?: string; // e.g. "focus-within:border-[#00e55b]" or "focus-within:border-[#9fcaff]"
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailTagsInput: React.FC<EmailTagsInputProps> = ({
  value,
  onChange,
  placeholder = 'Add email address...',
  id,
  focusColorClass = 'focus-within:border-[#00e55b]',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse comma-separated emails from parent state value
  const emails = value
    ? value
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
    : [];

  const addEmail = () => {
    const trimmed = inputValue.trim().replace(/[,;]/g, '');
    if (!trimmed) return;

    if (emails.includes(trimmed)) {
      setInputValue('');
      return;
    }

    if (EMAIL_REGEX.test(trimmed)) {
      const newEmails = [...emails, trimmed];
      onChange(newEmails.join(', '));
      setInputValue('');
      setLocalError(null);
    } else {
      setLocalError('Invalid email format');
    }
  };

  const removeEmail = (indexToRemove: number) => {
    const newEmails = emails.filter((_, idx) => idx !== indexToRemove);
    onChange(newEmails.join(', '));
    setLocalError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ' || e.key === 'Tab') {
      e.preventDefault();
      addEmail();
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      removeEmail(emails.length - 1);
    }
  };

  const handleBlur = () => {
    addEmail();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    // Split by commas, semicolons, or whitespace
    const parts = pastedText
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const validToAdd: string[] = [];
    let hasInvalid = false;

    parts.forEach((part) => {
      if (EMAIL_REGEX.test(part)) {
        if (!emails.includes(part) && !validToAdd.includes(part)) {
          validToAdd.push(part);
        }
      } else {
        hasInvalid = true;
      }
    });

    if (validToAdd.length > 0) {
      const newEmails = [...emails, ...validToAdd];
      onChange(newEmails.join(', '));
      setLocalError(null);
    }

    if (hasInvalid) {
      setLocalError('Some email formats were invalid');
    }
  };

  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="space-y-1 w-full text-xs font-mono-code">
      <div
        onClick={handleContainerClick}
        className={`flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0A] border ${
          localError ? 'border-[#ffb4ab]' : 'border-[#3b4b3a]'
        } rounded-lg ${focusColorClass} focus-within:outline-none transition-all min-h-[46px] w-full cursor-text`}
      >
        {emails.map((email, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-[#201f1f] text-[#e5e2e1] rounded border border-[#3b4b3a] text-xs font-mono-code max-w-full break-all"
          >
            <span>{email}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(idx);
              }}
              className="text-[#849581] hover:text-[#ffb4ab] transition-colors leading-none cursor-pointer flex-shrink-0 flex items-center justify-center"
              title="Remove recipient"
            >
              <span className="material-symbols-outlined text-[10px]">close</span>
            </button>
          </div>
        ))}

        <input
          id={id}
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (localError) setLocalError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={emails.length === 0 ? placeholder : ''}
          className="flex-1 bg-transparent border-none outline-none text-[#e5e2e1] placeholder-[#849581] min-w-[120px] font-mono-code py-1 focus:ring-0 focus:outline-none"
        />
      </div>
      {localError && (
        <span className="text-[11px] text-[#ffb4ab] block font-mono-code">
          {localError}
        </span>
      )}
    </div>
  );
};
