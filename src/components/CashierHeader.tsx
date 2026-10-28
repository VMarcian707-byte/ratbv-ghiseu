/**
 * RATBV Cashier Header - Clean, Institutional Design
 */

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Maximize2, Minimize2, Settings } from 'lucide-react';
import { getSoundEnabled, setSoundEnabled } from '../lib/audio';

interface CashierHeaderProps {
  shiftTicketsGiven: number;
  totalValidations: number;
  onOpenSettings: () => void;
  isSupabaseLive: boolean;
}

export const CashierHeader: React.FC<CashierHeaderProps> = ({
  shiftTicketsGiven,
  totalValidations,
  onOpenSettings,
  isSupabaseLive,
}) => {
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    setSoundOn(getSoundEnabled());

    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="bg-[#003B71] text-white px-4 sm:px-6 py-3 border-b-2 border-[#00284d] shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left: RATBV Wordmark and App Title */}
        <div className="flex items-center gap-3">
          <div className="bg-white text-[#003B71] px-2.5 py-1 rounded font-extrabold text-base tracking-wider border border-white">
            RATBV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight">
                Portal Ghișeu · Validare Coduri QR
              </h1>
            </div>
            <p className="text-xs text-blue-200">
              Campanie Feedback Călători
            </p>
          </div>
        </div>

        {/* Right: Operational Controls & Shift Counter */}
        <div className="flex items-center gap-3">
          {/* Shift Stats Box */}
          <div className="hidden md:flex items-center gap-3 bg-[#002b54] px-3.5 py-1.5 rounded border border-blue-900/60 text-xs">
            <span className="text-blue-200">Bilete validate:</span>
            <span className="font-bold text-white text-sm tabular-nums">
              {shiftTicketsGiven}
            </span>
            <span className="text-blue-300">({shiftTicketsGiven * 3} călătorii)</span>
          </div>

          

          {/* Live Clock */}
          {currentTime && (
            <span className="hidden lg:inline text-xs font-mono text-blue-200 tabular-nums">
              {currentTime}
            </span>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={soundOn ? 'Sunet activat (apasă pentru mut)' : 'Sunet oprit (apasă pentru activare)'}
            className="p-2 rounded bg-[#002b54] hover:bg-[#002242] border border-blue-900/60 text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span className="hidden sm:inline">{soundOn ? 'Sunet ON' : 'Sunet OFF'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title="Ecran complet"
            className="p-2 rounded bg-[#002b54] hover:bg-[#002242] border border-blue-900/60 text-white transition-colors hidden sm:block"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          
            
        </div>
      </div>
    </header>
  );
};
