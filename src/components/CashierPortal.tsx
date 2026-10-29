/**
 * RATBV Cashier Portal (Portal Ghișeu RATBV)
 * Clean, practical, institutional design for ticket office staff.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Keyboard, Download, RotateCcw, ShieldCheck } from 'lucide-react';
import { QRScanner } from './QRScanner';
import { ManualCodeInput } from './ManualCodeInput';
import { ValidationResultOverlay } from './ValidationResultOverlay';
import { CashierHeader } from './CashierHeader';
import { SupabaseConfigModal } from './SupabaseConfigModal';
import { 
  validateQrCode, 
  ValidationResult, 
  getSupabaseConfig 
} from '../lib/supabase';
import { 
  playSuccessChime, 
  playWarningChime, 
  playErrorChime 
} from '../lib/audio';

const SHIFT_STORAGE_KEY = 'ratbv_cashier_shift_history_v2';

export const CashierPortal: React.FC = () => {
  const [activeResult, setActiveResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [shiftHistory, setShiftHistory] = useState<ValidationResult[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  useEffect(() => {
    const config = getSupabaseConfig();
    setIsSupabaseLive(config.isConfigured);

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SHIFT_STORAGE_KEY);
      if (stored) {
        try {
          setShiftHistory(JSON.parse(stored));
        } catch {
          // ignore corrupted data
        }
      }
    }
  }, []);

  const handleConfigChanged = () => {
    const config = getSupabaseConfig();
    setIsSupabaseLive(config.isConfigured);
  };

  const handleClearHistory = () => {
    if (window.confirm('Sigur doriți să resetați jurnalul de validări pentru acest schimb?')) {
      setShiftHistory([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SHIFT_STORAGE_KEY);
      }
    }
  };

  const handleExportCSV = () => {
    if (shiftHistory.length === 0) return;
    const headers = ['Data si Ora', 'Cod QR', 'Rezultat', 'Telefon Calator'];
    const rows = shiftHistory.map((item) => [
      `"${new Date(item.timestamp).toLocaleString('ro-RO')}"`,
      `"${item.qrCodeId}"`,
      `"${item.outcome === 'VALID_REDEEMED' ? 'VALID (3 BILETE)' : item.outcome === 'ALREADY_REDEEMED' ? 'DEJA FOLOSIT' : 'INVALID'}"`,
      `"${item.phone || '-'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `validari_ratbv_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isProcessingRef = React.useRef(isProcessing);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const handleValidateCode = useCallback(async (code: string) => {
    if (isProcessingRef.current) return;
    setIsProcessing(true);

    try {
      const result = await validateQrCode(code, 'Ghișeu RATBV');

      if (result.outcome === 'VALID_REDEEMED') {
        playSuccessChime();
      } else if (result.outcome === 'ALREADY_REDEEMED') {
        playWarningChime();
      } else {
        playErrorChime();
      }

      setShiftHistory((prev) => {
        const next = [result, ...prev];
        if (typeof window !== 'undefined') {
          localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(next.slice(0, 100)));
        }
        return next;
      });

      setActiveResult(result);
    } catch (err) {
      console.error('Validation error:', err);
      playErrorChime();
      setActiveResult({
        outcome: 'ERROR',
        qrCodeId: code,
        title: 'EROARE TEHNICĂ',
        subtitle: 'Nu s-a putut procesa validarea codului.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDismissResult = useCallback(() => {
    setActiveResult(null);
  }, []);

  const validCount = shiftHistory.filter((h) => h.outcome === 'VALID_REDEEMED').length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Institutional Top Bar */}
      <CashierHeader
        shiftTicketsGiven={validCount}
        totalValidations={shiftHistory.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSupabaseLive={isSupabaseLive}
      />

      {/* Main Workstation Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Mobile View Toggle */}
        <div className="lg:hidden flex bg-slate-200 p-1 rounded-md">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'camera'
                ? 'bg-[#003B71] text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Scanare Cameră</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'manual'
                ? 'bg-[#003B71] text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Introducere Manuală</span>
          </button>
        </div>

        {/* Dual Method Workstation Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Method A: Camera Scanner */}
          <div className={activeTab === 'camera' ? 'block' : 'hidden lg:block'}>
            <QRScanner
              onScanSuccess={handleValidateCode}
              isProcessing={isProcessing || activeResult !== null}
              isActive={activeResult === null}
            />
          </div>

          {/* Method B: Manual Code Entry */}
          <div className={activeTab === 'manual' ? 'block' : 'hidden lg:block'}>
            <ManualCodeInput
              onSubmit={handleValidateCode}
              isProcessing={isProcessing}
            />
          </div>
        </div>

        {/* Real-time Shift Log Table (Utility Desk Register) */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#003B71]" />
              <h3 className="text-sm font-bold text-slate-800">
                Jurnal Validări Schimb Curent ({shiftHistory.length})
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {shiftHistory.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded flex items-center gap-1 font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-rose-700 border border-slate-300 rounded flex items-center gap-1 font-medium transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Tură</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="py-2.5 px-4">Ora</th>
                  <th className="py-2.5 px-4">Cod QR</th>
                  <th className="py-2.5 px-4">Status / Rezultat</th>
                  
                  <th className="py-2.5 px-4 text-right">Bilete Acordate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shiftHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Nicio scanare efectuată în acest schimb. Scanați primul cod QR sau introduceți-l manual.
                    </td>
                  </tr>
                ) : (
                  shiftHistory.slice(0, 15).map((item, idx) => {
                    const isValid = item.outcome === 'VALID_REDEEMED';
                    const isUsed = item.outcome === 'ALREADY_REDEEMED';

                    return (
                      <tr key={`${item.qrCodeId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString('ro-RO', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {item.qrCodeId}
                        </td>
                        <td className="py-2.5 px-4">
                          {isValid && (
                            <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                              VALID (Acordat)
                            </span>
                          )}
                          {isUsed && (
                            <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                              DEJA FOLOSIT
                            </span>
                          )}
                          {!isValid && !isUsed && (
                            <span className="font-semibold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                              COD INVALID
                            </span>
                          )}
                        </td>
                        
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                          {isValid ? '+3 Bilete' : '0'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      

      {/* 4-Second Full Screen Result Screen */}
      {activeResult && (
        <ValidationResultOverlay
          result={activeResult}
          onDismiss={handleDismissResult}
          autoResetDurationMs={4000}
        />
      )}

      {/* Supabase Connection Setup Modal */}
      <SupabaseConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChanged={handleConfigChanged}
      />
    </div>
  );
};
