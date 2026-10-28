/**
 * Cashier Validation Result Screen
 * High-contrast, clean, and instant visual verification for RATBV desk staff.
 * No confetti or AI glow gimmicks — strictly professional and unambiguous.
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, AlertTriangle, X } from 'lucide-react';
import { ValidationResult, formatRomanianDate } from '../lib/supabase';

interface ValidationResultOverlayProps {
  result: ValidationResult;
  onDismiss: () => void;
  autoResetDurationMs?: number; // 4000ms per requirement
}

export const ValidationResultOverlay: React.FC<ValidationResultOverlayProps> = ({
  result,
  onDismiss,
  autoResetDurationMs = 4000,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    Math.ceil(autoResetDurationMs / 1000)
  );
  const [progressPercent, setProgressPercent] = useState<number>(100);

  // Keyboard shortcut to dismiss instantly (Enter, Space, or Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  // 4-second auto-reset countdown
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, autoResetDurationMs - elapsed);
      setProgressPercent((remainingTime / autoResetDurationMs) * 100);
      setSecondsRemaining(Math.ceil(remainingTime / 1000));

      if (remainingTime <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [autoResetDurationMs, onDismiss]);

  const isSuccess = result.outcome === 'VALID_REDEEMED';
  const isAlreadyUsed = result.outcome === 'ALREADY_REDEEMED';

  // High contrast solid background colors for extreme visibility
  let bgColor = 'bg-[#b91c1c] text-white'; // Red for invalid
  let buttonStyle = 'bg-white text-[#b91c1c] hover:bg-slate-100';

  if (isSuccess) {
    bgColor = 'bg-[#15803d] text-white'; // Solid Green
    buttonStyle = 'bg-white text-[#15803d] hover:bg-slate-100';
  } else if (isAlreadyUsed) {
    bgColor = 'bg-[#c2410c] text-white'; // Solid Orange/Amber
    buttonStyle = 'bg-white text-[#c2410c] hover:bg-slate-100';
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 ${bgColor} select-none overflow-y-auto`}
    >
      {/* Top Header with RATBV reference and timer */}
      <div className="w-full max-w-3xl mx-auto flex items-center justify-between border-b border-white/20 pb-3">
        <div className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
          <span>RATBV Brașov</span>
          <span>·</span>
          <span>Rezultat Validare Ghișeu</span>
        </div>

        <div className="bg-black/25 px-3 py-1 rounded text-xs font-mono font-bold">
          Revenire la scanare în {secondsRemaining}s
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-3xl mx-auto my-2 h-1.5 bg-black/20 rounded overflow-hidden">
        <div
          className="h-full bg-white transition-all duration-75 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Central Notification Box */}
      <div className="w-full max-w-2xl mx-auto my-auto py-6 text-center flex flex-col items-center">
        {/* Scenario 3: SUCCESS (GREEN) */}
        {isSuccess && (
          <div className="w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white text-[#15803d] flex items-center justify-center mb-4 shadow-md">
              <Check className="w-14 h-14 stroke-[3]" />
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2 uppercase">
              ✅ VALID! DĂ 3 BILETE
            </h1>

            <p className="text-xl sm:text-2xl font-bold text-emerald-100 mb-6">
              Eliberați 3 călătorii gratuite călătorului
            </p>

            {/* Passenger Phone Verification Box */}
            <div className="w-full bg-black/20 border-2 border-white/40 rounded-lg p-5 mb-4 text-left">
              

              <div className="flex items-center justify-between pt-3 border-t border-white/20 text-xs text-emerald-100">
                <span>Cod QR: <strong className="font-mono text-white text-sm">{result.qrCodeId}</strong></span>
                <span>Status: <strong className="text-white uppercase font-bold">Înregistrat / Folosit Acum</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Scenario 2: ALREADY REDEEMED (ORANGE) */}
        {isAlreadyUsed && (
          <div className="w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white text-[#c2410c] flex items-center justify-center mb-4 shadow-md">
              <AlertTriangle className="w-14 h-14 stroke-[3]" />
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2 uppercase">
              ⚠️ ATENȚIE: COD DEJA FOLOSIT!
            </h1>

            <p className="text-xl sm:text-2xl font-bold text-amber-100 mb-6">
              NU se mai acordă alte bilete pentru acest cod.
            </p>

            <div className="w-full bg-black/20 border-2 border-white/40 rounded-lg p-5 mb-4 text-left">
              <div className="text-xs uppercase tracking-wider font-semibold text-amber-200 mb-1">
                Data și ora la care a fost eliberat anterior:
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-3">
                {formatRomanianDate(result.redeemedAt)}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/20 text-xs text-amber-100">
                <span>Cod scanat: <strong className="font-mono text-white text-sm">{result.qrCodeId}</strong></span>
                {result.phone && (
                  <span>Telefon asociat: <strong className="font-mono text-white">{result.phone}</strong></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scenario 1: INVALID / NON-EXISTENT (RED) */}
        {!isSuccess && !isAlreadyUsed && (
          <div className="w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white text-[#b91c1c] flex items-center justify-center mb-4 shadow-md">
              <X className="w-14 h-14 stroke-[3]" />
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2 uppercase">
              ❌ COD INVALID SAU INEXISTENT!
            </h1>

            <p className="text-xl sm:text-2xl font-bold text-rose-100 mb-6">
              Acest cod nu există în baza de date cu chestionare RATBV.
            </p>

            <div className="w-full bg-black/20 border-2 border-white/40 rounded-lg p-5 mb-4 text-left">
              <div className="text-xs uppercase tracking-wider font-semibold text-rose-200 mb-1">
                Cod tastat / scanat:
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-white mb-2 break-all">
                {result.qrCodeId || 'N/A'}
              </div>
              <p className="text-xs text-rose-100">
                Rugați călătorul să verifice codul din e-mailul sau ecranul de confirmare.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Dismiss Button - Large, Touch Friendly */}
      <div className="w-full max-w-xl mx-auto pt-2">
        <button
          type="button"
          onClick={onDismiss}
          className={`w-full py-4 px-6 rounded-lg text-lg sm:text-xl font-bold shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer ${buttonStyle}`}
        >
          <span>Scanează Următorul Călător</span>
          <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-center text-xs opacity-75 mt-2">
          Sau apăsați tasta [Enter] ori [Spațiu] pentru a continua imediat.
        </p>
      </div>
    </div>
  );
};
