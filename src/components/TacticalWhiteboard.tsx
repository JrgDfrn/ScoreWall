/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Team, Player, Tactic, ChipState, LineDrawState } from '../types';
import { DB, generateUUID } from '../db';
import { Play, RotateCcw, Save, Trash2, Edit, ChevronRight, HelpCircle, Palette, Brush, Plus, PlayCircle, Maximize2, Minimize2, FolderOpen, FileText, Users, Eraser } from 'lucide-react';

interface TacticalWhiteboardProps {
  team: Team;
  initialTacticId?: string;
  initialFullscreen?: boolean;
  onExit?: () => void;
}

export default function TacticalWhiteboard({ team, initialTacticId, initialFullscreen, onExit }: TacticalWhiteboardProps) {
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [selectedTacticId, setSelectedTacticId] = useState<string>('');
  const [boardName, setBoardName] = useState('Pizarra de Tácticas');
  const [boardDesc, setBoardDesc] = useState('');
  const [boardType, setBoardType] = useState<'tactic' | 'training'>('tactic');
  const [boardRating, setBoardRating] = useState<number>(3);
  const [boardCategories, setBoardCategories] = useState<string[]>([]);
  
  // Whiteboard Interactive States
  const [chips, setChips] = useState<ChipState[]>([]);
  const [lines, setLines] = useState<LineDrawState[]>([]);
  const [currentLinePoints, setCurrentLinePoints] = useState<{ x: number; y: number }[] | null>(null);
  
  // Drawing configurations
  const [brushColor, setBrushColor] = useState('#ef4444'); // default neon red
  const [brushWidth, setBrushWidth] = useState(3);
  const [brushStyle, setBrushStyle] = useState<'solid' | 'dashed' | 'arrow'>('solid');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isBoardFullscreen, setIsBoardFullscreen] = useState(false);
  const [fieldOrientation, setFieldOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [showControlsInFullscreen, setShowControlsInFullscreen] = useState(true);

  // Active dragging states
  const [draggingChipId, setDraggingChipId] = useState<string | null>(null);

  // Ref containers
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const activeLinePointsRef = useRef<{ x: number; y: number }[]>([]);

  // Load roster to quickly generate player chips
  const [players, setPlayers] = useState<Player[]>([]);

  const fetchTacticsAndRoster = async () => {
    try {
      const savedTactics = await DB.tactics.list(team.id);
      setTactics(savedTactics);
      const roster = await DB.players.list(team.id);
      setPlayers(roster);

      if (savedTactics.length > 0 && !initialTacticId) {
        // Load first tactic by default if no initial ID provided
        const firstTactic = savedTactics.find(t => t.type !== 'training');
        if (firstTactic) loadTacticData(firstTactic);
      } else if (savedTactics.length === 0) {
        resetBoardToDefault();
      }
    } catch (e) {
      console.error('Failed to fetching tactics/roster:', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (initialFullscreen) {
        setIsBoardFullscreen(true);
        document.body.style.overflow = 'hidden';
      }
      await fetchTacticsAndRoster();
      
      if (initialTacticId) {
        const fullTactics = await DB.tactics.list(team.id);
        const target = fullTactics.find(t => t.id === initialTacticId);
        if (target) loadTacticData(target);
      }
    };
    init();

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [team.id, initialTacticId, initialFullscreen]);

  // Set up initial chips on the board based on sport
  const resetBoardToDefault = () => {
    setLines([]);
    setBoardName('Jugada de Ataque');
    setBoardDesc('Describe el movimiento estratégico aquí');
    setBoardType('tactic');
    setBoardRating(3);
    setBoardCategories([]);
    setSelectedTacticId('');

    // Prepopulate some default chips based on game type
    const initialChips: ChipState[] = [];
    if (team.sport === 'football') {
      // 1. Defending GK
      initialChips.push({ id: 'init-gk', label: 'POR', number: 1, x: 50, y: 88, color: '#10b981', type: 'player' });
      // 2. Playmakers / Striker
      initialChips.push({ id: 'init-p1', label: 'DEF', number: 4, x: 35, y: 65, color: team.primaryColor, type: 'player' });
      initialChips.push({ id: 'init-p2', label: 'DEF', number: 5, x: 65, y: 65, color: team.primaryColor, type: 'player' });
      initialChips.push({ id: 'init-p3', label: 'MED', number: 8, x: 50, y: 45, color: team.primaryColor, type: 'player' });
      initialChips.push({ id: 'init-p4', label: 'DEL', number: 10, x: 50, y: 22, color: team.primaryColor, type: 'player' });
    } else {
      // Water polo starting positions - exactly 6 players representing 6v6 setup
      initialChips.push({ id: 'init-wp-gk', label: 'POR', number: 1, x: 50, y: 90, color: '#10b981', type: 'player' });
      initialChips.push({ id: 'init-wp-p1', label: 'BOY', number: 5, x: 50, y: 35, color: team.primaryColor, type: 'player' });
      initialChips.push({ id: 'init-wp-p2', label: 'DEF', number: 4, x: 50, y: 65, color: team.primaryColor, type: 'player' });
      initialChips.push({ id: 'init-wp-p3', label: 'EXT', number: 2, x: 25, y: 45, color: team.primaryColor, type: 'player' });
      initialChips.push({ id: 'init-wp-p4', label: 'EXT', number: 3, x: 75, y: 45, color: team.primaryColor, type: 'player' });
      initialChips.push({ id: 'init-wp-p5', label: 'LAT', number: 6, x: 50, y: 50, color: team.primaryColor, type: 'player' });
    }

    // Always add a ball
    initialChips.push({ id: 'init-ball', label: 'Balón', x: 50, y: 52, color: '#f59e0b', type: 'ball' });
    setChips(initialChips);
  };

  const loadTacticData = (tactic: Tactic) => {
    setSelectedTacticId(tactic.id);
    setBoardName(tactic.name);
    setBoardDesc(tactic.description || '');
    setBoardType(tactic.type || 'tactic');
    setBoardRating(tactic.rating || 3);
    setBoardCategories(tactic.categories || []);
    setChips(tactic.chips);
    setLines(tactic.lines);
  };

  // Convert pixel coordinates of the click, trace back to 0-100 percentages matching container sizing
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const percentToPixels = (xp: number, yp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return {
      x: (xp / 100) * canvas.width,
      y: (yp / 100) * canvas.height,
    };
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset DPI / Match layout dimensions dynamically
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (width > 0 && height > 0) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawLine = (line: { points: { x: number; y: number }[]; color: string; width: number; style: string }) => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;

      if (line.style === 'dashed') {
        ctx.setLineDash([8, 6]);
      } else {
        ctx.setLineDash([]);
      }

      const firstPixel = percentToPixels(line.points[0].x, line.points[0].y);
      ctx.moveTo(firstPixel.x, firstPixel.y);

      for (let i = 1; i < line.points.length; i++) {
        const p = percentToPixels(line.points[i].x, line.points[i].y);
        ctx.lineTo(p.x, p.y);
      }

      ctx.stroke();

      if (line.style === 'arrow' && line.points.length >= 2) {
        const last = percentToPixels(line.points[line.points.length - 1].x, line.points[line.points.length - 1].y);
        const prev = percentToPixels(line.points[line.points.length - 2].x, line.points[line.points.length - 2].y);
        
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
        ctx.beginPath();
        ctx.fillStyle = line.color;
        ctx.setLineDash([]);
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(
          last.x - 12 * Math.cos(angle - Math.PI / 6),
          last.y - 12 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          last.x - 12 * Math.cos(angle + Math.PI / 6),
          last.y - 12 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    };

    // Draw all accumulated paths
    lines.forEach(drawLine);

    // Also draw active current path being drawn right now
    if (currentLinePoints && currentLinePoints.length >= 2) {
      drawLine({
        points: currentLinePoints,
        color: brushColor,
        width: brushWidth,
        style: brushStyle,
      });
    }
  };

  // Redraw Canvas drawings whenever lines, chips or interactive state changes
  useEffect(() => {
    drawCanvas();
  }, [lines, chips, currentLinePoints]);

  // Handle window resizing or toggling fullscreen
  useEffect(() => {
    const handleResize = () => {
      drawCanvas();
    };
    window.addEventListener('resize', handleResize);
    // Timeout to make sure layout calculations completed
    const timer = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [isBoardFullscreen, lines, currentLinePoints]);

  // Helper to calculate distance from point to line segment
  const distToSegment = (p: {x: number, y: number}, v: {x: number, y: number}, w: {x: number, y: number}) => {
    const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Pointer event drawing handlers for 0ms lag
  const handleCanvasStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingChipId) return; // ignore if moving a chip instead
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Pointer capture warn:', err);
    }
    const startPos = getRelativeCoords(e.clientX, e.clientY);
    
    if (isErasing) {
      isDrawingRef.current = true;
      // Immediate erase at start point
      setLines((prev) => prev.filter((line) => {
        for (let i = 0; i < line.points.length - 1; i++) {
          if (distToSegment(startPos, line.points[i], line.points[i+1]) < 2) return false;
        }
        return true;
      }));
      return;
    }

    setCurrentLinePoints([startPos]);
  };

  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const currentPos = getRelativeCoords(e.clientX, e.clientY);

    if (isErasing) {
      if (!isDrawingRef.current) return;
      // Continuous erasing
      setLines((prev) => prev.filter((line) => {
        for (let i = 0; i < line.points.length - 1; i++) {
          if (distToSegment(currentPos, line.points[i], line.points[i+1]) < 2) return false;
        }
        return true;
      }));
      return;
    }

    if (!currentLinePoints) return;
    const lastPos = currentLinePoints[currentLinePoints.length - 1];
    // Throttle close points to avoid jitter
    if (lastPos && Math.hypot(currentPos.x - lastPos.x, currentPos.y - lastPos.y) < 0.25) return;
    setCurrentLinePoints((prev) => (prev ? [...prev, currentPos] : [currentPos]));
  };

  const handleCanvasEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // capture might not exist
    }

    isDrawingRef.current = false;

    if (isErasing) return;

    if (currentLinePoints && currentLinePoints.length >= 2) {
      const newLine: LineDrawState = {
        id: 'line-' + Date.now().toString(),
        points: [...currentLinePoints],
        color: brushColor,
        width: brushWidth,
        style: brushStyle,
      };
      setLines((prev) => [...prev, newLine]);
    }
    setCurrentLinePoints(null);
  };

  // Add specific player as a chip to the center board
  const addPlayerChip = (player: Player) => {
    const exists = chips.some((c) => c.id === player.id);
    if (exists) return; // avoid duplicates

    // Enforce waterpolo 6v6 limit strictly
    if (team.sport === 'waterpolo') {
      const ourPlayersCount = chips.filter((c) => c.type === 'player').length;
      if (ourPlayersCount >= 6) {
        alert('En waterpolo el límite es de 6 contra 6. No puedes añadir más de 6 jugadores de tu plantilla.');
        return;
      }
    }

    const newChip: ChipState = {
      id: player.id,
      label: player.name.split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase(),
      number: player.number,
      x: 50,
      y: 50,
      color: team.primaryColor,
      type: 'player',
    };
    setChips((prev) => [...prev, newChip]);
  };

  // Add utilities like a cone, second ball or opposing player
  const addUtilityChip = (type: 'ball' | 'cone' | 'referee' | 'opponent' | 'ally') => {
    if (type === 'opponent' || type === 'ally') {
      const isOpponent = type === 'opponent';
      
      if (team.sport === 'waterpolo') {
        const currentCount = chips.filter((c) => c.type === type).length;
        if (currentCount >= 6) {
          alert(`En waterpolo el límite es de 6 contra 6. No puedes añadir más de 6 jugadores ${isOpponent ? 'contrarios' : 'aliados'}.`);
          return;
        }
      }

      const currentChips = chips.filter((c) => c.type === type);
      const num = currentChips.length + 1;
      const id = `${type}-${Date.now()}`;

      const newChip: ChipState = {
        id,
        label: isOpponent ? 'CON' : 'ALI',
        number: num,
        x: 45 + Math.random() * 10,
        y: 35 + Math.random() * 10,
        color: isOpponent ? '#f43f5e' : team.primaryColor,
        type: type as any,
      };
      setChips((prev) => [...prev, newChip]);
      return;
    }

    const id = `${type}-${Date.now()}`;
    const color = type === 'ball' ? '#f59e0b' : type === 'cone' ? '#ec4899' : '#ffffff';
    const label = type === 'ball' ? 'Balón' : type === 'cone' ? 'Cono' : 'Árbitro';
    
    const newChip: ChipState = {
      id,
      label,
      x: 45 + Math.random() * 10,
      y: 45 + Math.random() * 10,
      color,
      type: type as any,
    };
    setChips((prev) => [...prev, newChip]);
  };

  // Moving chips around the board
  const handleChipDragStart = (id: string) => {
    setDraggingChipId(id);
  };

  const updateChipPosition = (clientX: number, clientY: number) => {
    if (!draggingChipId) return;
    const { x, y } = getRelativeCoords(clientX, clientY);

    setChips((prev) =>
      prev.map((c) => {
        if (c.id === draggingChipId) {
          // Clamp values to keep chips on screen
          return {
            ...c,
            x: Math.min(Math.max(x, 2), 98),
            y: Math.min(Math.max(y, 2), 98),
          };
        }
        return c;
      })
    );
  };

  const handleChipRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChips((prev) => prev.filter((c) => c.id !== id));
  };

  // Save current board configuration as a Tactic
  const handleSaveTactic = async () => {
    if (!boardName.trim()) return;

    try {
      const activeTactic: Tactic = {
        id: selectedTacticId || generateUUID(),
        teamId: team.id,
        name: boardName.trim(),
        description: boardDesc.trim(),
        sport: team.sport,
        chips,
        lines,
        createdAt: new Date().toISOString(),
        type: boardType,
        rating: boardType === 'training' ? boardRating : undefined,
        categories: boardCategories,
      };

      await DB.tactics.save(activeTactic);
      
      const savedTactics = await DB.tactics.list(team.id);
      setTactics(savedTactics);
      setSelectedTacticId(activeTactic.id);
      alert(boardType === 'training' ? 'Entrenamiento guardado!' : 'Táctica guardada!');
    } catch (e) {
      console.error('Error saving tactic:', e);
    }
  };

  const handleDeleteTactic = async () => {
    if (!selectedTacticId) return;
    if (!confirm('¿Estás seguro de que deseas eliminar esta jugada?')) return;

    try {
      await DB.tactics.delete(selectedTacticId);
      fetchTacticsAndRoster();
    } catch (e) {
      console.error('Error deleting tactic:', e);
    }
  };

  const toggleFullscreen = () => {
    if (isBoardFullscreen) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      setIsBoardFullscreen(false);
      document.body.style.overflow = 'auto';
      if (onExit) onExit();
    } else {
      if (wrapperRef.current) {
        wrapperRef.current.requestFullscreen().then(() => {
          setIsBoardFullscreen(true);
          document.body.style.overflow = 'hidden';
        }).catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          setIsBoardFullscreen(true);
          document.body.style.overflow = 'hidden';
        });
      } else {
        setIsBoardFullscreen(true);
        document.body.style.overflow = 'hidden';
      }
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsBoardFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <div
      ref={wrapperRef}
      id="tactical-whiteboard"
      className={
        isBoardFullscreen
          ? "fixed inset-0 z-[100] bg-[#070a0f] p-0 overflow-hidden flex flex-col animate-fade-in"
          : "grid grid-cols-1 xl:grid-cols-4 gap-6 p-4 animate-fade-in"
      }
    >
      {/* 1. Left controls & saved tactics list */}
      {!isBoardFullscreen && (
        <div className="xl:col-span-1 space-y-4">
          
          {/* Jugada Loader Selector */}
          <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl shadow-xl">
            <label className="block text-2xs font-extrabold uppercase tracking-widest text-[#06b6d4] mb-3 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Jugadas Guardadas
            </label>
            {tactics.filter(t => t.type !== 'training').length === 0 ? (
              <p className="text-xs text-slate-500 py-2">Ninguna pizarra guardada aún.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {tactics.filter(t => t.type !== 'training').map((tac) => (
                  <div
                    key={tac.id}
                    className={`group/tac w-full flex items-center justify-between gap-1 p-1 rounded-xl border transition-all ${
                      selectedTacticId === tac.id
                        ? 'bg-indigo-600/10 border-indigo-500/35 text-indigo-400 font-bold'
                        : 'bg-[#0b0e14]/65 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => loadTacticData(tac)}
                      className="flex-1 text-left text-xs truncate px-2.5 py-1.5"
                    >
                      {tac.name}
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover/tac:opacity-100 transition-opacity pr-1">
                      <button
                        onClick={() => {
                          loadTacticData(tac);
                          setIsBoardFullscreen(true);
                        }}
                        className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg"
                        title="Ver en Grande"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={resetBoardToDefault}
              className="w-full mt-4 bg-[#0b0e14] hover:bg-slate-900 border border-slate-800 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Nueva Pizarra Limpia
            </button>
          </div>

          {/* Tactic Card Properties */}
          <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-2xs font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Guardar Como
            </h3>
            
            <div className="flex bg-[#0b0e14] p-1 rounded-xl border border-slate-850">
              <button
                onClick={() => setBoardType('tactic')}
                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                  boardType === 'tactic' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Táctica
              </button>
              <button
                onClick={() => setBoardType('training')}
                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                  boardType === 'training' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Entrenamiento
              </button>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Nombre</label>
              <input
                type="text"
                className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-700 transition outline-none"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                placeholder={boardType === 'tactic' ? "Ej: Contraataque rápido" : "Ej: Sesión técnica lunes"}
              />
            </div>

            {boardType === 'training' && (
              <>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold text-amber-500/80">Valoración ({boardRating} estrellas)</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setBoardRating(star)}
                        className={`text-lg transition-transform hover:scale-110 ${star <= boardRating ? 'text-amber-400' : 'text-slate-800'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-2 uppercase font-bold">Categorías</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(team.sport === 'waterpolo' 
                      ? ['piernas', 'chuts', 'partido', 'tactica', 'hombre de mas', 'contras', 'natacion', 'fisico', 'circuito', 'tecnica']
                      : ['físico', 'técnica', 'táctica', 'posesión', 'finalización', 'ABP', 'partido', 'circuito', 'velocidad', 'resistencia']
                    ).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setBoardCategories(prev => 
                            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                          );
                        }}
                        className={`text-[9px] px-2 py-1 rounded-full border transition-all ${
                          boardCategories.includes(cat)
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-[#0b0e14] border-slate-800 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Notas</label>
              <textarea
                rows={2}
                className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-700 transition resize-none leading-relaxed outline-none"
                value={boardDesc}
                onChange={(e) => setBoardDesc(e.target.value)}
                placeholder="Detalles adicionales..."
              />
            </div>

            <div className="flex gap-2 pt-1">
              {selectedTacticId && (
                <button
                  onClick={handleDeleteTactic}
                  className="w-10 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/45 rounded-xl flex items-center justify-center transition"
                  title="Eliminar jugada permanentemente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleSaveTactic}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition shadow shadow-indigo-500/10 flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Táctica
              </button>
            </div>
          </div>

          {/* Dynamic Whiteboard Brush Palette */}
          <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-2xs font-extrabold uppercase tracking-widest text-[#06b6d2] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Herramientas de Dibujo
            </h3>
            
            {/* Tool Selector */}
            <div className="flex bg-[#0b0e14] p-1 rounded-xl border border-slate-850">
              <button
                onClick={() => setIsErasing(false)}
                className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg text-[10px] font-bold transition-all ${
                  !isErasing ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Brush className="w-3.5 h-3.5" /> Lápiz
              </button>
              <button
                onClick={() => setIsErasing(true)}
                className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg text-[10px] font-bold transition-all ${
                  isErasing ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> Borrador
              </button>
            </div>

            {/* Brush Configs (Hidden if erasing) */}
            {!isErasing && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Brush Color Picker */}
                <div>
                  <span className="block text-[10px] text-slate-500 mb-2 uppercase font-mono">Color</span>
                  <div className="flex gap-2.5">
                    {['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#ffffff', '#9333ea'].map((col) => (
                      <button
                        key={col}
                        onClick={() => setBrushColor(col)}
                        className={`w-6 h-6 rounded-full border transform transition ${
                          brushColor === col ? 'scale-125 border-cyan-400 ring-2 ring-cyan-400/20' : 'border-slate-800/80 hover:scale-110'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>

                {/* Line styles */}
                <div>
                  <span className="block text-[10px] text-slate-500 mb-2 uppercase font-mono">Efecto del Trazo</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <button
                      onClick={() => setBrushStyle('solid')}
                      className={`py-2 px-1 rounded-lg border text-center font-bold tracking-tight transition-all duration-200 overflow-hidden text-ellipsis whitespace-nowrap ${
                        brushStyle === 'solid' ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 shadow-sm' : 'bg-[#0b0e14] border-slate-850 text-slate-400 hover:text-slate-300 hover:bg-[#161b26]'
                      }`}
                    >
                      Sólido
                    </button>
                    <button
                      onClick={() => setBrushStyle('dashed')}
                      className={`py-2 px-1 rounded-lg border text-center font-bold tracking-tight transition-all duration-200 overflow-hidden text-ellipsis whitespace-nowrap ${
                        brushStyle === 'dashed' ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 shadow-sm' : 'bg-[#0b0e14] border-slate-850 text-slate-400 hover:text-slate-300 hover:bg-[#161b26]'
                      }`}
                    >
                      Punteado
                    </button>
                    <button
                      onClick={() => setBrushStyle('arrow')}
                      className={`py-2 px-1 rounded-lg border text-center font-bold tracking-tight transition-all duration-200 col-span-2 overflow-hidden text-ellipsis whitespace-nowrap ${
                        brushStyle === 'arrow' ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 shadow-sm' : 'bg-[#0b0e14] border-slate-850 text-slate-400 hover:text-slate-300 hover:bg-[#161b26]'
                      }`}
                    >
                      Dirección / Flecha
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Width */}
            <div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5">
                <span className="uppercase font-mono">Grosor</span>
                <span className="font-mono text-slate-400">{brushWidth}px</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                value={brushWidth}
                onChange={(e) => setBrushWidth(Number(e.target.value))}
                className="w-full h-1 bg-[#0b0e14] rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <button
              onClick={() => setLines([])}
              className="w-full bg-red-950/10 hover:bg-red-950/30 border border-red-900/30 text-[10px] text-red-400 font-bold py-2 rounded-xl transition cursor-pointer"
            >
              Borrar Todos Los Trazos
            </button>
          </div>
        </div>
      )}

      {/* 2. WHITEBOARD DRAWING STAGE (STADIUM COURT) */}
      <div className={`${isBoardFullscreen ? "flex-1 w-full h-full relative flex flex-col items-center overflow-hidden" : "xl:col-span-2 flex flex-col items-center"}`}>
        
        {/* Fullscreen Tools Header */}
        {isBoardFullscreen && (
          <div className="w-full bg-[#161b26]/95 backdrop-blur-xl border-b border-white/5 py-3 px-6 flex items-center justify-between z-[120] shrink-0 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-[#0b0e14] rounded-xl border border-slate-800">
                <button
                  onClick={() => setIsErasing(false)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${!isErasing ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Lápiz"
                >
                  <Brush className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsErasing(!isErasing)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${isErasing ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Borrador"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>

              {!isErasing && (
                <div className="hidden lg:flex items-center gap-1.5 p-1 bg-[#0b0e14] rounded-xl border border-slate-800">
                  {['solid', 'dashed', 'arrow'].map((style) => (
                    <button
                      key={style}
                      onClick={() => setBrushStyle(style as any)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${brushStyle === style ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                    >
                      {style === 'solid' && <div className="w-4 h-0.5 bg-current" />}
                      {style === 'dashed' && <div className="w-4 h-0.5 border-t-2 border-dashed border-current" />}
                      {style === 'arrow' && <div className="w-4 h-4 border-r-2 border-t-2 border-current rotate-45 translate-x-[-1px] translate-y-[1px]" />}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-slate-800 mx-1" />
                  {['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#ffffff'].map((col) => (
                    <button
                      key={col}
                      onClick={() => setBrushColor(col)}
                      className={`w-5 h-5 rounded-full border-2 transition ${brushColor === col ? 'scale-110 border-white' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-tight transition-all ${isQuickAddOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-[#0b0e14] text-indigo-400 border border-slate-800 hover:bg-slate-800'}`}
              >
                <Users className="w-4 h-4" />
                <span>Jugadores</span>
              </button>
              <button
                onClick={() => setFieldOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b0e14] border border-slate-800 text-emerald-400 hover:bg-slate-800 transition-all font-bold text-xs uppercase"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Girar</span>
              </button>
              <div className="w-px h-6 bg-slate-800 mx-1" />
              <button
                onClick={() => setLines([])}
                className="px-4 py-2 rounded-xl bg-red-950/20 border border-red-900/30 text-red-500 text-xs font-black uppercase hover:bg-red-900/40 transition"
              >
                Limpiar
              </button>
              <button
                onClick={handleSaveTactic}
                className="px-6 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/40"
              >
                Guardar
              </button>
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-black uppercase hover:bg-slate-700 transition"
              >
                Salir
              </button>
            </div>
          </div>
        )}

        {/* Regular Header (Only non-fullscreen) */}
        {!isBoardFullscreen && (
          <div className="w-full max-w-lg mb-3 flex items-center justify-between px-1.5 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-indigo-400">
                Pizarra Digital ({team.sport === 'football' ? 'Fútbol' : 'Waterpolo'})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFieldOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
                className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider py-1.5 px-3 bg-[#161b26] hover:bg-slate-800 border border-slate-850 text-emerald-400 hover:emerald-300 rounded-xl transition cursor-pointer shadow-lg"
              >
                <span>{fieldOrientation === 'vertical' ? 'Vista Horizontal' : 'Vista Vertical'}</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider py-1.5 px-3 bg-[#161b26] hover:bg-slate-800 border border-slate-850 text-indigo-400 hover:text-indigo-300 rounded-xl transition cursor-pointer shadow-lg"
              >
                <Maximize2 className="w-3 h-3 text-indigo-400" />
                <span>Pantalla Completa</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Add Popup Panel */}
        {isQuickAddOpen && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[130] w-[90vw] max-w-[450px] bg-[#161b26]/95 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-fade-in">
            <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Añadir a la Pizarra
              </h4>
              <button 
                onClick={() => setIsQuickAddOpen(false)}
                className="text-slate-500 hover:text-white transition-colors p-1"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Left Col: Roster */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block border-l-2 border-indigo-500 pl-2">Tu Plantilla / Aliados</label>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  <button
                    onClick={() => addUtilityChip('ally')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-950/10 border border-indigo-900/20 hover:border-indigo-500/40 text-indigo-400 text-xs font-black uppercase transition-all"
                  >
                    <div className="w-4 h-4 rounded-full bg-indigo-600 shadow-lg shadow-indigo-900/40" />
                    <span>Añadir Aliado Genérico</span>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {players.length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic">No hay jugadores.</p>
                  ) : (
                    players.map((plr) => {
                      const isOnBoard = chips.some((c) => c.id === plr.id);
                      return (
                        <button
                          key={plr.id}
                          disabled={isOnBoard}
                          onClick={() => addPlayerChip(plr)}
                          className={`w-full text-left px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between transition-all ${
                            isOnBoard
                              ? 'bg-transparent border-slate-850 text-slate-600 cursor-not-allowed opacity-30 grayscale'
                              : 'bg-[#0b0e14]/40 border-slate-800/60 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-400 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#0b0e14] text-indigo-400 border border-slate-800">
                              {plr.number}
                            </span>
                            <span className="truncate">{plr.name}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Col: Rivals & Utilities */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block border-l-2 border-rose-500 pl-2">Rivales y Otros</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => addUtilityChip('opponent')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-950/10 border border-rose-900/20 hover:border-rose-500/40 text-rose-400 text-xs font-black uppercase transition-all"
                    >
                      <div className="w-4 h-4 rounded-full bg-rose-500 shadow-lg shadow-rose-900/40" />
                      <span>Rival</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => addUtilityChip('ball')}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-amber-950/10 border border-amber-900/20 hover:border-amber-500/40 text-amber-500 text-[10px] font-black uppercase transition-all"
                      >
                        <div className="w-4 h-4 rounded-full bg-amber-500 shadow-lg shadow-amber-900/40" />
                        <span>Balón</span>
                      </button>
                      <button
                        onClick={() => addUtilityChip('cone')}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-pink-950/10 border border-pink-900/20 hover:border-pink-500/40 text-pink-500 text-[10px] font-black uppercase transition-all"
                      >
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-pink-500" />
                        <span>Cono</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive canvas stage */}
        <div
          ref={containerRef}
          onPointerDown={handleCanvasStart}
          onPointerMove={handleCanvasMove}
          onPointerUp={handleCanvasEnd}
          onPointerLeave={handleCanvasEnd}
          className={`flex-1 w-full relative overflow-hidden bg-[#070a0f] flex items-center justify-center ${isBoardFullscreen ? "p-4 sm:p-8" : "pt-0"}`}
        >
          <div
            className={`relative rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.6)] border border-slate-850 select-none overflow-hidden touch-none transition-all duration-700 ${
              isBoardFullscreen 
                ? (fieldOrientation === 'vertical' ? "h-full aspect-[5/6] max-h-[calc(100vh-140px)]" : "w-full aspect-[16/9] max-w-[calc(100vw-64px)]")
                : (fieldOrientation === 'vertical' ? "w-full max-w-lg aspect-[5/6]" : "w-full max-w-2xl aspect-[16/9]")
            } ${
              team.sport === 'football'
                ? 'bg-[#1b4332] bg-gradient-to-b from-[#1b4332] to-[#0d2a1d]'
                : 'bg-[#142d4a] bg-gradient-to-b from-[#142d4a] to-[#091626]'
            }`}
          >
          {/* Top/Left Goal mesh */}
          <div
            className={`absolute rounded border-2 z-0 opacity-95 transition-all duration-500 ${
              fieldOrientation === 'vertical' 
                ? "top-0 left-1/2 -translate-x-1/2 w-28 h-4 rounded-t border-t-2 border-x-2" 
                : "left-0 top-1/2 -translate-y-1/2 w-4 h-28 rounded-l border-l-2 border-y-2"
            } ${
              team.sport === 'football' ? 'border-white bg-[#ffffff10]' : 'border-rose-500 bg-[rgba(244,63,94,0.15)]'
            }`}
            style={{
              backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.15) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.15) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.15) 75%)',
              backgroundSize: '4px 4px'
            }}
          />

          {/* Bottom/Right Goal mesh */}
          <div
            className={`absolute rounded border-2 z-0 opacity-95 transition-all duration-500 ${
              fieldOrientation === 'vertical' 
                ? "bottom-0 left-1/2 -translate-x-1/2 w-28 h-4 rounded-b border-b-2 border-x-2" 
                : "right-0 top-1/2 -translate-y-1/2 w-4 h-28 rounded-r border-r-2 border-y-2"
            } ${
              team.sport === 'football' ? 'border-white bg-[#ffffff10]' : 'border-rose-500 bg-[rgba(244,63,94,0.15)]'
            }`}
            style={{
              backgroundImage: 'linear-gradient(45deg, #ffffff15 25%, transparent 25%), linear-gradient(-45deg, #ffffff15 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ffffff15 75%), linear-gradient(-45deg, transparent 75%, #ffffff15 75%)',
              backgroundSize: '4px 4px'
            }}
          />

          {/* SPORT VENUE DECORATIONS (CSS PITCH / WHITE POOL BOUNDS) */}
          {team.sport === 'football' ? (
            <div className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-500">
              {/* Outer boundary padding line */}
              <div className="absolute inset-4 border border-white" />
              
              {/* Vertical Orientation Markings */}
              {fieldOrientation === 'vertical' ? (
                <>
                  <div className="absolute inset-x-4 top-1/2 h-[1px] bg-white" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white rounded-full" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full" />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-44 h-16 border-b border-x border-white" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-44 h-16 border-t border-x border-white" />
                </>
              ) : (
                <>
                  <div className="absolute inset-y-4 left-1/2 w-[1px] bg-white" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white rounded-full" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full" />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-44 border-r border-y border-white" />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-44 border-l border-y border-white" />
                </>
              )}
            </div>
          ) : (
            // Water polo field markers - using percentages for absolute precision in all sizes
            <div className="absolute inset-0 pointer-events-none opacity-25">
              {/* Pool boundaries */}
              <div className="absolute inset-4 border border-white" />
              
              {fieldOrientation === 'vertical' ? (
                <>
                  <div className="absolute inset-x-4 top-[50%] h-[2px] bg-white" />
                  {/* 2-meter Line (Red) */}
                  <div className="absolute top-[10%] inset-x-4 h-[1px] border-t border-dashed border-red-500" />
                  <span className="absolute top-[10.5%] left-6 text-[8px] font-bold text-red-500">LINEA 2m</span>
                  <div className="absolute bottom-[10%] inset-x-4 h-[1px] border-b border-dashed border-red-500" />
                  <span className="absolute bottom-[10.5%] left-6 text-[8px] font-bold text-red-500">LINEA 2m</span>
                  {/* 5-meter Line (Yellow) */}
                  <div className="absolute top-[20%] inset-x-4 h-[1px] border-t border-dashed border-yellow-400" />
                  <span className="absolute top-[20.5%] left-6 text-[8px] font-bold text-yellow-400">LINEA 5m</span>
                  <div className="absolute bottom-[20%] inset-x-4 h-[1px] border-b border-dashed border-yellow-400" />
                  <span className="absolute bottom-[20.5%] left-6 text-[8px] font-bold text-yellow-400">LINEA 5m</span>
                </>
              ) : (
                <>
                  <div className="absolute inset-y-4 left-[50%] w-[2px] bg-white" />
                  {/* 2-meter Line (Red) */}
                  <div className="absolute left-[8%] inset-y-4 w-[1px] border-r border-dashed border-red-500" />
                  <span className="absolute left-[8.5%] top-6 text-[8px] font-bold text-red-500 rotate-90 origin-left">LINEA 2m</span>
                  <div className="absolute right-[8%] inset-y-4 w-[1px] border-l border-dashed border-red-500" />
                  <span className="absolute right-[6%] top-6 text-[8px] font-bold text-red-500 rotate-90 origin-left">LINEA 2m</span>
                  {/* 5-meter Line (Yellow) */}
                  <div className="absolute left-[18%] inset-y-4 w-[1px] border-r border-dashed border-yellow-400" />
                  <span className="absolute left-[18.5%] top-6 text-[8px] font-bold text-yellow-400 rotate-90 origin-left">LINEA 5m</span>
                  <div className="absolute right-[18%] inset-y-4 w-[1px] border-l border-dashed border-yellow-400" />
                  <span className="absolute right-[16%] top-6 text-[8px] font-bold text-yellow-400 rotate-90 origin-left">LINEA 5m</span>
                </>
              )}
            </div>
          )}
 
          {/* HTML5 drawing canvas overlay */}
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasStart}
            onPointerMove={handleCanvasMove}
            onPointerUp={handleCanvasEnd}
            onPointerLeave={handleCanvasEnd}
            className="absolute inset-0 w-full h-full z-10 cursor-crosshair"
            style={{ touchAction: 'none' }}
          />
 
          {/* RENDERING PERSISTED DRAGGABLE TOKENS (CHIPS) */}
          {chips.map((chip) => (
            <div
              key={chip.id}
              className={`group absolute cursor-grab active:cursor-grabbing text-slate-900 flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 z-20 transition-all hover:scale-110 select-none ${
                chip.type === 'ball' ? 'w-6 h-6 rounded-full border-2 border-white' :
                chip.type === 'cone' ? 'w-7 h-7 bg-transparent border-0' :
                'w-10 h-10 rounded-full border-2 border-white shadow-xl font-extrabold text-sm'
              }`}
              style={{
                left: `${chip.x}%`,
                top: `${chip.y}%`,
                backgroundColor: chip.type === 'ball' || chip.type === 'cone' ? 'transparent' : chip.color,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleChipDragStart(chip.id);
              }}
            >
              {/* Ball specifics */}
              {chip.type === 'ball' && (
                <div className="w-full h-full rounded-full bg-amber-500 border-2 border-amber-950 flex items-center justify-center animate-spin-slow">
                  <div className="w-1.5 h-1.5 bg-black rounded-full" />
                </div>
              )}
              
              {/* Cone specifics */}
              {chip.type === 'cone' && (
                <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[24px] border-b-pink-500 relative flex justify-center">
                  <div className="absolute top-[16px] w-[6px] h-[3px] bg-white"></div>
                </div>
              )}
 
              {/* Player details */}
              {(chip.type === 'player' || chip.type === 'opponent') && (
                <div className="flex flex-col items-center text-center leading-none">
                  <span className="text-[11px] font-black tracking-tight text-white drop-shadow">
                    {chip.number !== undefined ? chip.number : ''}
                  </span>
                  <span className="text-[8px] font-semibold text-slate-100 uppercase opacity-90 block">
                    {chip.label.substring(0, 3)}
                  </span>
                </div>
              )}

              {/* Referee backup if loaded */}
              {chip.type === 'referee' && (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[8px] font-black text-slate-900 uppercase">ARB</span>
                </div>
              )}
 
              {/* Utility to delete individual chips */}
              <button
                onClick={(e) => handleChipRemove(chip.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:opacity-100 absolute -top-2.5 -right-2.5 bg-red-600 border border-slate-900 rounded-full h-4.5 w-4.5 text-white flex items-center justify-center text-[10px] hover:scale-120 z-35 transition cursor-pointer font-bold shadow-md"
                title="Quitar ficha"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
 
      {/* 3. RIGHT PANEL: WHITEBOARD CHIPS SQUAD ASSISTANT */}
      {!isBoardFullscreen && (
        <div className="xl:col-span-1 space-y-4">
          
          {/* Rapid tokens spawning kit */}
          <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl shadow-xl">
            <h3 className="text-2xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2.5 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 animate-pulse" /> Materiales / Accesorios
            </h3>
            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
              Añade complementos de entrenamiento directo al centro de tu pizarra con un simple click.
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-3xs font-bold text-center">
              <button
                onClick={() => addUtilityChip('ally')}
                className="p-3 border border-slate-800/80 rounded-xl bg-indigo-950/20 flex flex-col items-center gap-1.5 hover:text-indigo-300 hover:border-indigo-500/40 transition text-indigo-400 font-bold cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full bg-indigo-600 mt-1 shadow-sm border border-white/20"></div>
                <span>Aliado</span>
              </button>
              <button
                onClick={() => addUtilityChip('ball')}
                className="p-3 border border-slate-800/80 rounded-xl bg-[#0b0e14] flex flex-col items-center gap-1.5 hover:text-[#fbbf24] hover:border-slate-700 transition text-slate-400 font-bold cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full bg-amber-500 mt-1"></div>
                <span>Balón</span>
              </button>
              <button
                onClick={() => addUtilityChip('cone')}
                className="p-3 border border-slate-800/80 rounded-xl bg-[#0b0e14] flex flex-col items-center gap-1.5 hover:text-[#ec4899] hover:border-slate-700 transition text-slate-400 font-bold cursor-pointer"
              >
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-pink-500 mt-1"></div>
                <span>Cono</span>
              </button>
              <button
                onClick={() => addUtilityChip('opponent')}
                className="p-3 border border-slate-800/80 rounded-xl bg-[#0b0e14] flex flex-col items-center gap-1.5 hover:text-rose-400 hover:border-slate-700 transition text-slate-400 font-bold cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full bg-rose-500 mt-1 shadow-sm border border-white/20"></div>
                <span>Rival</span>
              </button>
            </div>
          </div>
   
          {/* Rapid Roster Spawning Kit */}
          <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl shadow-xl">
            <h3 className="text-2xs font-extrabold uppercase tracking-widest text-[#06b6d4] mb-2.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Incorporar Jugador (Plantilla)
            </h3>
            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
              Haz click para trasladar a tus jugadores registrados al campo. Sincroniza sus dorsales al instante.
            </p>
   
            {players.length === 0 ? (
              <div className="p-3 text-center border border-dashed border-slate-800/70 rounded-xl bg-[#0b0e14]/50">
                <p className="text-[10px] text-slate-500">No hay jugadores registrados. Ve a "Plantilla" para darlos de alta.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {players.map((plr) => {
                  const isOnBoard = chips.some((c) => c.id === plr.id);
                  return (
                    <button
                      key={plr.id}
                      disabled={isOnBoard}
                      onClick={() => addPlayerChip(plr)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition ${
                        isOnBoard
                          ? 'bg-[#0b0e14]/30 border-slate-850 text-slate-600 cursor-not-allowed opacity-50'
                          : 'bg-[#0b0e14] border-slate-800 hover:border-slate-700 text-slate-300 hover:text-indigo-400 font-semibold cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-mono font-black text-2xs px-1.5 py-0.5 rounded bg-[#161b26] text-indigo-400 border border-slate-800">
                          {plr.number}
                        </span>
                        <span className="truncate">{plr.name}</span>
                      </div>
                      <span className="text-[9px] text-[#10b981] font-bold tracking-wider shrink-0 uppercase">
                        {plr.position}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
