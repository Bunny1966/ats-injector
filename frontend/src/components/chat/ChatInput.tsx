'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Clipboard, Plus, Wand2, Rocket, Check } from 'lucide-react';
import type { OptimizationMode } from '@/types';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
  optimizationMode?: OptimizationMode;
  onModeChange?: (mode: OptimizationMode) => void;
}

/**
 * Chat input area for pasting job descriptions.
 * Supports multi-line input with Shift+Enter for new lines and Enter to send.
 * Includes optimization mode selection and animated kinetic border.
 */
export default function ChatInput({
  onSendMessage,
  disabled,
  placeholder = 'Paste a job description here...',
  optimizationMode = 'balanced',
  onModeChange,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        setIsModeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue((prev) => prev + text);
        if (textareaRef.current) {
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                200
              )}px`;
            }
          }, 0);
        }
      }
    } catch {
      // Fallback to manual paste
    }
  };

  const selectMode = (mode: OptimizationMode) => {
    if (onModeChange) onModeChange(mode);
    setIsModeMenuOpen(false);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto mb-2 flex items-end">
      {/* Mode Menu Drop-up */}
      {isModeMenuOpen && (
        <div 
          ref={menuRef}
          className="absolute bottom-full left-0 mb-4 w-64 bg-gradient-to-b from-[#142319] to-[#0a140f] rounded-[var(--radius-lg)] p-2 animate-slide-up origin-bottom-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),_0_8px_30px_rgba(0,0,0,0.8)] border border-[rgba(0,255,120,0.15)] z-50 flex flex-col gap-1"
        >
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider px-2 py-1">
            Optimization Mode
          </div>
          <button 
            onClick={() => selectMode('quick')}
            className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${optimizationMode === 'quick' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'}`}
          >
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span>Quick ATS Boost</span>
            </div>
            {optimizationMode === 'quick' && <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />}
          </button>
          <button 
            onClick={() => selectMode('balanced')}
            className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${optimizationMode === 'balanced' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'}`}
          >
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span>Balanced</span>
            </div>
            {optimizationMode === 'balanced' && <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />}
          </button>
          <button 
            onClick={() => selectMode('full')}
            className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${optimizationMode === 'full' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'}`}
          >
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              <span>Full Career Pivot</span>
            </div>
            {optimizationMode === 'full' && <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />}
          </button>
        </div>
      )}

      {/* Inner Glass Box */}
      <div className="relative flex items-end gap-2 bg-[rgba(10,20,15,0.7)] backdrop-blur-xl rounded-[31px] px-4 py-3 w-full shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] border border-[rgba(0,255,120,0.1)] focus-within:border-[rgba(0,255,120,0.5)] focus-within:shadow-[0_0_20px_rgba(0,255,120,0.2),_inset_0_0_20px_rgba(0,0,0,0.5)] transition-all duration-300">
        
        {/* Plus Button for Mode Selection */}
        <button
          ref={toggleBtnRef}
          type="button"
          onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
          disabled={disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111e16] text-[var(--text-secondary)] hover:bg-[#1a2f23] hover:text-white transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),_0_2px_5px_rgba(0,0,0,0.5)] disabled:opacity-40 disabled:cursor-not-allowed border border-white/5"
          title="Optimization Mode"
        >
          <Plus className={`h-5 w-5 transition-transform duration-300 ${isModeMenuOpen ? 'rotate-45 text-[rgba(0,255,120,1)]' : 'rotate-0'}`} />
        </button>

        <textarea
          ref={textareaRef}
          id="chat-input"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1 resize-none bg-transparent text-[15px] text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)] focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[24px] max-h-[160px] py-[6px] px-2 leading-relaxed
          "
        />

        <div className="flex items-center gap-2 shrink-0 pb-[2px]">
          {/* Paste button */}
          <button
            type="button"
            onClick={handlePaste}
            disabled={disabled}
            title="Paste from clipboard"
            className="
              flex h-8 w-8 items-center justify-center rounded-full
              text-[var(--text-muted)] transition-all duration-[var(--transition-fast)]
              hover:bg-white/10 hover:text-white
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          >
            <Clipboard className="h-4 w-4" />
          </button>

          {/* Send button */}
          <button
            type="button"
            id="chat-send-button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={`
              flex h-9 w-9 items-center justify-center rounded-full
              transition-all duration-[var(--transition-default)]
              ${
                value.trim() && !disabled
                  ? 'bg-gradient-to-tr from-[rgba(0,180,80,1)] to-[rgba(0,255,120,1)] text-black hover:shadow-[0_0_15px_rgba(0,255,120,0.5)] shadow-md'
                  : 'bg-white/5 text-[var(--text-muted)] disabled:opacity-40 disabled:cursor-not-allowed border border-white/5'
              }
            `}
          >
            <Send className="h-4 w-4 ml-[2px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
