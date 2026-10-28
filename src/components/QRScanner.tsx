/**
 * Clean, Standard QR Code Camera Scanner
 * Uses html5-qrcode without artificial laser animations or AI glows.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeCameraScanConfig, CameraDevice } from 'html5-qrcode';
import { Camera, SwitchCamera, Zap, ZapOff, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isProcessing: boolean;
  isActive: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  isProcessing,
  isActive,
}) => {
  const containerId = 'qr-reader-container';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const lastScannedCodeRef = useRef<{ code: string; time: number } | null>(null);

  // Initialize and enumerate video devices
  useEffect(() => {
    let mounted = true;

    async function initCameras() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment (back) camera on mobile/tablet
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorState('Nu a fost găsită nicio cameră video pe acest dispozitiv.');
        }
      } catch (err) {
        console.warn('Camera detection error:', err);
        if (mounted) {
          setErrorState('Accesul la cameră necesită permisiune în browser.');
        }
      }
    }

    initCameras();

    return () => {
      mounted = false;
    };
  }, []);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
  }, []);

  const startScanner = useCallback(async (cameraIdToUse?: string) => {
    const camId = cameraIdToUse || selectedCameraId;
    if (!camId) return;

    try {
      setErrorState(null);

      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } else {
        html5QrCodeRef.current = new Html5Qrcode(containerId);
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edgeSize = Math.floor(minEdge * 0.70);
          return { width: edgeSize, height: edgeSize };
        },
        aspectRatio: 1.0,
      };

      await html5QrCodeRef.current.start(
        camId,
        config,
        (decodedText: string) => {
          const now = Date.now();
          if (
            lastScannedCodeRef.current &&
            lastScannedCodeRef.current.code === decodedText &&
            now - lastScannedCodeRef.current.time < 3000
          ) {
            return;
          }

          if (isProcessing) return;

          lastScannedCodeRef.current = { code: decodedText, time: now };
          onScanSuccess(decodedText);
        },
        () => {}
      );

      setIsScanning(true);

      try {
        const capabilities = html5QrCodeRef.current.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setErrorState('Nu s-a putut porni camera video.');
      setIsScanning(false);
    }
  }, [selectedCameraId, isProcessing, onScanSuccess]);

  useEffect(() => {
    if (isActive && selectedCameraId && !isProcessing) {
      startScanner();
    } else if (!isActive && isScanning) {
      stopScanner();
    }
  }, [isActive, selectedCameraId, isProcessing, startScanner, stopScanner, isScanning]);

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {});
        }
        html5QrCodeRef.current.clear();
      }
    };
  }, []);

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    startScanner(nextCamera.id);
  };

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

  return (
    <div className="w-full bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm flex flex-col">
      {/* Top Camera Controls Bar */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Camera className="w-4 h-4 text-[#003B71]" />
          <span>Scanare Automată (Cameră)</span>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1 transition-colors ${
                torchOn
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {torchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
              <span>{torchOn ? 'Lanternă Pornită' : 'Lanternă'}</span>
            </button>
          )}

          {cameras.length > 1 && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="px-2.5 py-1 rounded text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center gap-1 transition-colors"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              <span>Schimbă Camera</span>
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewfinder Area */}
      <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
        <div id={containerId} className="w-full h-full relative" />

        {/* Clean Static Targeting Frame (no sci-fi laser) */}
        {isScanning && !isProcessing && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-white/80 rounded-md relative">
              {/* Corner tick marks */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
            </div>
          </div>
        )}

        {/* Error / Permission State */}
        {errorState && (
          <div className="absolute inset-0 bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center z-20">
            <p className="text-sm font-semibold mb-2">{errorState}</p>
            <p className="text-xs text-slate-300 max-w-xs mb-4">
              Puteți folosi oricând tastarea manuală din dreapta sau puteți reîncerca pornirea camerei.
            </p>
            <button
              type="button"
              onClick={() => startScanner()}
              className="px-4 py-2 bg-[#003B71] hover:bg-blue-700 text-white text-xs font-semibold rounded flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reîncearcă Camera
            </button>
          </div>
        )}

        {/* Idle / Initial State */}
        {!isScanning && !errorState && (
          <div className="absolute inset-0 bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
            <Camera className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-sm font-medium mb-3">Camera nu este pornită</p>
            <button
              type="button"
              onClick={() => startScanner()}
              className="px-4 py-2 bg-[#003B71] hover:bg-blue-800 text-white text-xs font-semibold rounded transition-colors"
            >
              Pornește Camera
            </button>
          </div>
        )}
      </div>

      {/* Subtext info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-600">
        Îndreptați ecranul telefonului călătorului spre obiectiv. Scanarea se face automat.
      </div>
    </div>
  );
};
