/**
 * Clean, Resilient QR Code Scanner for RATBV Cashier Portal
 * Optimized for Vercel, iOS Safari, Android Chrome, and Desktop.
 *
 * Resolved issues:
 * 1. "Cannot clear while scan is ongoing, close it first" - Removed all premature .clear() invocations
 * 2. Camera opening for a fraction of a second and closing - Fixed mount effect dependency loop
 * 3. Stable singleton Html5Qrcode instance with safe pause/resume state management
 * 4. Automatic facingMode: 'environment' with graceful 'user' webcam fallback
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Html5Qrcode, 
  Html5QrcodeCameraScanConfig, 
  CameraDevice, 
  Html5QrcodeScannerState 
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

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  isProcessing,
  isActive,
}) => {
  const containerId = 'qr-reader-container';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileQrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stable refs to prevent effect recreation loops
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  const isMountedRef = useRef<boolean>(true);
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const isScanningActiveRef = useRef<boolean>(true);
  const lastScannedCodeRef = useRef<{ code: string; time: number } | null>(null);

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeFacingMode, setActiveFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<ErrorDetails | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [fileScanSuccess, setFileScanSuccess] = useState<string | null>(null);

  // Synchronize active scanning state without restarting the camera
  useEffect(() => {
    isScanningActiveRef.current = isActive && !isProcessing;

    if (html5QrCodeRef.current && isScanning) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (!isScanningActiveRef.current && state === Html5QrcodeScannerState.SCANNING) {
          html5QrCodeRef.current.pause(true);
        } else if (isScanningActiveRef.current && state === Html5QrcodeScannerState.PAUSED) {
          html5QrCodeRef.current.resume();
        }
      } catch (err) {
        console.warn('Camera pause/resume toggle notice:', err);
      }
    }
  }, [isActive, isProcessing, isScanning]);

  /**
   * Safely stops the scanner if running
   */
  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current || !html5QrCodeRef.current) return;
    isStoppingRef.current = true;

    try {
      const state = html5QrCodeRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err) {
      console.warn('Stop scanner notice:', err);
    } finally {
      setIsScanning(false);
      setTorchOn(false);
      setHasTorch(false);
      isStoppingRef.current = false;
    }
  }, []);

  /**
   * Main Start Scanner function
   * Creates Html5Qrcode instance once and starts video stream.
   * NEVER calls .clear() while scanner is active.
   */
  const startScanner = useCallback(async (
    targetConfig?: string | { facingMode: 'environment' | 'user' }
  ) => {
    if (isStartingRef.current || isStoppingRef.current) return;

    // If scanner is already scanning with no specific camera switch requested, do nothing
    if (!targetConfig && html5QrCodeRef.current?.isScanning) {
      return;
    }

    isStartingRef.current = true;
    setIsLoading(true);
    setErrorState(null);

    try {
      // 1. Check secure context
      if (typeof window !== 'undefined') {
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          throw new Error('SECURE_CONTEXT_REQUIRED');
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
        }
      }

      // 2. Ensure DOM container exists
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error('CONTAINER_NOT_FOUND');
      }

      // 3. Stop previous stream if switching camera
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {
          // ignore stop transition
        }
      }

      // 4. Reuse or initialize singleton scanner
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(containerId);
      }

      // 5. Choose camera configuration
      let cameraConfig: string | MediaTrackConstraints = 
        targetConfig || (selectedCameraId ? selectedCameraId : { facingMode: activeFacingMode });

      const scanConfig: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edgeSize = Math.max(180, Math.floor(minEdge * 0.72));
          return { width: edgeSize, height: edgeSize };
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
        lastScannedCodeRef.current = { code: decodedText, time: now };
        onScanSuccessRef.current(decodedText);
      };

      // 6. Start camera stream with automatic fallback from environment to user
      try {
        await html5QrCodeRef.current.start(
          cameraConfig,
          scanConfig,
          handleDecoded,
          () => {} // Frame-level QR scan misses are expected
        );
      } catch (firstErr) {
        console.warn('First camera attempt failed, trying fallback:', firstErr);
        if (typeof cameraConfig !== 'string' && cameraConfig.facingMode === 'environment') {
          cameraConfig = { facingMode: 'user' };
          setActiveFacingMode('user');
          await html5QrCodeRef.current.start(
            cameraConfig,
            scanConfig,
            handleDecoded,
            () => {}
          );
        } else {
          throw firstErr;
        }
      }

      // If component unmounted while camera was starting, stop immediately
      if (!isMountedRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        return;
      }

      setIsScanning(true);
      setIsLoading(false);
      setErrorState(null);

      if (typeof window !== 'undefined') {
        localStorage.setItem('ratbv_camera_autostart', 'true');
      }

      // Query available cameras for switcher dropdown
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      } catch {
        // ignore device listing errors
      }

      // Detect torch capabilities
      try {
        const capabilities = html5QrCodeRef.current.getRunningTrackCapabilities();
        setHasTorch(Boolean(capabilities && 'torch' in capabilities));
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      console.warn('Camera startup warning:', err);
      setIsScanning(false);
      setIsLoading(false);

      if (typeof window !== 'undefined') {
        localStorage.removeItem('ratbv_camera_autostart');
      }

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
          suggestion: 'Apăsați butonul de mai jos pentru a acorda permisiune sau deblocați camera din pictograma de lăcătuș de lângă URL.',
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
          suggestion: 'Închideți alte aplicații (Zoom, Teams, aplicația cameră) și încercați din nou.',
        });
      } else if (errStr.includes('SECURE_CONTEXT_REQUIRED')) {
        setErrorState({
          title: 'Conexiune Securizată Necesară',
          message: 'Camera funcționează doar pe adrese securizate (HTTPS).',
          suggestion: 'Accesați aplicația folosind https://.',
        });
      } else {
        setErrorState({
          title: 'Eroare la Deschiderea Camerei',
          message: 'A apărut o problemă la inițializarea fluxului video.',
          suggestion: (err as Error)?.message || 'Apăsați Reîncearcă sau folosiți introducerea manuală a codului.',
        });
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [activeFacingMode, selectedCameraId]);

  // Mount effect: runs strictly ONCE on mount and cleans up ONCE on unmount
  useEffect(() => {
    isMountedRef.current = true;

    async function probePermission() {
      try {
        if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (status.state === 'granted') {
            startScanner();
          }
        } else if (typeof window !== 'undefined') {
          const autoStart = localStorage.getItem('ratbv_camera_autostart') === 'true';
          if (autoStart) {
            startScanner();
          }
        }
      } catch {
        // ignore probe failures; user can click button
      }
    }

    probePermission();

    return () => {
      isMountedRef.current = false;
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
        } catch {
          // ignore unmount stop errors
        }
      }
    };
  }, [startScanner]);

  /**
   * Switch camera between back/front or next device
   */
  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      setSelectedCameraId(nextCamera.id);
      startScanner(nextCamera.id);
    } else {
      const nextMode = activeFacingMode === 'environment' ? 'user' : 'environment';
      setActiveFacingMode(nextMode);
      setSelectedCameraId(null);
      startScanner({ facingMode: nextMode });
    }
  };

  /**
   * Flashlight / Torch toggle
   */
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  /**
   * Fallback Image Scan:
   * When live video is blocked or cashier has a photo/screenshot of QR
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

        {/* Clean Static Targeting Frame */}
        {isScanning && !isLoading && !errorState && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
            <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-white/80 rounded-lg relative shadow-inner">
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-sm" />
              
              <div className="absolute inset-x-0 bottom-2 text-center">
                <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">
                  Cadrați Codul QR
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/90 text-white flex flex-col items-center justify-center p-6 text-center z-20">
            <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
            <p className="text-sm font-bold">Se inițializează camera...</p>
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

            <div className="bg-slate-800/80 border border-slate-700 rounded p-3 mb-4 text-left max-w-sm">
              <p className="text-[11px] text-slate-300 leading-relaxed">
                💡 <strong>Recomandare:</strong> {errorState.suggestion}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => startScanner()}
                className="px-4 py-2 bg-[#003B71] hover:bg-blue-700 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reîncearcă Activarea Camerei</span>
              </button>

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
              Apăsați butonul de mai jos pentru a deschide vizorul camerei.
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
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <span>Îndreptați ecranul telefonului călătorului spre obiectiv.</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[#003B71] hover:underline font-semibold"
        >
          Sau încarcă fișier
        </button>
      </div>
    </div>
  );
};
