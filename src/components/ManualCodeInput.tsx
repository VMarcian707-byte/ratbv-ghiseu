/**
 * Method B: Clean Manual Input Form
 * Clear, functional form without AI badges or decorative sparkles.
 */

import React, { useState } from 'react';
import { Search, Clipboard, X } from 'lucide-react';

interface ManualCodeInputProps {
  onSubmit: (code: string) => void;
  isProcessing: boolean;
}

export const ManualCodeInput: React.FC<ManualCodeInputProps> = ({
  onSubmit,
  isProcessing,
}) => {
  const [code, setCode] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isProcessing) return;
    onSubmit(code.trim());
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(text.trim().toUpperCase());
      }
    } catch {
      // ignore clipboard error
    }
  };

  const handleQuickTest = (sampleCode: string) => {
    setCode(sampleCode);
    onSubmit(sampleCode);
  };

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Introducere Manuală Cod QR
          </h2>
          <p className="text-xs text-slate-500">
            Folosit când camera nu poate citi ecranul călătorului
          </p>
        </div>

        {code && (
          <button
            type="button"
            onClick={() => setCode('')}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Șterge</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="manual-code-field"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5"
          >
            Cod Alfanumeric Călător
          </label>

          <div className="relative">
            <input
              id="manual-code-field"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: RATBV-X9K2L"
              disabled={isProcessing}
              autoComplete="off"
              spellCheck="false"
              className="w-full h-14 pl-4 pr-12 text-xl font-mono font-bold tracking-wider bg-slate-50 text-slate-900 border-2 border-slate-300 rounded focus:bg-white focus:border-[#003B71] focus:outline-none uppercase placeholder:text-slate-400"
            />

            <button
              type="button"
              onClick={handlePaste}
              title="Lipește din Clipboard"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            >
              <Clipboard className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={!code.trim() || isProcessing}
          className="w-full h-12 bg-[#003B71] hover:bg-[#002a52] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <span>Se verifică în baza de date...</span>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>Verifică și Validează Codul</span>
            </>
          )}
        </button>
      </form>

      {/* Clean, simple test presets */}
      <div className="mt-5 pt-4 border-t border-slate-200">
        <div className="text-xs font-semibold text-slate-600 mb-2">
          Coduri demo pentru probă la ghișeu:
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickTest('RATBV-X9K2L')}
            disabled={isProcessing}
            className="p-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 rounded text-left transition-colors"
          >
            <div className="text-[11px] font-mono font-bold text-emerald-900 truncate">
              RATBV-X9K2L
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
              Valabil (Pending)
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickTest('RATBV-USED88')}
            disabled={isProcessing}
            className="p-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded text-left transition-colors"
          >
            <div className="text-[11px] font-mono font-bold text-amber-900 truncate">
              RATBV-USED88
            </div>
            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
              Deja Folosit
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickTest('RATBV-GRESIT1')}
            disabled={isProcessing}
            className="p-2 border border-rose-300 bg-rose-50 hover:bg-rose-100 rounded text-left transition-colors"
          >
            <div className="text-[11px] font-mono font-bold text-rose-900 truncate">
              RATBV-GRESIT1
            </div>
            <div className="text-[10px] text-rose-700 font-semibold mt-0.5">
              Inexistent
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
