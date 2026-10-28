/**
 * Recent Validations Drawer / History for RATBV Cashier Shift
 * Lists all scanned QR codes, outcomes, passenger phones, and timestamps.
 */

import React from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Trash2, Download, Ticket } from 'lucide-react';
import { ValidationResult } from '../lib/supabase';

interface RecentValidationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ValidationResult[];
  onClearHistory: () => void;
}

export const RecentValidationsDrawer: React.FC<RecentValidationsDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  const validCount = history.filter((h) => h.outcome === 'VALID_REDEEMED').length;
  const alreadyUsedCount = history.filter((h) => h.outcome === 'ALREADY_REDEEMED').length;
  const invalidCount = history.filter((h) => h.outcome === 'INVALID' || h.outcome === 'ERROR').length;

  const handleExportCSV = () => {
    if (history.length === 0) return;
    const headers = ['Data si Ora', 'Cod QR', 'Rezultat Validare', 'Telefon Calator', 'Detalii'];
    const rows = history.map((item) => [
      `"${new Date(item.timestamp).toLocaleString('ro-RO')}"`,
      `"${item.qrCodeId}"`,
      `"${item.outcome}"`,
      `"${item.phone || '-'}"`,
      `"${item.title.replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `validari_ratbv_schimb_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-pop">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-400" />
              <span>Istoric Validări Schimb</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Jurnalul scanărilor efectuate la acest ghișeu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shift Summary Metrics */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-slate-950/60 border-b border-slate-800 text-center">
          <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-2.5">
            <span className="text-xs text-emerald-400 font-medium block">Validate</span>
            <span className="text-xl font-bold text-emerald-300 font-mono">{validCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">({validCount * 3} călătorii)</span>
          </div>

          <div className="bg-amber-950/40 border border-amber-500/20 rounded-xl p-2.5">
            <span className="text-xs text-amber-400 font-medium block">Refolosite</span>
            <span className="text-xl font-bold text-amber-300 font-mono">{alreadyUsedCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Respinse</span>
          </div>

          <div className="bg-rose-950/40 border border-rose-500/20 rounded-xl p-2.5">
            <span className="text-xs text-rose-400 font-medium block">Invalide</span>
            <span className="text-xl font-bold text-rose-300 font-mono">{invalidCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Inexistente</span>
          </div>
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
              <Ticket className="w-12 h-12 stroke-1 mb-2 opacity-50" />
              <p className="text-sm font-medium">Nicio scanare înregistrată încă în acest schimb.</p>
              <p className="text-xs text-slate-600 mt-1">Scanările validate vor apărea aici automat.</p>
            </div>
          ) : (
            history.map((item, index) => {
              const isSuccess = item.outcome === 'VALID_REDEEMED';
              const isUsed = item.outcome === 'ALREADY_REDEEMED';

              return (
                <div
                  key={`${item.qrCodeId}-${index}`}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg shrink-0">
                      {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                      {isUsed && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                      {!isSuccess && !isUsed && <XCircle className="w-5 h-5 text-rose-400" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{item.qrCodeId}</span>
                        {isSuccess && (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                            +3 Bilete
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{new Date(item.timestamp).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        {item.phone && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-slate-300">{item.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-[11px] font-semibold ${
                        isSuccess
                          ? 'text-emerald-400'
                          : isUsed
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {isSuccess ? 'VALID' : isUsed ? 'FOLOSIT' : 'INVALID'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Actions */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Export CSV Schimb</span>
            </button>

            <button
              type="button"
              onClick={onClearHistory}
              className="py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Resetează Schimb</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
