/**
 * Supabase Connection & Configuration Modal - Clean Design
 */

import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle, AlertCircle, RefreshCw, Key, Globe, HelpCircle } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, resetDemoDatabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [url, setUrl] = useState<string>('');
  const [anonKey, setAnonKey] = useState<string>('');
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [showSqlHelp, setShowSqlHelp] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.key);
      setTestingStatus('idle');
      setTestMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingStatus('testing');
    setTestMessage('Se testează conexiunea la baza de date Supabase...');

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      saveSupabaseConfig('', '');
      onConfigChanged();
      setTestingStatus('idle');
      setTestMessage('Configurație ștearsă. Aplicația folosește baza de date demo locală.');
      return;
    }

    try {
      const testClient = createClient(cleanUrl, cleanKey);
      const { data, error } = await testClient
        .from('responses')
        .select('qr_code_id, status')
        .limit(1);

      if (error) {
        setTestingStatus('error');
        setTestMessage(`Eroare Supabase: ${error.message}. Asigurați-vă că tabela "responses" există.`);
      } else {
        saveSupabaseConfig(cleanUrl, cleanKey);
        onConfigChanged();
        setTestingStatus('success');
        setTestMessage(`Conectat cu succes! Tabela "responses" a fost citită (${data?.length ?? 0} înregistrări la test).`);
      }
    } catch (err) {
      setTestingStatus('error');
      setTestMessage(`Eroare de rețea: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleResetToDemo = () => {
    saveSupabaseConfig('', '');
    resetDemoDatabase();
    setUrl('');
    setAnonKey('');
    onConfigChanged();
    setTestingStatus('idle');
    setTestMessage('Revenit la baza de date demo locală.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-none">
      <div className="w-full max-w-lg bg-white border border-slate-300 rounded-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto text-slate-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#003B71]" />
            <h3 className="text-base font-bold text-slate-900">
              Configurare Conexiune Supabase
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleTestAndSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>Supabase Project URL</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900 focus:bg-white focus:border-[#003B71] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Supabase Anon Public Key</span>
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900 focus:bg-white focus:border-[#003B71] focus:outline-none"
            />
          </div>

          {/* Feedback */}
          {testMessage && (
            <div
              className={`p-3 rounded border text-xs flex items-start gap-2 ${
                testingStatus === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : testingStatus === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              {testingStatus === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              {testingStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              {testingStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin text-[#003B71] shrink-0 mt-0.5" />}
              <span>{testMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={testingStatus === 'testing'}
              className="flex-1 h-10 bg-[#003B71] hover:bg-[#002b54] disabled:opacity-50 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
            >
              {testingStatus === 'testing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Se testează...</span>
                </>
              ) : (
                <span>Salvează și Testează</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetToDemo}
              className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded border border-slate-300"
            >
              Resetează Demo
            </button>
          </div>
        </form>

        {/* Database Schema Reference */}
        <div className="mt-5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowSqlHelp(!showSqlHelp)}
            className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900"
          >
            <span className="flex items-center gap-1 font-medium">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              Structura SQL tabelă `responses`
            </span>
            <span className="text-[11px] underline">
              {showSqlHelp ? 'Ascunde' : 'Vezi SQL'}
            </span>
          </button>

          {showSqlHelp && (
            <div className="mt-2 bg-slate-900 text-slate-200 p-3 rounded text-[11px] font-mono overflow-x-auto leading-relaxed">
              <pre className="whitespace-pre">
{`create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  qr_code_id text unique not null,
  status text not null default 'PENDING',
  redeemed_at timestamptz,
  phone_number text,
  rating integer,
  created_at timestamptz default now()
);`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
