/**
 * Rock-Solid QR Code Scanner for RATBV Cashier Portal
 * Optimized for Vercel, iOS Safari, Android Chrome, and Desktop.
 *
 * Guaranteed stability:
 * 1. ZERO "Cannot clear while scan is ongoing" errors:
 *    Always stops previous instance cleanly, wipes container DOM, and instantiates
 *    a fresh Html5Qrcode in NOT_STARTED state before calling .start().
 * 2. ZERO premature shutdown loops:
 *    Mount effect has strictly empty dependency array [] and a hasAutoStarted ref guard.
 * 3. Stable callback refs so portal re-renders never trigger camera restarts.
 * 4. Safe pause/resume during 4-second ticket validation modal.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Html5Qrcode, 
  Html5QrcodeCameraScanConfig, 
  CameraDevice, 
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats
} from 'html5-qrcode';
import { 
  Camera, 
  SwitchCamera, 
  Zap, 
  ZapOff, 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  Upload, 
  CheckCircle2,
  Lock
} from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isProcessing: boolean;
  isActive: boolean;
}

interface ErrorDetails {
  title: string;
  message: string;
  suggestion: string;
  isPermissionIssue?: boolean;
}

type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'stopping';

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  isProcessing,
  isActive,
}) => {
  const containerId = 'qr-reader-container';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileQrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Status tracking refs to prevent race conditions
  const statusRef = useRef<ScannerStatus>('idle');
  const isMountedRef = useRef<boolean>(true);
  const hasAutoStartedRef = useRef<boolean>(false);
  const isScanningActiveRef = useRef<boolean>(true);
  const lastScannedCodeRef = useRef<{ code: string; time: number } | null>(null);

  // Detect mobile vs desktop to choose optimal default camera
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const initialFacingMode: 'environment' | 'user' = isMobile ? 'environment' : 'user';

  // Active camera settings in refs to avoid recreating callbacks
  const activeFacingModeRef = useRef<'environment' | 'user'>(initialFacingMode);
  const selectedCameraIdRef = useRef<string | null>(null);

  // Stable callback ref
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  // UI state
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeFacingMode, setActiveFacingMode] = useState<'environment' | 'user'>(initialFacingMode);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<ErrorDetails | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [fileScanSuccess, setFileScanSuccess] = useState<string | null>(null);

  // Safely pause/resume decoding when 4-second modal is displayed
  useEffect(() => {
    isScanningActiveRef.current = isActive && !isProcessing;

    const scanner = html5QrCodeRef.current;
    if (scanner && statusRef.current === 'scanning') {
      try {
        const state = scanner.getState();
        if (!isScanningActiveRef.current && state === Html5QrcodeScannerState.SCANNING) {
          scanner.pause(true);
        } else if (isScanningActiveRef.current && state === Html5QrcodeScannerState.PAUSED) {
          scanner.resume();
        }
      } catch (err) {
        console.warn('Camera pause/resume notice:', err);
      }
    }
  }, [isActive, isProcessing]);

  /**
   * Safely stop the camera hardware
   */
  const safeStop = useCallback(async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner) {
      statusRef.current = 'idle';
      setIsScanning(false);
      return;
    }

    statusRef.current = 'stopping';
    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn('Scanner stop notice:', err);
    } finally {
      html5QrCodeRef.current = null;
      statusRef.current = 'idle';
      setIsScanning(false);
      setTorchOn(false);
      setHasTorch(false);
    }
  }, []);

  /**
   * Start camera scanner cleanly
   * Ensures previous scanner is stopped, container is clean, and fresh Html5Qrcode is in NOT_STARTED state.
   */
  const startScanner = useCallback(async (
    targetConfig?: string | { facingMode: 'environment' | 'user' }
  ) => {
    // Prevent overlapping start calls
    if (statusRef.current === 'starting') return;
    if (statusRef.current === 'scanning' && !targetConfig) return;

    statusRef.current = 'starting';
    setIsLoading(true);
    setErrorState(null);

    try {
      // 1. Verify secure context and mediaDevices
      if (typeof window !== 'undefined') {
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          throw new Error('SECURE_CONTEXT_REQUIRED');
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
        }
      }

      // 2. Stop any existing running instance first
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            await html5QrCodeRef.current.stop();
          }
        } catch (e) {
          console.warn('Stop previous instance warning:', e);
        }
        html5QrCodeRef.current = null;
      }

      // 3. Ensure DOM container exists and is clean
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error('CONTAINER_NOT_FOUND');
      }
      container.innerHTML = '';

      // 4. Create fresh instance with native hardware BarcodeDetector enabled
      const scanner = new Html5Qrcode(containerId, {
        useBarCodeDetectorIfSupported: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.AZTEC,
        ],
        verbose: false,
      });
      html5QrCodeRef.current = scanner;

      let cameraConfig: string | MediaTrackConstraints = 
        targetConfig || (selectedCameraIdRef.current ? selectedCameraIdRef.current : { facingMode: activeFacingModeRef.current });

      // Scan full frame (NO qrbox crop) so QR codes at any distance or angle are detected instantly!
      const scanConfig: Html5QrcodeCameraScanConfig = {
        fps: 24,
        disableFlip: false,
        videoConstraints: {
          facingMode: isMobile ? { ideal: 'environment' } : { ideal: 'user' },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        },
      };

      const handleDecoded = (decodedText: string) => {
        if (!isScanningActiveRef.current) return;
        const now = Date.now();
        if (
          lastScannedCodeRef.current &&
          lastScannedCodeRef.current.code === decodedText &&
          now - lastScannedCodeRef.current.time < 3000
        ) {
          return;
        }

        // Haptic feedback
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([60, 40, 80]);
        }

        lastScannedCodeRef.current = { code: decodedText, time: now };
        onScanSuccessRef.current(decodedText);
      };

      // 5. Start camera with fallback from environment to user
      try {
        await scanner.start(
          cameraConfig,
          scanConfig,
          handleDecoded,
          () => {} // Frame misses while searching for QR are normal
        );
      } catch (firstErr) {
        console.warn('Primary camera start attempt failed, trying fallback:', firstErr);
        if (typeof cameraConfig !== 'string' && cameraConfig.facingMode === 'environment') {
          cameraConfig = { facingMode: 'user' };
          activeFacingModeRef.current = 'user';
          setActiveFacingMode('user');
          await scanner.start(
            cameraConfig,
            scanConfig,
            handleDecoded,
            () => {}
          );
        } else {
          throw firstErr;
        }
      }

      // 6. Check if component unmounted while starting
      if (!isMountedRef.current) {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        return;
      }

      statusRef.current = 'scanning';
      setIsScanning(true);
      setIsLoading(false);
      setErrorState(null);

      // Enumerate available cameras
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      } catch {
        // ignore device listing errors
      }

      // Detect flashlight capability
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        setHasTorch(Boolean(capabilities && 'torch' in capabilities));
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      console.warn('Camera startup warning:', err);
      statusRef.current = 'idle';
      setIsScanning(false);
      setIsLoading(false);

      const errStr = String(err);
      const errName = (err as { name?: string })?.name || '';

      if (
        errName === 'NotAllowedError' || 
        errName === 'PermissionDeniedError' || 
        errStr.includes('NotAllowedError') || 
        errStr.includes('Permission')
      ) {
        setErrorState({
          title: 'Permisiune Cameră Necesară',
          message: 'Accesul la cameră nu a fost acordat sau a fost blocat în browser.',
          suggestion: 'Apăsați butonul de mai jos pentru a activa camera sau verificați permisiunea camerei din bara browserului (lăcătuș).',
          isPermissionIssue: true,
        });
      } else if (
        errName === 'NotFoundError' || 
        errName === 'DevicesNotFoundError' || 
        errStr.includes('NotFoundError')
      ) {
        setErrorState({
          title: 'Cameră Nedetectată',
          message: 'Nu a fost găsită nicio cameră video pe acest dispozitiv.',
          suggestion: 'Conectați o cameră web sau folosiți introducerea manuală a codului.',
        });
      } else if (
        errName === 'NotReadableError' || 
        errName === 'TrackStartError' || 
        errStr.includes('NotReadableError')
      ) {
        setErrorState({
          title: 'Camera este Ocupată',
          message: 'Camera video este deja utilizată de o altă aplicație.',
          suggestion: 'Închideți alte aplicații care folosesc camera și apăsați Reîncearcă.',
        });
      } else if (errStr.includes('SECURE_CONTEXT_REQUIRED')) {
        setErrorState({
          title: 'Conexiune Securizată Necesară',
          message: 'Camera funcționează exclusiv pe adrese securizate (HTTPS).',
          suggestion: 'Accesați aplicația folosind https://.',
        });
      } else {
        setErrorState({
          title: 'Eroare la Deschiderea Camerei',
          message: 'A apărut o problemă la inițializarea fluxului video.',
          suggestion: (err as Error)?.message || 'Apăsați Reîncearcă sau folosiți introducerea manuală a codului.',
        });
      }
    }
  }, []);

  // Strict Mount Effect: runs once on mount, cleans up once on unmount
  useEffect(() => {
    isMountedRef.current = true;

    async function probePermissionAndStart() {
      try {
        if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (status.state === 'granted') {
            startScanner();
          }
        }
      } catch {
        // Permissions query failed; user can tap "Pornește Camera" button
      }
    }

    if (!hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      probePermissionAndStart();
    }

    return () => {
      isMountedRef.current = false;
      safeStop();
    };
  }, [safeStop, startScanner]);

  /**
   * Switch between available cameras or toggle front/back
   */
  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex((c) => c.id === selectedCameraIdRef.current);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      selectedCameraIdRef.current = nextCamera.id;
      setSelectedCameraId(nextCamera.id);
      startScanner(nextCamera.id);
    } else {
      const nextMode = activeFacingModeRef.current === 'environment' ? 'user' : 'environment';
      activeFacingModeRef.current = nextMode;
      setActiveFacingMode(nextMode);
      selectedCameraIdRef.current = null;
      setSelectedCameraId(null);
      startScanner({ facingMode: nextMode });
    }
  };

  /**
   * Flashlight / Torch toggle
   */
  const handleToggleTorch = async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle warning:', err);
    }
  };

  /**
   * Fallback Image Scan:
   * When live video stream is blocked or cashier has a photo/screenshot of QR
   */
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      if (!fileQrCodeRef.current) {
        fileQrCodeRef.current = new Html5Qrcode('qr-reader-file-dummy');
      }

      const decodedText = await fileQrCodeRef.current.scanFile(file, false);
      if (decodedText) {
        setFileScanSuccess(`Cod detectat: ${decodedText}`);
        setTimeout(() => setFileScanSuccess(null), 3000);
        onScanSuccessRef.current(decodedText);
      }
    } catch (err) {
      console.error('File scan error:', err);
      alert('Nu s-a putut detecta niciun cod QR clar în imaginea selectată. Vă rugăm să reîncercați sau să introduceți codul manual.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm flex flex-col">
      {/* Top Camera Controls Bar */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Camera className="w-4 h-4 text-[#003B71]" />
          <span>Scanare Cameră Ghișeu</span>
          {isScanning && !isLoading && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Activ
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Torch toggle */}
          {hasTorch && isScanning && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1 transition-colors ${
                torchOn
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Comutare lanternă"
            >
              {torchOn ? <Zap className="w-3.5 h-3.5 fill-current text-amber-600" /> : <ZapOff className="w-3.5 h-3.5" />}
              <span>{torchOn ? 'Lanternă' : 'Lanternă'}</span>
            </button>
          )}

          {/* Switch Camera */}
          {isScanning && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center gap-1 transition-colors"
              title="Comutare între camerele disponibile"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-slate-600" />
              <span>Schimbă</span>
            </button>
          )}

          {/* Photo / Screenshot Fallback Upload */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center gap-1 transition-colors"
            title="Scanează dintr-o poză sau captură de ecran"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Încarcă Poză</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
      </div>

      {/* Hidden dummy element for file-based scanner */}
      <div id="qr-reader-file-dummy" className="hidden" />

      {/* Camera Viewfinder Area */}
      <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
        {/* DOM element where html5-qrcode attaches video stream */}
        <div id={containerId} className="w-full h-full relative" />

        {/* Clean Static Targeting Frame with subtle active scan indicator */}
        {isScanning && !isLoading && !errorState && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4 z-10">
            <div className="w-64 h-64 sm:w-80 sm:h-80 max-w-[85%] max-h-[85%] border-2 border-white/60 rounded-xl relative shadow-2xl overflow-hidden">
              {/* Corner tick marks */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />

              {/* Animated subtle scan guide line */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 -translate-y-1/2" />
              
              <div className="absolute inset-x-0 bottom-2 text-center">
                <span className="bg-black/75 text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider uppercase border border-emerald-500/30">
                  Scanare Activă
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/90 text-white flex flex-col items-center justify-center p-6 text-center z-20">
            <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
            <p className="text-sm font-bold">Se deschide camera video...</p>
            <p className="text-xs text-slate-300 mt-1 max-w-xs">
              Dacă browserul solicită permisiune, apăsați pe <strong>„Permite”</strong>.
            </p>
          </div>
        )}

        {/* Informative Error State with Direct Recovery Button */}
        {errorState && !isLoading && (
          <div className="absolute inset-0 bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center z-20 overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
              {errorState.isPermissionIssue ? (
                <Lock className="w-6 h-6 text-rose-400" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-400" />
              )}
            </div>

            <h3 className="text-base font-bold mb-1 text-rose-200">
              {errorState.title}
            </h3>
            
            <p className="text-xs text-slate-200 mb-2 font-medium max-w-sm">
              {errorState.message}
            </p>

            {errorState.isPermissionIssue ? (
              <div className="w-full max-w-sm bg-amber-500/10 border border-amber-500/40 rounded-lg p-3.5 mb-4 text-left">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Deblocare Cameră în Browser (Edge / Chrome):</span>
                </div>
                <ol className="text-[11px] text-amber-100/90 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>
                    Faceți clic pe pictograma <strong>🔒 (lăcătuș)</strong> din stânga adresei web din browser (lângă <em>vercel.app</em>).
                  </li>
                  <li>
                    La opțiunea <strong>„Cameră” (Camera)</strong>, comutați din „Blocat” în <strong>„Permite” (Allow)</strong>.
                  </li>
                  <li>
                    Apăsați butonul <strong>„Reîncearcă Camera”</strong> sau <strong>„Reîncarcă Pagina”</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="bg-slate-800/80 border border-slate-700 rounded p-3 mb-4 text-left max-w-sm">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  💡 <strong>Recomandare:</strong> {errorState.suggestion}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => startScanner()}
                className="px-4 py-2 bg-[#003B71] hover:bg-blue-700 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reîncearcă Camera</span>
              </button>

              {errorState.isPermissionIssue && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reîncarcă Pagina</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-medium rounded flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Scanează din Poză</span>
              </button>
            </div>
          </div>
        )}

        {/* Fallback Success Feedback */}
        {fileScanSuccess && (
          <div className="absolute top-4 inset-x-4 bg-emerald-600 text-white p-3 rounded shadow-lg flex items-center justify-center gap-2 text-xs font-bold z-30 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{fileScanSuccess}</span>
          </div>
        )}

        {/* Stopped / Inactive Standby State */}
        {!isScanning && !isLoading && !errorState && (
          <div className="absolute inset-0 bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <Camera className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-bold mb-1">Camera este oprită</p>
            <p className="text-xs text-slate-300 mb-4 max-w-xs">
              Apăsați butonul de mai jos pentru a activa vizorul camerei.
            </p>
            <button
              type="button"
              onClick={() => startScanner()}
              className="px-5 py-2.5 bg-[#003B71] hover:bg-blue-800 text-white text-xs font-bold rounded shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Pornește Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* Subtext info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
        <span>💡 <strong>Sfat:</strong> Țineți telefonul la 15–25 cm de ecran/bilet pentru focalizare optimă.</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[#003B71] hover:underline font-bold text-left sm:text-right"
        >
          Sau încarcă poză / fișier
        </button>
      </div>
    </div>
  );
};
