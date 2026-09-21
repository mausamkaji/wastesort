import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Layers,
  Camera,
  CameraOff,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  X,
  Globe,
  ShieldCheck,
  Tag,
  Trash2,
  Plus,
  Clock,
  ExternalLink
} from 'lucide-react';
import { WASTE_ITEMS } from '../data/wasteItems';
import { RESIN_CODES } from '../data/resinCodes';
import { WasteItem, InspectionResult, BinType } from '../types';
import { useGame } from '../context/GameContext';
import { useEncyclopediaStore } from '../utils/encyclopediaStore';

interface AiInspectorAndEncyclopediaProps {
  initialSubTab?: 'ai_inspector' | 'catalog' | 'resin_codes';
  onSubTabChange?: (subTab: 'ai_inspector' | 'catalog' | 'resin_codes') => void;
}

export const AiInspectorAndEncyclopedia: React.FC<AiInspectorAndEncyclopediaProps> = ({
  initialSubTab = 'ai_inspector',
  onSubTabChange
}) => {
  const { recordAiInspection } = useGame();
  const [activeSubTab, setActiveSubTab] = useState<'ai_inspector' | 'catalog' | 'resin_codes'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSubTabSwitch = (tab: 'ai_inspector' | 'catalog' | 'resin_codes') => {
    setActiveSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // AI Inspector Mode: 'camera' (live webcam/phone camera) | 'upload' (photo file)
  const [inspectMode, setInspectMode] = useState<'camera' | 'upload'>('camera');

  // Camera & Photo State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [photoUserNotes, setPhotoUserNotes] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [samplePhotoType, setSamplePhotoType] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Inspector Result State
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

  // Robustly connect cameraStream to video element whenever stream changes or active status toggles
  useEffect(() => {
    if (!videoRef.current || !cameraStream) return;
    const video = videoRef.current;

    if (video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy handled silently
      });
    }
  }, [cameraStream, isCameraActive]);

  // Helper to generate a realistic sample waste image for instant testing
  const loadSamplePhoto = (type: 'battery' | 'pizza_box' | 'chicken_bones' | 'plastic_bottle' | 'hard_rubbish') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgGrad = ctx.createLinearGradient(0, 0, 640, 480);
    let defaultNote = '';

    if (type === 'battery') {
      bgGrad.addColorStop(0, '#1c1917');
      bgGrad.addColorStop(1, '#0c0a09');
      defaultNote = 'Lithium rechargeable battery with terminals';
    } else if (type === 'pizza_box') {
      bgGrad.addColorStop(0, '#78350f');
      bgGrad.addColorStop(1, '#451a03');
      defaultNote = 'Takeaway pizza box with greasy food residue';
    } else if (type === 'chicken_bones') {
      bgGrad.addColorStop(0, '#9a3412');
      bgGrad.addColorStop(1, '#431407');
      defaultNote = 'Leftover chicken bones and meat carcass';
    } else if (type === 'plastic_bottle') {
      bgGrad.addColorStop(0, '#0369a1');
      bgGrad.addColorStop(1, '#0c4a6e');
      defaultNote = 'Transparent PET plastic beverage drink bottle, rinsed';
    } else {
      bgGrad.addColorStop(0, '#713f12');
      bgGrad.addColorStop(1, '#361e05');
      defaultNote = 'Old broken wooden chair and couch frame';
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 640, 480);

    // Viewfinder HUD
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '14px monospace';
    ctx.fillText('CAMERA SNAPSHOT • VERIFIED WASTE SCAN', 30, 40);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const infoMap = {
      battery: { emoji: '🔋', title: 'Lithium-ion Battery Pack', subtitle: 'Electronic item with cord / chemical cells' },
      pizza_box: { emoji: '🍕', title: 'Greasy Pizza Box', subtitle: 'Cardboard heavily soiled with food oils' },
      chicken_bones: { emoji: '🍗', title: 'Roast Chicken Bones', subtitle: 'Meat and bone food scraps' },
      plastic_bottle: { emoji: '🧴', title: 'PET Plastic Bottle', subtitle: 'Rigid beverage container #1 PET' },
      hard_rubbish: { emoji: '🛋️', title: 'Broken Household Chair', subtitle: 'Bulky oversized furniture piece' },
    };

    const item = infoMap[type];
    ctx.font = '90px sans-serif';
    ctx.fillText(item.emoji, 320, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(item.title, 320, 275);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '15px sans-serif';
    ctx.fillText(item.subtitle, 320, 315);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhotoUrl(dataUrl);
    setPhotoUserNotes(defaultNote);
    setSamplePhotoType(type);
    setUploadedFileName(null);
    setCameraError(null);
    stopCamera();
  };

  // Camera Handlers with robust fallback constraints
  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setIsCameraLoading(true);
    setCameraError(null);
    stopCamera();

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Live camera is not accessible in this browser or frame. You can upload a photo or select a sample waste item below.'
        );
        setIsCameraLoading(false);
        return;
      }

      let stream: MediaStream | null = null;

      // Attempt 1: Try with ideal resolution and requested facingMode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Attempt 2: Fallback to general video constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setCameraStream(stream);
      setIsCameraActive(true);

      // Direct assignment if video element is already in DOM
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const isNotFound = err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError';
      const isSecurity = err?.name === 'SecurityError';
      setCameraError(
        isDenied
          ? 'Camera permission denied or dismissed. Please allow camera access in your browser or click "Upload Photo" / "Try Sample Rubbish".'
          : isNotFound
          ? 'No camera found on this device. You can choose an image file or test with sample waste items.'
          : isSecurity
          ? 'Camera access is restricted in this window. You can upload a photo or use sample waste items.'
          : (err?.message || 'Unable to start camera. Please verify device permissions or use file upload.')
      );
      setIsCameraActive(false);
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    // Trigger visual shutter flash
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 220);

    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedPhotoUrl(dataUrl);
      setUploadedFileName(null);
      setSamplePhotoType(null);
      stopCamera();
    } catch {
      setCameraError('Unable to capture frame from camera. You can try taking a photo with file upload.');
    }
  };

  // One-tap Snap & Identify: captures current video frame and immediately runs AI inspection + Google Search
  const snapAndIdentify = () => {
    const video = videoRef.current;
    if (!video) return;

    // Trigger visual shutter flash
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 220);

    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedPhotoUrl(dataUrl);
      setUploadedFileName(null);
      setSamplePhotoType(null);
      stopCamera();
      // Immediately run AI identification with Google Search grounding!
      handleInspectImage(dataUrl);
    } catch {
      setCameraError('Unable to capture frame from camera. You can try taking a photo with file upload.');
    }
  };

  const retakePhoto = () => {
    setCapturedPhotoUrl(null);
    setInspectionResult(null);
    setUploadedFileName(null);
    setSamplePhotoType(null);
    setPhotoUserNotes('');
    startCamera();
  };

  // Compress high-res camera captures or uploaded files to prevent payload-too-large or network stalls
  const compressImageIfNeeded = (dataUrl: string, maxDim = 1280): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl.startsWith('data:image') || dataUrl.length < 400000) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim) {
          resolve(dataUrl);
          return;
        }
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setSamplePhotoType(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawResult = event.target?.result as string;
      const optimized = await compressImageIfNeeded(rawResult);
      setCapturedPhotoUrl(optimized);
      setCameraError(null);
      setInspectError(null);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const handleInspectImage = async (overridePhotoUrl?: string, overrideItemHint?: string, overrideCategory?: string) => {
    const photoToUse = overridePhotoUrl || capturedPhotoUrl;
    if (!photoToUse) return;
    setIsInspecting(true);
    setInspectError(null);

    try {
      const optimizedPhoto = await compressImageIfNeeded(photoToUse);
      const itemHint = overrideItemHint || photoUserNotes.trim() || undefined;
      const catHint = overrideCategory || undefined;

      const res = await fetch('/api/inspect-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: optimizedPhoto,
          userNotes: photoUserNotes.trim() || undefined,
          fileName: uploadedFileName || undefined,
          sampleType: samplePhotoType || undefined,
          visualHint: itemHint,
          detectedCategory: catHint,
          enableGoogleSearch: useGoogleSearch,
        }),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Image inspection service encountered an issue.');
      }
      const data: InspectionResult = await res.json();
      setInspectionResult({
        ...data,
        photoDataUrl: optimizedPhoto,
      });
      recordAiInspection();
    } catch (err: any) {
      setInspectError(err?.message || 'Unable to analyze rubbish photo. Please check your connection and try again.');
    } finally {
      setIsInspecting(false);
    }
  };

  // Encyclopedia Store & State
  const {
    allItems,
    curatedItems,
  } = useEncyclopediaStore();

  // Catalog State
  const [catalogSearch, setCatalogSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<WasteItem | null>(null);

  // AI Encyclopedia Validation Engine State
  const [isValidatingItem, setIsValidatingItem] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    itemName: string;
    isAccurate: boolean;
    accuracyScore: number;
    statusBadge: "VERIFIED_ACCURATE" | "VALID_WITH_CONDITIONS" | "CORRECTION_REQUIRED";
    statusText: string;
    recommendedBin: string;
    recommendedBinName: string;
    verdictSummary: string;
    detailedAnalysis: string;
    ruleAffirmations: string[];
    acceptableStreams: Array<{
      bin: string;
      binName: string;
      condition: string;
      reason: string;
    }>;
    contaminationRisks?: string;
    proTip?: string;
    councilRegulations?: string;
    auditTimestamp: string;
  } | null>(null);
  const [validationTargetName, setValidationTargetName] = useState<string>('');
  const [customScenarioQuery, setCustomScenarioQuery] = useState<string>('');

  const handleValidateEncyclopediaItem = async (
    item: { name: string; bin: string; whyItGoesHere?: string; category?: string; prepInstructions?: string[] },
    scenario?: string
  ) => {
    setIsValidatingItem(true);
    setValidationTargetName(item.name);
    try {
      const res = await fetch('/api/validate-encyclopedia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: item.name,
          currentBin: item.bin,
          currentWhy: item.whyItGoesHere,
          category: item.category,
          prepInstructions: item.prepInstructions,
          userScenario: scenario || customScenarioQuery || undefined,
        }),
      });
      if (!res.ok) throw new Error('Validation request failed');
      const data = await res.json();
      setValidationResult(data);
    } catch {
      // Local fallback served cleanly
    } finally {
      setIsValidatingItem(false);
    }
  };

  const filteredCatalog = allItems.filter(item => {
    const q = catalogSearch.toLowerCase().trim();
    const matchesCat = categoryFilter === 'all' ||
      item.category === categoryFilter ||
      (categoryFilter === 'textiles' && (item.category === 'textiles' || item.bin === 'cloth_recycling')) ||
      (categoryFilter === 'meat_bones' && (item.category === 'meat_bones' || item.bin === 'meat_bones')) ||
      (categoryFilter === 'e_waste' && (item.category === 'e_waste_hazardous' || item.bin === 'e_waste')) ||
      (categoryFilter === 'medical_waste' && item.bin === 'medical_waste') ||
      (categoryFilter === 'hard_rubbish' && (item.category === 'hard_rubbish' || item.bin === 'hard_rubbish'));

    if (!q) {
      return matchesCat;
    }

    const matchesSearch = item.name.toLowerCase().includes(q) ||
      item.whyItGoesHere.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q));

    return matchesSearch && matchesCat;
  });

  const getBinBadgeClass = (bin: BinType, category?: string, tags?: string[], name?: string) => {
    const b = bin as string;
    const n = (name || '').toLowerCase();
    const c = (category || '').toLowerCase();
    const t = tags || [];
    // Catalog items always carry a correct, explicit bin. Keyword/tag heuristics below exist to
    // help classify freeform AI search results that may lack one — they must never override an
    // item's own explicit bin (e.g. a "Meat Packaging Tray" item whose real bin is general_waste
    // was getting badge-colored "Meat & Bones" purely because its tags happened to include "meat").
    const hasExplicitBin = Boolean(b) && !['recycling', 'landfill', 'compost', 'hazardous_special', ''].includes(b);

    // Clean, dry, unused pizza box -> Blue Lid Bin (paper_cardboard)
    const isCleanPizzaBox =
      n.includes('pizza') &&
      (n.includes('clean') || n.includes('unused') || n.includes('dry') || n.includes('unsoiled') || n.includes('new') || n.includes('clean lid') || n.includes('clean top'));

    if (isCleanPizzaBox) {
      return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
    }

    // Styrofoam meat tray / foam packaging -> strictly Red Lid General Waste
    if (
      (n.includes('styrofoam') || n.includes('polystyrene') || n.includes('meat tray') || n.includes('foam tray') || n.includes('butcher tray')) &&
      (n.includes('tray') || n.includes('meat') || n.includes('foam') || n.includes('styrofoam') || n.includes('polystyrene') || n.includes('butcher'))
    ) {
      return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    }

    // Greasy pizza box check -> strictly Red Lid General Waste
    if (
      n.includes('pizza') &&
      !n.includes('clean lid') &&
      !n.includes('clean top')
    ) {
      return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    }

    // Paper towels, napkins, serviettes, facial tissues -> strictly Red Lid General Waste (Not Organic, Not Donation)
    const isPaperTowelOrNapkin =
      n.includes('paper towel') ||
      n.includes('papertowel') ||
      n.includes('napkin') ||
      n.includes('serviette') ||
      n.includes('facial tissue') ||
      (n.includes('tissue') && !n.includes('tissue box'));

    if (isPaperTowelOrNapkin) {
      return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    }

    // Clothing, shoes, textiles -> clothes donation hub / red bin
    if (
      b === 'cloth_recycling' ||
      (!hasExplicitBin && (
        c === 'textiles' ||
        t.includes('textiles') ||
        t.includes('clothing') ||
        n.includes('clothing') ||
        n.includes('clothes') ||
        n.includes('shirt') ||
        n.includes('jeans') ||
        n.includes('pants') ||
        /\bdress\b/.test(n) ||
        n.includes('jacket') ||
        n.includes('shoe') ||
        n.includes('sneaker') ||
        n.includes('bedsheet') ||
        (n.includes('towel') && !n.includes('paper towel') && !n.includes('papertowel')) ||
        n.includes('linen')
      ))
    ) {
      return 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
    }

    // Soft plastics & plastic film -> supermarket drop-off / red bin
    if (
      b === 'soft_plastic_dropoff' ||
      (!hasExplicitBin && (
        n.includes('bubble wrap') ||
        n.includes('air pillow') ||
        n.includes('soft plastic') ||
        n.includes('plastic film') ||
        n.includes('cling wrap') ||
        n.includes('plastic bag') ||
        n.includes('shopping bag') ||
        n.includes('chip packet')
      ))
    ) {
      return 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold';
    }

    if (
      b === 'e_waste' ||
      (!hasExplicitBin && (
        c === 'e_waste' ||
        t.includes('e_waste') ||
        t.includes('battery') ||
        n.includes('battery') ||
        n.includes('phone') ||
        n.includes('cable') ||
        n.includes('charger')
      ))
    ) {
      return 'bg-stone-900 text-amber-300 border-stone-800 font-bold';
    }

    if (
      b === 'hard_rubbish' ||
      (!hasExplicitBin && (
        c === 'hard_rubbish' ||
        t.includes('hard_rubbish') ||
        t.includes('furniture') ||
        t.includes('bulky') ||
        n.includes('furniture') ||
        n.includes('mattress') ||
        n.includes('washing machine') ||
        n.includes('dryer') ||
        n.includes('sofa') ||
        n.includes('couch')
      ))
    ) {
      return 'bg-amber-800 text-amber-100 border-amber-900 font-bold';
    }

    if (
      b === 'medical_waste' ||
      (!hasExplicitBin && (
        c === 'medical_waste' ||
        t.includes('medical') ||
        t.includes('sharps') ||
        t.includes('needle') ||
        n.includes('syringe') ||
        n.includes('needle') ||
        n.includes('gauze')
      ))
    ) {
      return 'bg-rose-50 text-rose-900 border-rose-300';
    }

    if (
      b === 'meat_bones' ||
      (!hasExplicitBin && (
        c === 'meat_bones' ||
        t.includes('meat') ||
        t.includes('bones') ||
        t.includes('bone') ||
        t.includes('poultry') ||
        n.includes('chicken bone') ||
        n.includes('beef bone') ||
        n.includes('fish bone') ||
        n.includes('pork bone') ||
        n.includes('rib bone') ||
        n.includes('carcass')
      ))
    ) {
      return 'bg-orange-100 text-orange-900 border-orange-300';
    }

    if (b === 'general_waste' || b === 'landfill' || b === 'hazardous_special') {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    if (b === 'organic' || b === 'compost') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (b === 'paper_cardboard') {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    if (b === 'commingled_recycling') {
      return 'bg-amber-100 text-amber-900 border-amber-300';
    }
    if (b === 'recycling') {
      if (
        c === 'paper_cardboard' ||
        (tags && (tags.includes('paper') || tags.includes('cardboard') || tags.includes('box'))) ||
        n.includes('cardboard') || n.includes('newspaper') || n.includes('magazine') || n.includes('paper')
      ) {
        return 'bg-blue-100 text-blue-800 border-blue-300';
      }
      return 'bg-amber-100 text-amber-900 border-amber-300';
    }
    return 'bg-stone-100 text-stone-800 border-stone-300';
  };

  const getBinLabel = (bin: BinType, category?: string, tags?: string[], name?: string) => {
    const b = bin as string;
    const n = (name || '').toLowerCase();
    const c = (category || '').toLowerCase();
    const t = tags || [];
    // Catalog items always carry a correct, explicit bin. Keyword/tag heuristics below exist to
    // help classify freeform AI search results that may lack one — they must never override an
    // item's own explicit bin (e.g. a "Meat Packaging Tray" item whose real bin is general_waste
    // was getting labeled "Meat & Bones" purely because its tags happened to include "meat").
    const hasExplicitBin = Boolean(b) && !['recycling', 'landfill', 'compost', 'hazardous_special', ''].includes(b);

    // Clean, dry, unused pizza box -> Blue Lid Bin (paper_cardboard)
    const isCleanPizzaBox =
      n.includes('pizza') &&
      (n.includes('clean') || n.includes('unused') || n.includes('dry') || n.includes('unsoiled') || n.includes('new') || n.includes('clean lid') || n.includes('clean top'));

    if (isCleanPizzaBox) {
      return '🔵 Blue Lid: Cardboard & Paper';
    }

    // Styrofoam meat tray -> strictly Red Lid General Waste
    if (
      (n.includes('styrofoam') || n.includes('polystyrene') || n.includes('meat tray') || n.includes('foam tray') || n.includes('butcher tray')) &&
      (n.includes('tray') || n.includes('meat') || n.includes('foam') || n.includes('styrofoam') || n.includes('polystyrene') || n.includes('butcher'))
    ) {
      return '🔴 Red Lid: General Waste (Only)';
    }

    // Greasy pizza box check -> strictly Red Lid General Waste
    if (
      n.includes('pizza') &&
      !n.includes('clean lid') &&
      !n.includes('clean top')
    ) {
      return '🔴 Red Lid: General Waste';
    }

    // Paper towels, paper napkins, serviettes -> strictly Red Lid General Waste (Not Organic, Not Donation)
    const isPaperTowelOrNapkin =
      n.includes('paper towel') ||
      n.includes('papertowel') ||
      n.includes('napkin') ||
      n.includes('serviette') ||
      n.includes('facial tissue') ||
      (n.includes('tissue') && !n.includes('tissue box'));

    if (isPaperTowelOrNapkin) {
      return '🔴 Red Lid: General Waste (Not Organic / Not Donation)';
    }

    // Clothing, shoes, textiles -> clothes donation hub / red bin
    if (
      b === 'cloth_recycling' ||
      (!hasExplicitBin && (
        c === 'textiles' ||
        t.includes('textiles') ||
        t.includes('clothing') ||
        n.includes('clothing') ||
        n.includes('clothes') ||
        n.includes('shirt') ||
        n.includes('jeans') ||
        n.includes('pants') ||
        /\bdress\b/.test(n) ||
        n.includes('jacket') ||
        n.includes('shoe') ||
        n.includes('sneaker') ||
        n.includes('bedsheet') ||
        (n.includes('towel') && !n.includes('paper towel') && !n.includes('papertowel')) ||
        n.includes('linen')
      ))
    ) {
      return '👕 Clothes Donation / Red Bin';
    }

    // Soft plastics & plastic film -> supermarket drop-off / red bin
    if (
      b === 'soft_plastic_dropoff' ||
      (!hasExplicitBin && (
        n.includes('bubble wrap') ||
        n.includes('air pillow') ||
        n.includes('soft plastic') ||
        n.includes('plastic film') ||
        n.includes('cling wrap') ||
        n.includes('plastic bag') ||
        n.includes('shopping bag') ||
        n.includes('chip packet')
      ))
    ) {
      return '🛍️ Soft Plastic Drop-Off / Red Bin';
    }

    if (
      b === 'e_waste' ||
      (!hasExplicitBin && (
        c === 'e_waste' ||
        t.includes('e_waste') ||
        t.includes('battery') ||
        n.includes('battery') ||
        n.includes('phone') ||
        n.includes('cable') ||
        n.includes('charger')
      ))
    ) {
      return '🏬 Designated Drop-Off: E-Waste';
    }

    if (
      b === 'hard_rubbish' ||
      (!hasExplicitBin && (
        c === 'hard_rubbish' ||
        t.includes('hard_rubbish') ||
        t.includes('furniture') ||
        t.includes('bulky') ||
        n.includes('furniture') ||
        n.includes('mattress') ||
        n.includes('washing machine') ||
        n.includes('dryer') ||
        n.includes('sofa') ||
        n.includes('couch')
      ))
    ) {
      return '🛋️ Hard Rubbish: Council Collection';
    }

    if (
      b === 'medical_waste' ||
      (!hasExplicitBin && (
        c === 'medical_waste' ||
        t.includes('medical') ||
        t.includes('sharps') ||
        t.includes('needle') ||
        n.includes('syringe') ||
        n.includes('needle') ||
        n.includes('gauze')
      ))
    ) {
      return '⚪ White Lid: Medical Waste';
    }

    if (
      b === 'meat_bones' ||
      (!hasExplicitBin && (
        c === 'meat_bones' ||
        t.includes('meat') ||
        t.includes('bones') ||
        t.includes('bone') ||
        t.includes('poultry') ||
        n.includes('chicken bone') ||
        n.includes('beef bone') ||
        n.includes('fish bone') ||
        n.includes('pork bone') ||
        n.includes('rib bone') ||
        n.includes('carcass')
      ))
    ) {
      return '🟠 Orange Lid: Meat & Bones';
    }

    if (b === 'general_waste' || b === 'landfill' || b === 'hazardous_special') {
      return '🔴 Red Lid: General Waste';
    }
    if (b === 'organic' || b === 'compost') {
      return '🟢 Green Lid: Organic';
    }
    if (b === 'paper_cardboard') {
      return '🔵 Blue Lid: Cardboard & Paper';
    }
    if (b === 'commingled_recycling') {
      return '🟡 Yellow Lid: Commingled Recycling';
    }
    if (b === 'recycling') {
      if (
        c === 'paper_cardboard' ||
        (tags && (tags.includes('paper') || tags.includes('cardboard') || tags.includes('box'))) ||
        n.includes('cardboard') || n.includes('newspaper') || n.includes('magazine') || n.includes('paper')
      ) {
        return '🔵 Blue Lid: Cardboard & Paper';
      }
      return '🟡 Yellow Lid: Commingled Recycling';
    }
    return '🔴 Red Lid: General Waste';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            id="subtab-ai-inspector"
            onClick={() => handleSubTabSwitch('ai_inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === 'ai_inspector'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>WasteSort AI Inspector</span>
          </button>
          <button
            id="subtab-catalog"
            onClick={() => handleSubTabSwitch('catalog')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === 'catalog'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Disposal Encyclopedia</span>
          </button>
          <button
            id="subtab-resin-codes"
            onClick={() => handleSubTabSwitch('resin_codes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSubTab === 'resin_codes'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Plastic Resin #1-7</span>
          </button>
        </div>
      </div>

      {/* 1. AI INSPECTOR TAB */}
      {activeSubTab === 'ai_inspector' && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="max-w-xl mx-auto text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Powered by Gemini 2.5 & Google Search Grounding</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                Scan WasteSort AI About Rubbish
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-medium">
                Click a photo with your camera or upload one. We verify against local municipal council standards and commercial processing facilities.
              </p>

              {/* Mode Selector */}
              <div className="flex items-center justify-center gap-2 pt-3 flex-wrap">
                <button
                  id="mode-camera-btn"
                  type="button"
                  onClick={() => {
                    setInspectMode('camera');
                    setCameraError(null);
                    setInspectError(null);
                    if (!capturedPhotoUrl && !isCameraActive) {
                      startCamera();
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    inspectMode === 'camera'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Click Photo (Live Camera)</span>
                </button>
                <button
                  id="mode-upload-btn"
                  type="button"
                  onClick={() => {
                    setInspectMode('upload');
                    setCameraError(null);
                    setInspectError(null);
                    stopCamera();
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    inspectMode === 'upload'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>

            {/* Hidden canvas for capturing video frames */}
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            {/* 1A. LIVE CAMERA MODE */}
            {inspectMode === 'camera' && (
              <div className="max-w-xl mx-auto space-y-4">
                {/* When photo is already captured, show review */}
                {capturedPhotoUrl ? (
                  <div className="space-y-4 bg-stone-50 border border-stone-200 p-4 sm:p-5 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        Captured Photo
                      </span>
                      <button
                        onClick={retakePhoto}
                        className="text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                      >
                        Retake Photo
                      </button>
                    </div>

                    <div className="relative rounded-xl overflow-hidden bg-black max-h-80 flex items-center justify-center">
                      <img
                        src={capturedPhotoUrl}
                        alt="Captured rubbish"
                        className="max-h-80 w-full object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={photoUserNotes}
                        onChange={e => setPhotoUserNotes(e.target.value)}
                        placeholder="Optional note (e.g., 'From kitchen bin', 'Greasy takeaway', 'Raw meat scrap')"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs bg-white text-stone-800"
                      />
                    </div>

                    {/* Google Search Grounding Status Banner in Review */}
                    <div className="flex items-center justify-between text-xs bg-blue-50/90 border border-blue-200 px-3.5 py-2.5 rounded-xl text-blue-950">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-bold">Google Search Grounding:</span>
                        <span className="text-stone-600 hidden sm:inline">Cross-reference live municipal rules</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseGoogleSearch(!useGoogleSearch)}
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          useGoogleSearch
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-stone-600 border-stone-300'
                        }`}
                      >
                        {useGoogleSearch ? 'Live Search: ON' : 'Live Search: OFF'}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        id="btn-inspect-photo"
                        onClick={() => handleInspectImage()}
                        disabled={isInspecting}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        {isInspecting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI & Google Search Identifying...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>Identify with AI + Google Search</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={retakePhoto}
                        disabled={isInspecting}
                        className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Retake
                      </button>
                    </div>
                  </div>
                ) : isCameraActive ? (
                  /* Active Live Camera Stream with Viewfinder HUD */
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden bg-stone-950 shadow-md border-2 border-emerald-500/80 aspect-4/3 flex items-center justify-center">
                      <video
                        ref={(node) => {
                          (videoRef as any).current = node;
                          if (node && cameraStream && node.srcObject !== cameraStream) {
                            node.srcObject = cameraStream;
                            node.play().catch(() => {});
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Shutter flash animation overlay */}
                      {isShutterFlashing && (
                        <div className="absolute inset-0 bg-white pointer-events-none z-30 transition-opacity duration-200" />
                      )}

                      {/* Top HUD Overlay */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-20">
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-emerald-400 border border-emerald-500/40">
                          <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                          AI Camera Scanner
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setUseGoogleSearch(!useGoogleSearch)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-white border border-white/20 hover:border-emerald-400 transition-colors cursor-pointer"
                            title="Toggle live Google Search council grounding"
                          >
                            <Globe className={`w-3 h-3 ${useGoogleSearch ? 'text-blue-400' : 'text-stone-400'}`} />
                            <span>Google Search {useGoogleSearch ? 'ON' : 'OFF'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={toggleFacingMode}
                            className="w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                            title="Switch camera"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                            title="Close camera"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Viewfinder Target Reticles & Scanning Laser Line */}
                      <div className="absolute inset-6 pointer-events-none border border-white/20 rounded-xl flex flex-col justify-between p-2">
                        <div className="flex justify-between">
                          <span className="w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
                          <span className="w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
                        </div>

                        {/* Animated Laser Scanning Beam */}
                        <motion.div
                          animate={{ top: ['15%', '85%', '15%'] }}
                          transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                          className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)] pointer-events-none"
                        />

                        <div className="text-center">
                          <span className="text-[11px] font-bold text-white bg-black/70 px-3.5 py-1 rounded-full backdrop-blur-md border border-white/20">
                            Center rubbish item in view
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
                          <span className="w-6 h-6 border-b-2 border-r-2 border-emerald-400" />
                        </div>
                      </div>

                      {/* Live Camera Controls Floating at Bottom: Snap & Identify */}
                      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4 z-20">
                        {/* Instant Snap & Identify with AI Button */}
                        <button
                          id="btn-snap-and-identify"
                          type="button"
                          onClick={snapAndIdentify}
                          disabled={isInspecting}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm px-5 sm:px-6 py-3 rounded-full shadow-lg border-2 border-white/90 transition-all cursor-pointer"
                          title="Snap photo & instantly identify with AI and Google Search"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Snap &amp; Identify with AI</span>
                        </button>

                        {/* Standard Capture Button (Take photo to review first) */}
                        <button
                          id="btn-click-photo"
                          type="button"
                          onClick={capturePhoto}
                          className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/30 transition-all cursor-pointer"
                          title="Click photo to review before identifying"
                        >
                          <Camera className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-500 px-1 font-medium">
                      <span>Tap &ldquo;Snap &amp; Identify with AI&rdquo; for instant vision &amp; search analysis</span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="underline text-emerald-700 hover:text-emerald-900 cursor-pointer"
                      >
                        Or upload a file
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Camera Inactive / Standby: Prompt to Start with Sample Rubbish Fallback */
                  <div className="bg-stone-50 border-2 border-dashed border-stone-300 rounded-3xl p-6 sm:p-8 text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-xs">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-stone-900">
                        Scan Rubbish with Device Camera
                      </h3>
                      <p className="text-xs text-stone-600 max-w-sm mx-auto font-medium">
                        Click a photo of any bottle, container, food scrap, battery, or hard rubbish. Our AI verifies bin rules against municipal council standards.
                      </p>
                    </div>

                    {/* Prominent camera error banner if permission denied or no camera device */}
                    {cameraError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl max-w-md mx-auto text-left flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="space-y-1.5">
                            <div className="font-bold">Camera Notice</div>
                            <p>{cameraError}</p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectMode('upload');
                                  setCameraError(null);
                                  setInspectError(null);
                                }}
                                className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Switch to Upload</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  loadSamplePhoto('plastic_bottle');
                                  setCameraError(null);
                                }}
                                className="inline-flex items-center gap-1 font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
                              >
                                <span>Try Sample Rubbish</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCameraError(null)}
                          className="text-rose-400 hover:text-rose-700 p-1 cursor-pointer transition-colors"
                          title="Dismiss notice"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                      <button
                        id="btn-start-camera"
                        onClick={() => startCamera()}
                        disabled={isCameraLoading}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-xs transition-all cursor-pointer"
                      >
                        {isCameraLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Starting Camera...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4" />
                            <span>Open Live Camera</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-stone-800 font-bold text-sm px-5 py-3 rounded-2xl border border-stone-300 transition-all cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-stone-600" />
                        <span>Choose File / Snap</span>
                      </button>
                    </div>

                    {/* Instant Sample Test Items */}
                    <div className="pt-2 border-t border-stone-200/80">
                      <div className="text-[11px] font-bold text-stone-500 mb-2">
                        Or test camera inspection instantly with a sample item:
                      </div>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => loadSamplePhoto('battery')}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs font-semibold text-stone-800 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>🔋 Lithium Battery</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => loadSamplePhoto('pizza_box')}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs font-semibold text-stone-800 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>🍕 Greasy Pizza Box</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => loadSamplePhoto('chicken_bones')}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs font-semibold text-stone-800 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>🍗 Chicken Bones</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => loadSamplePhoto('plastic_bottle')}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs font-semibold text-stone-800 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>🧴 PET Bottle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => loadSamplePhoto('hard_rubbish')}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs font-semibold text-stone-800 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>🛋️ Hard Rubbish</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 1B. UPLOAD PHOTO MODE */}
            {inspectMode === 'upload' && (
              <div className="max-w-xl mx-auto space-y-4">
                {capturedPhotoUrl ? (
                  <div className="space-y-4 bg-stone-50 border border-stone-200 p-4 sm:p-5 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                        Uploaded Image
                      </span>
                      <button
                        onClick={() => {
                          setCapturedPhotoUrl(null);
                          setInspectionResult(null);
                        }}
                        className="text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="relative rounded-xl overflow-hidden bg-black max-h-80 flex items-center justify-center">
                      <img
                        src={capturedPhotoUrl}
                        alt="Uploaded rubbish"
                        className="max-h-80 w-full object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={photoUserNotes}
                        onChange={e => setPhotoUserNotes(e.target.value)}
                        placeholder="Optional note (e.g., 'Takeaway container with sauce', 'Medicine blister pack')"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs bg-white text-stone-800"
                      />
                    </div>

                    {/* Google Search Grounding Status Banner in Upload Review */}
                    <div className="flex items-center justify-between text-xs bg-blue-50/90 border border-blue-200 px-3.5 py-2.5 rounded-xl text-blue-950">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-bold">Google Search Grounding:</span>
                        <span className="text-stone-600 hidden sm:inline">Live municipal rules</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseGoogleSearch(!useGoogleSearch)}
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          useGoogleSearch
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-stone-600 border-stone-300'
                        }`}
                      >
                        {useGoogleSearch ? 'Live Search: ON' : 'Live Search: OFF'}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleInspectImage()}
                        disabled={isInspecting}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        {isInspecting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI & Google Search Identifying...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>Identify with AI + Google Search</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Choose Different
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-stone-50 border-2 border-dashed border-stone-300 hover:border-emerald-500 rounded-3xl p-8 text-center space-y-3 cursor-pointer transition-colors"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-xs">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-extrabold text-stone-900">
                        Select an Image of Your Rubbish
                      </h3>
                      <p className="text-xs text-stone-600 max-w-sm mx-auto font-medium">
                        Drag and drop or browse photos from your computer or phone library.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs pointer-events-none"
                    >
                      Browse Files
                    </button>
                  </div>
                )}
              </div>
            )}


            {/* Error messaging */}
            {(inspectError || (inspectMode !== 'camera' && cameraError)) && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl max-w-xl mx-auto flex items-start justify-between gap-2 shadow-2xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{inspectError || cameraError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectError(null);
                    setCameraError(null);
                  }}
                  className="text-stone-400 hover:text-stone-700 p-0.5 rounded-sm transition-colors cursor-pointer shrink-0"
                  title="Dismiss notice"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Inspection Result Card with Multi-Stream Display */}
          {inspectionResult && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5"
            >
              {/* Visual Analysis & Designated Waste Stream Hero Banner */}
              <div className="space-y-4 border-b border-stone-200 pb-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {inspectionResult.photoDataUrl && (
                      <div className="relative shrink-0">
                        <img
                          src={inspectionResult.photoDataUrl}
                          alt={inspectionResult.itemName}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-2xl border-2 border-emerald-400 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute -bottom-1 -right-1 bg-emerald-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                          PHOTO
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-black tracking-wide uppercase text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          {inspectionResult.photoDataUrl ? 'Photo Analyzed & Identified' : 'AI Verified & Identified'}
                        </span>
                        <span className="text-[11px] font-black tracking-wide uppercase text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Globe className="w-3 h-3 text-blue-600" />
                          Municipal Grounded
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 font-semibold">{inspectionResult.photoDataUrl ? 'Image Identified As:' : 'Item Identified As:'}</div>
                      <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                        {inspectionResult.itemName}
                      </h3>
                      {inspectionResult.detectedMaterials && inspectionResult.detectedMaterials.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[11px] font-bold text-stone-400">Materials:</span>
                          {inspectionResult.detectedMaterials.map((mat, i) => (
                            <span key={i} className="text-[11px] font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
                              {mat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {inspectionResult.resinCode && (
                    <div className="shrink-0 self-start sm:self-center">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-100 text-stone-800 border border-stone-300">
                        Resin #{inspectionResult.resinCode}
                      </span>
                    </div>
                  )}
                </div>

                {/* Prominent Designated Waste Stream Spotlight Card */}
                <div className="bg-gradient-to-r from-stone-50 via-emerald-50/50 to-stone-50 rounded-2xl p-4 sm:p-5 border-2 border-emerald-500/50 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Designated Waste Stream:</span>
                    </div>
                    <span className="text-[11px] font-bold text-stone-500 bg-white px-2.5 py-0.5 rounded-md border border-stone-200">
                      Municipal Bin Standard
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-sm sm:text-base font-black px-4 py-2 rounded-xl border shadow-xs ${getBinBadgeClass(inspectionResult.primaryBin, undefined, undefined, inspectionResult.itemName)}`}>
                      {getBinLabel(inspectionResult.primaryBin, undefined, undefined, inspectionResult.itemName)}
                    </span>
                    <span className="text-xs text-stone-600 font-medium">
                      Place this item directly into the{' '}
                      <strong className="text-stone-900">
                        {getBinLabel(inspectionResult.primaryBin, undefined, undefined, inspectionResult.itemName)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Special E-Waste Drop-Off Callout Banner */}
              {inspectionResult.primaryBin === 'e_waste' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-stone-900 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 font-black text-amber-950 text-xs sm:text-sm">
                    <span className="p-1 bg-amber-500 text-stone-950 rounded-md text-xs font-black">⚠️ CRITICAL</span>
                    <span>No Household Bin Colour — Designated Drop-Off Mandatory</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold leading-relaxed text-amber-950">
                    Instead, you must take e-waste to a designated drop-off location, such as your local council&apos;s resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.
                  </p>
                </div>
              )}

              {/* DUAL / MULTI-STREAM ACCEPTANCE SHOWCASE (e.g. Raw Meat in both Meat & Bones and Organic) */}
              {inspectionResult.acceptableBins && inspectionResult.acceptableBins.length > 1 ? (
                <div className="bg-emerald-50/70 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="p-2 bg-emerald-600 text-white rounded-xl text-base shrink-0 shadow-xs">
                      ✨
                    </span>
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-stone-900">
                        Accepted in Multiple Streams (Both Answers Correct!)
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed font-medium">
                        Depending on your regional council or facility, this rubbish belongs in <strong className="text-stone-900">both</strong> bins shown below:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {inspectionResult.acceptableBins.map((opt, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-emerald-300/80 rounded-2xl p-4 space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${getBinBadgeClass(opt.bin, undefined, undefined, opt.binName)}`}>
                            {opt.binName}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Valid Option #{idx + 1}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-stone-800">
                          {opt.condition}
                        </div>
                        <p className="text-xs text-stone-600 leading-relaxed font-normal">
                          {opt.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs text-stone-800 space-y-1">
                  <span className="font-bold text-stone-900 block">Why it belongs here:</span>
                  <p className="leading-relaxed text-stone-700">{inspectionResult.whyItGoesHere}</p>
                </div>
              )}

              {/* Step-by-Step Prep Instructions */}
              <div>
                <h4 className="font-extrabold text-stone-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Preparation & Hygiene Protocol:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inspectionResult.prepInstructions.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-stone-800 shadow-2xs">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed font-medium">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rationale & Wishcycling warning */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inspectionResult.wishcyclingWarning && (
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Wishcycling Contamination Alert:
                    </span>
                    <p className="leading-relaxed text-stone-800">{inspectionResult.wishcyclingWarning}</p>
                  </div>
                )}

                {inspectionResult.verificationNote && (
                  <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 text-xs text-blue-950 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-blue-900">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      Council & Google Standards Verification:
                    </span>
                    <p className="leading-relaxed text-stone-800">{inspectionResult.verificationNote}</p>
                  </div>
                )}
              </div>

              {/* Google Search Grounding Web Citations & Verification Card */}
              {((inspectionResult.webSearchQueries && inspectionResult.webSearchQueries.length > 0) ||
                (inspectionResult.verificationSources && inspectionResult.verificationSources.length > 0)) && (
                <div className="bg-sky-50/60 border border-sky-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b border-sky-200/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                          Google Search Grounding &amp; Municipal Citations
                        </h4>
                        <p className="text-[11px] text-stone-600">
                          Cross-referenced live municipal waste databases and recycling guidelines
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
                      Grounded
                    </span>
                  </div>

                  {/* Executed Web Search Queries */}
                  {inspectionResult.webSearchQueries && inspectionResult.webSearchQueries.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-stone-600 block">
                        Google Search Inquiries Conducted:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {inspectionResult.webSearchQueries.map((queryText, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-white text-stone-800 px-2.5 py-1 rounded-lg border border-sky-200 flex items-center gap-1.5 font-medium shadow-2xs"
                          >
                            <Search className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>&ldquo;{queryText}&rdquo;</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verification Sources with direct links */}
                  {inspectionResult.verificationSources && inspectionResult.verificationSources.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-stone-600 block">
                        Official Verification Sources &amp; Council Guidelines:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {inspectionResult.verificationSources.map((source, idx) => (
                          <a
                            key={idx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 p-2.5 bg-white hover:bg-sky-100/50 border border-sky-200/80 rounded-xl text-xs text-stone-800 hover:text-blue-700 transition-colors group shadow-2xs"
                          >
                            <span className="truncate font-medium group-hover:underline">
                              {source.title}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-blue-600 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lifecycle fact & upcycle ideas */}
              {(inspectionResult.lifecycleFact || (inspectionResult.upcycleIdeas && inspectionResult.upcycleIdeas.length > 0)) && (
                <div className="pt-2 border-t border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {inspectionResult.lifecycleFact && (
                    <div className="text-xs text-stone-700 bg-sky-50/70 p-3 rounded-xl border border-sky-200/60">
                      <span className="font-bold text-sky-900 block mb-1">🌍 Environmental Lifecycle Fact:</span>
                      {inspectionResult.lifecycleFact}
                    </div>
                  )}
                  {inspectionResult.upcycleIdeas && inspectionResult.upcycleIdeas.length > 0 && (
                    <div className="text-xs text-stone-700 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/60">
                      <span className="font-bold text-emerald-900 block mb-1">💡 Upcycle / Reuse Alternative:</span>
                      {inspectionResult.upcycleIdeas.join(' • ')}
                    </div>
                  )}
                </div>
              )}

              {/* 1-Tap Quick Re-Inspect Bar */}
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Quick Re-Identify Alternative Item:</span>
                  </span>
                  <span className="text-[11px] text-stone-400">1-tap re-inspect</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {[
                    { label: '🍏 Food / Fruit Scrap', note: 'Food Scraps & Fruit Peels', cat: 'organic' },
                    { label: '☕ Takeaway Coffee Cup', note: 'Takeaway Paper Coffee Cup', cat: 'general_waste' },
                    { label: '🥫 Aluminum Can', note: 'Aluminum Drink Can', cat: 'commingled_recycling' },
                    { label: '🧴 Plastic Bottle', note: 'Transparent PET Plastic Bottle', cat: 'commingled_recycling' },
                    { label: '📦 Cardboard Box', note: 'Clean Cardboard Shipping Box', cat: 'paper_cardboard' },
                    { label: '🍕 Pizza Box', note: 'Greasy Pizza Box', cat: 'general_waste' },
                    { label: '🍽️ Ceramic / Plate', note: 'Broken Ceramic Plate / Crockery', cat: 'general_waste' },
                    { label: '🍗 Meat / Bones', note: 'Roast Chicken Bones & Meat Scraps', cat: 'meat_bones' },
                    { label: '🔋 Battery', note: 'Lithium Rechargeable Battery', cat: 'e_waste' },
                    { label: '👕 Clothes / Shoes', note: 'Clothing & Textile Garment', cat: 'cloth_recycling' },
                    { label: '🛋️ Hard Rubbish', note: 'Broken Wooden Chair & Furniture', cat: 'hard_rubbish' },
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isInspecting}
                      onClick={() => {
                        setPhotoUserNotes(chip.note);
                        handleInspectImage(capturedPhotoUrl || undefined, chip.note, chip.cat);
                      }}
                      className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-stone-700 border border-stone-200 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scan Another Item Action Bar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200">
                <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verified with multimodal AI Vision + Google Search Grounding</span>
                </div>
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Another Item with Camera</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* 2. DISPOSAL ENCYCLOPEDIA TAB */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-6">
          {/* Catalog Status & Summary */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  Municipal Waste & Recycling Encyclopedia
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Official Standards
                </span>
              </div>
              <p className="text-xs text-stone-500 max-w-xl leading-relaxed">
                Comprehensive reference catalog for household items, bin allocations, contamination rules, and item preparation guides.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-stone-100 px-3 py-1.5 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Items</span>
                <span className="text-sm font-extrabold text-stone-900">{curatedItems.length}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Standard Rules</span>
                <span className="text-sm font-extrabold text-emerald-900">{curatedItems.length}</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  onFocus={(e) => {
                    setTimeout(() => {
                      const el = e.target;
                      if (el) {
                        const yOffset = -80;
                        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                      }
                    }, 180);
                  }}
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={`Search ${curatedItems.length}+ items (e.g. foil, can, coffee, battery)...`}
                  className="w-full px-4 py-3 sm:py-2.5 pl-10 pr-10 rounded-xl border border-stone-300 text-base sm:text-xs focus:border-emerald-600 focus:outline-hidden bg-stone-50/50 transition-colors"
                />
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-xs font-bold text-stone-400 hover:text-stone-700 bg-stone-200 hover:bg-stone-300 rounded-full transition-colors cursor-pointer"
                    title="Clear filter"
                    aria-label="Clear filter"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {['all', 'plastics', 'metals', 'paper_cardboard', 'glass', 'organics', 'meat_bones', 'textiles', 'e_waste', 'medical_waste', 'hard_rubbish'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap cursor-pointer transition-all ${
                      categoryFilter === cat
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Empty State when no items match search */}
          {filteredCatalog.length === 0 && (
            <div className="bg-white p-8 rounded-3xl border border-stone-200 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-500 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-stone-900">
                No items found matching &ldquo;{catalogSearch}&rdquo;
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                Try searching for general keywords like plastic, cardboard, bottle, can, glass, or batteries.
              </p>
            </div>
          )}

          {/* Encyclopedia items grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredCatalog.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedCatalogItem(item)}
                className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-emerald-500 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl p-2 bg-stone-50 rounded-xl border border-stone-100 shrink-0">
                      {item.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBinBadgeClass(item.bin, item.category, item.tags, item.name)}`}>
                          {getBinLabel(item.bin, item.category, item.tags, item.name)}
                        </span>
                        {item.resinCode && (
                          <span className="text-[10px] font-semibold text-stone-500">
                            #{item.resinCode}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-stone-900 mt-1 line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.whyItGoesHere}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-stone-400 capitalize">
                      {item.category.replace('_', ' ')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleValidateEncyclopediaItem(item);
                      setSelectedCatalogItem(item);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>AI Validate</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal / Detail Drawer for selected catalog item */}
          {selectedCatalogItem && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white max-w-lg w-full rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl border border-stone-200 relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setSelectedCatalogItem(null)}
                  className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 cursor-pointer"
                >
                  ✕
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-4xl p-2 bg-stone-100 rounded-2xl">{selectedCatalogItem.emoji}</span>
                  <div>
                    <h3 className="font-extrabold text-lg sm:text-xl text-stone-900">
                      {selectedCatalogItem.name}
                    </h3>
                    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border mt-1 ${getBinBadgeClass(selectedCatalogItem.bin, selectedCatalogItem.category, selectedCatalogItem.tags, selectedCatalogItem.name)}`}>
                      Belongs in: {getBinLabel(selectedCatalogItem.bin, selectedCatalogItem.category, selectedCatalogItem.tags, selectedCatalogItem.name)}
                    </span>
                  </div>
                </div>

                {/* Dedicated AI Disposal Validation Card inside Modal */}
                <div className="bg-gradient-to-br from-emerald-900 to-stone-900 text-white p-4 rounded-2xl border border-emerald-700/60 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <span className="text-xs font-extrabold text-white">AI Disposal Validation Engine</span>
                    </div>
                    <button
                      type="button"
                      disabled={isValidatingItem}
                      onClick={() => handleValidateEncyclopediaItem(selectedCatalogItem)}
                      className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {isValidatingItem ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Validating...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3" />
                          <span>{validationResult && validationTargetName === selectedCatalogItem.name ? 'Re-Validate with AI' : 'Validate Answer with AI'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {validationResult && validationTargetName === selectedCatalogItem.name ? (
                    <div className="bg-white/95 text-stone-900 p-3.5 rounded-xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                        <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {validationResult.statusText}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          Accuracy: {validationResult.accuracyScore}%
                        </span>
                      </div>

                      <p className="font-semibold text-stone-900 leading-relaxed">
                        {validationResult.verdictSummary}
                      </p>

                      {validationResult.ruleAffirmations && validationResult.ruleAffirmations.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-bold text-stone-900 block text-[11px] uppercase tracking-wider">
                            Verified Rules:
                          </span>
                          <ul className="space-y-1">
                            {validationResult.ruleAffirmations.map((rule, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-stone-700">
                                <span className="text-emerald-600 font-bold">✓</span>
                                <span>{rule}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Custom Scenario Simulator */}
                      <div className="pt-2 border-t border-stone-200 space-y-1.5">
                        <span className="text-[11px] font-bold text-stone-700 block">
                          Test a Specific Condition or Scenario:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={customScenarioQuery}
                            onChange={e => setCustomScenarioQuery(e.target.value)}
                            placeholder="e.g., What if it has food grease? What if it's ripped?"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-emerald-600"
                          />
                          <button
                            type="button"
                            disabled={isValidatingItem || !customScenarioQuery.trim()}
                            onClick={() => handleValidateEncyclopediaItem(selectedCatalogItem, customScenarioQuery)}
                            className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-black disabled:bg-stone-400 text-white text-xs font-semibold cursor-pointer"
                          >
                            Test
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Click &ldquo;Validate Answer with AI&rdquo; to cross-reference this item against MRF automated machinery limits, composting biology, and municipal regulations.
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-1">
                  {selectedCatalogItem.bin === 'e_waste' && (
                    <div className="bg-amber-500/15 p-3 rounded-xl border-2 border-amber-500/40 text-xs text-amber-950">
                      <span className="font-black text-amber-950 block mb-1">⚠️ No Household Bin Colour:</span>
                      <p className="font-bold leading-relaxed">
                        Instead, you must take e-waste to a designated drop-off location, such as your local council&apos;s resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.
                      </p>
                    </div>
                  )}

                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                    <span className="font-bold text-stone-900 block mb-1">Scientific Rationale:</span>
                    <p className="text-stone-700 leading-relaxed">{selectedCatalogItem.whyItGoesHere}</p>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-stone-900 block mb-1">Preparation Steps:</span>
                    <ul className="text-xs text-stone-700 list-disc list-inside space-y-1 bg-stone-50 p-3 rounded-xl border border-stone-200">
                      {selectedCatalogItem.prepInstructions.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  {selectedCatalogItem.wishcyclingWarning && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-950">
                      <span className="font-bold text-amber-900 block mb-0.5">⚠️ Wishcycling Hazard:</span>
                      {selectedCatalogItem.wishcyclingWarning}
                    </div>
                  )}

                  {selectedCatalogItem.funFact && (
                    <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 text-xs text-sky-950">
                      <span className="font-bold text-sky-900 block mb-0.5">🌱 Eco-Impact Fact:</span>
                      {selectedCatalogItem.funFact}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedCatalogItem(null)}
                    className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. RESIN CODES GUIDE TAB */}
      {activeSubTab === 'resin_codes' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-2xs space-y-2">
            <h3 className="text-xl font-extrabold text-stone-900">
              Plastics Resin Identification Code (RIC) Guide
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              The chasing arrows triangle on plastic does <strong>NOT</strong> mean the item is automatically recyclable in your curbside bin! The number 1 through 7 indicates the chemical resin polymer. Here is the definitive breakdown:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RESIN_CODES.map(resin => (
              <div
                key={resin.code}
                className="bg-white p-5 rounded-2xl border-2 border-stone-200 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-stone-900 text-white font-black text-lg flex items-center justify-center">
                      #{resin.code}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-stone-900 text-sm leading-tight">
                        {resin.abbreviation}
                      </h4>
                      <span className="text-[11px] text-stone-500 block leading-tight">
                        {resin.fullName}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${resin.colorClass}`}>
                    {resin.recyclabilityStatus}
                  </span>
                </div>

                <p className="text-xs text-stone-700 leading-relaxed">
                  {resin.description}
                </p>

                <div className="pt-2 border-t border-stone-100 text-xs">
                  <span className="font-bold text-stone-900 block mb-1">Common items:</span>
                  <div className="flex flex-wrap gap-1">
                    {resin.commonProducts.map((p, idx) => (
                      <span key={idx} className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 text-[11px] text-stone-600">
                  <span className="font-bold text-stone-800">Safety & Handling: </span>
                  {resin.safetyNote}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
