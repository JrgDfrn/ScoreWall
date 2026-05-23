/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Team, Player, Tactic, ChipState, LineDrawState } from '../types';
import { DB } from '../db';
import { Play, RotateCcw, Save, Trash2, Edit, ChevronRight, HelpCircle, Palette, Brush, Plus, PlayCircle, Maximize2, Minimize2 } from 'lucide-react';

interface TacticalWhiteboardProps {
  team: Team;
}

export default function TacticalWhiteboard({ team }: TacticalWhiteboardProps) {
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [selectedTacticId, setSelectedTacticId] = useState<string>('');
  const [boardName, setBoardName] = useState('Pizarra de Tácticas');
  const [boardDesc, setBoardDesc] = useState('');
  
  // Whiteboard Interactive States
  const [chips, setChips] = useState<ChipState[]>([]);
  const [lines, setLines] = useState<LineDrawState[]>([]);
  
  // Drawing configurations
  const [brushColor, setBrushColor] = useState('#ef4444'); // default neon red
  const [brushWidth, setBrushWidth] = useState(3);
  const [brushStyle, setBrushStyle] = useState<'solid' | 'dashed' | 'arrow'>('solid');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isBoardFullscreen, setIsBoardFullscreen] = useState(false);

  // Active dragging states
  const [draggingChipId, setDraggingChipId] = useState<string | null>(null);

  // Ref container to measure dynamic size for touch/mouse conversions
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

      if (savedTactics.length > 0) {
        loadTacticData(savedTactics[0]);
      } else {
        // Reset to initial empty board setup
        resetBoardToDefault();
      }
    } catch (e) {
      console.error('Failed to fetching tactics/roster:', e);
    }
  };

  useEffect(() => {
    fetchTacticsAndRoster();
  }, [team.id]);

  // Set up initial chips on the board based on sport
  const resetBoardToDefault = () => {
    setLines([]);
    setBoardName('Jugada de Ataque');
    setBoardDesc('Describe el movimiento estratégico aquí');
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

    // Draw all accumulated paths
    lines.forEach((line) => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;

      if (line.style === 'dashed') {
        ctx.setLineDash([8, 6]);
      } else {
        ctx.setLineDash([]);
      }

      // Start path
      const firstPixel = percentToPixels(line.points[0].x, line.points[0].y);
      ctx.moveTo(firstPixel.x, firstPixel.y);

      for (let i = 1; i < line.points.length; i++) {
        const p = percentToPixels(line.points[i].x, line.points[i].y);
        ctx.lineTo(p.x, p.y);
      }

      ctx.stroke();

      // If arrow style, draw a clean arrow head at the last point
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
    });
  };

  // Redraw Canvas drawings whenever lines state variables or dimensions change
  useEffect(() => {
    drawCanvas();
  }, [lines, chips]);

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
  }, [isBoardFullscreen, lines]);

  // Pointer event drawing handlers for 0ms lag
  const handleCanvasStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingChipId) return; // ignore if moving a chip instead
    e.preventDefault();
    isDrawingRef.current = true;
    setIsDrawing(true);

    const startPos = getRelativeCoords(e.clientX, e.clientY);
    activeLinePointsRef.current = [startPos];

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushWidth;
        if (brushStyle === 'dashed') {
          ctx.setLineDash([8, 6]);
        } else {
          ctx.setLineDash([]);
        }
        const p = percentToPixels(startPos.x, startPos.y);
        ctx.moveTo(p.x, p.y);
      }
    }
  };

  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeLinePointsRef.current.length === 0) return;
    e.preventDefault();

    const currentPos = getRelativeCoords(e.clientX, e.clientY);
    const lastPos = activeLinePointsRef.current[activeLinePointsRef.current.length - 1];

    // Throttle close points to avoid jitter
    if (Math.hypot(currentPos.x - lastPos.x, currentPos.y - lastPos.y) < 0.25) return;

    activeLinePointsRef.current.push(currentPos);

    // Draw segment directly onto layout immediately
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const p2 = percentToPixels(currentPos.x, currentPos.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  };

  const handleCanvasEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);

    if (activeLinePointsRef.current.length >= 2) {
      const newLine: LineDrawState = {
        id: 'line-' + Date.now().toString(),
        points: [...activeLinePointsRef.current],
        color: brushColor,
        width: brushWidth,
        style: brushStyle,
      };
      setLines((prev) => [...prev, newLine]);
    } else {
      drawCanvas();
    }
    activeLinePointsRef.current = [];
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
  const addUtilityChip = (type: 'ball' | 'cone' | 'referee' | 'opponent') => {
    if (type === 'opponent') {
      if (team.sport === 'waterpolo') {
        const oppPlayersCount = chips.filter((c) => c.type === 'opponent').length;
        if (oppPlayersCount >= 6) {
          alert('En waterpolo el límite es de 6 contra 6. No puedes añadir más de 6 jugadores contrarios.');
          return;
        }
      }

      const currentOpponents = chips.filter((c) => c.type === 'opponent');
      const num = currentOpponents.length + 1;
      const id = `opponent-${Date.now()}`;

      const newChip: ChipState = {
        id,
        label: `CON`,
        number: num,
        x: 45 + Math.random() * 10,
        y: 35 + Math.random() * 10,
        color: '#f43f5e', // beautiful distinct rose red
        type: 'opponent',
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
        id: selectedTacticId || 'tactic-' + Date.now().toString(),
        teamId: team.id,
        name: boardName.trim(),
        description: boardDesc.trim(),
        sport: team.sport,
        chips,
        lines,
        createdAt: new Date().toISOString(),
      };

      await DB.tactics.save(activeTactic);
      
      const savedTactics = await DB.tactics.list(team.id);
      setTactics(savedTactics);
      setSelectedTacticId(activeTactic.id);
      alert('Táctica guardada correctamente!');
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

  return (
    <div
      id="tactical-whiteboard"
      className={
        isBoardFullscreen
          ? "fixed inset-0 z-[100] bg-[#0c101a]/98 p-6 lg:p-10 overflow-y-auto grid grid-cols-1 xl:grid-cols-4 gap-8 animate-fade-in"
          : "grid grid-cols-1 xl:grid-cols-4 gap-6 p-4 animate-fade-in"
      }
    >
      {/* 1. Left controls & saved tactics list */}
      <div className="xl:col-span-1 space-y-4">
        
        {/* Jugada Loader Selector */}
        <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl shadow-xl">
          <label className="block text-2xs font-extrabold uppercase tracking-widest text-[#06b6d4] mb-3">
            📂 Jugadas Guardadas
          </label>
          {tactics.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">Ninguna pizarra guardada aún.</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {tactics.map((tac) => (
                <button
                  key={tac.id}
                  onClick={() => loadTacticData(tac)}
                  className={`w-full text-left text-xs px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition ${
                    selectedTacticId === tac.id
                      ? 'bg-indigo-600/10 border-indigo-500/35 text-indigo-400 font-bold'
                      : 'bg-[#0b0e14]/65 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="truncate pr-2">{tac.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                </button>
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
          <h3 className="text-2xs font-extrabold uppercase tracking-widest text-indigo-400">
            📝 Datos de la Jugada
          </h3>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Nombre Descriptivo</label>
            <input
              type="text"
              className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-700 transition outline-none"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Ej: Contraataque rápido 3-2"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Notas / Instrucción</label>
            <textarea
              rows={2}
              className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-700 transition resize-none leading-relaxed outline-none"
              value={boardDesc}
              onChange={(e) => setBoardDesc(e.target.value)}
              placeholder="Ej: El portero inicia rápido con pase directo de mano..."
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
            <Palette className="w-3.5 h-3.5" /> Estilo del Pincel / Trazos
          </h3>
          
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
            <div className="grid grid-cols-3 gap-1.5 text-3xs">
              <button
                onClick={() => setBrushStyle('solid')}
                className={`py-2 rounded-lg border text-center font-bold ${
                  brushStyle === 'solid' ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400' : 'bg-[#0b0e14] border-slate-850 text-slate-400 hover:text-slate-350'
                }`}
              >
                Continuo
              </button>
              <button
                onClick={() => setBrushStyle('dashed')}
                className={`py-2 rounded-lg border text-center font-bold ${
                  brushStyle === 'dashed' ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400' : 'bg-[#0b0e14] border-slate-850 text-slate-400 hover:text-slate-350'
                }`}
              >
                Discontinuo
              </button>
              <button
                onClick={() => setBrushStyle('arrow')}
                className={`py-2 rounded-lg border text-center font-bold ${
                  brushStyle === 'arrow' ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400' : 'bg-[#0b0e14] border-slate-850 text-slate-400 hover:text-slate-350'
                }`}
              >
                Flecha
              </button>
            </div>
          </div>

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

      {/* 2. WHITEBOARD DRAWING STAGE (STADIUM COURT) */}
      <div className="xl:col-span-2 flex flex-col items-center">
        
        {/* Fullscreen & Stats Display Header bar */}
        <div className="w-full max-w-lg mb-3 flex items-center justify-between px-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-indigo-400">
              Pizarra Digital ({team.sport === 'football' ? 'Fútbol' : 'Waterpolo'})
            </span>
            {team.sport === 'waterpolo' && (
              <span className="bg-cyan-550/10 border border-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                Modo 6v6 Activo
              </span>
            )}
          </div>
          <button
            onClick={() => setIsBoardFullscreen(!isBoardFullscreen)}
            className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-wider py-1.5 px-3 bg-[#161b26] hover:bg-slate-800 border border-slate-850 text-indigo-400 hover:text-indigo-300 rounded-xl transition cursor-pointer shadow-lg"
          >
            {isBoardFullscreen ? (
              <>
                <Minimize2 className="w-3 h-3 text-indigo-300" />
                <span>Cerrar Completo</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3 text-indigo-400" />
                <span>Pantalla Completa</span>
              </>
            )}
          </button>
        </div>

        {/* Interactive canvas element */}
        <div
          id="tactical-field-stage"
          ref={containerRef}
          onPointerMove={(e) => {
            if (draggingChipId) {
              updateChipPosition(e.clientX, e.clientY);
            }
          }}
          onPointerUp={() => {
            if (draggingChipId) setDraggingChipId(null);
          }}
          className={`w-full max-w-lg aspect-[5/6] relative rounded-3xl shadow-2xl border border-slate-850 select-none overflow-hidden touch-none flex flex-col justify-between ${
            team.sport === 'football'
              ? 'bg-[#1b4332] bg-gradient-to-b from-[#1b4332] to-[#0d2a1d]'
              : 'bg-[#142d4a] bg-gradient-to-b from-[#142d4a] to-[#091626]'
          }`}
        >
          {/* Top Goal mesh */}
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 rounded-t border-t-2 border-x-2 z-0 opacity-95 ${
              team.sport === 'football' ? 'border-white bg-[#ffffff10]' : 'border-red-550 bg-[#f43f5e15]'
            }`}
            style={{
              backgroundImage: 'linear-gradient(45deg, #ffffff15 25%, transparent 25%), linear-gradient(-45deg, #ffffff15 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ffffff15 75%), linear-gradient(-45deg, transparent 75%, #ffffff15 75%)',
              backgroundSize: '4px 4px'
            }}
          />

          {/* Bottom Goal mesh */}
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-4 rounded-b border-b-2 border-x-2 z-0 opacity-95 ${
              team.sport === 'football' ? 'border-white bg-[#ffffff10]' : 'border-red-550 bg-[#f43f5e15]'
            }`}
            style={{
              backgroundImage: 'linear-gradient(45deg, #ffffff15 25%, transparent 25%), linear-gradient(-45deg, #ffffff15 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ffffff15 75%), linear-gradient(-45deg, transparent 75%, #ffffff15 75%)',
              backgroundSize: '4px 4px'
            }}
          />

          {/* SPORT VENUE DECORATIONS (CSS PITCH / WHITE POOL BOUNDS) */}
          {team.sport === 'football' ? (
            <div className="absolute inset-0 pointer-events-none opacity-20">
              {/* Outer boundary padding line */}
              <div className="absolute inset-4 border border-white" />
              {/* Center Line */}
              <div className="absolute inset-x-4 top-1/2 h-[1px] bg-white" />
              {/* Center Circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full" />
              
              {/* Top Penalty Box */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-44 h-16 border-b border-x border-white" />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 border-b border-x border-white opacity-80" />
              <div className="absolute top-14 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
 
              {/* Bottom Penalty Box */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-44 h-16 border-t border-x border-white" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-6 border-t border-x border-white opacity-80" />
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
            </div>
          ) : (
            // Water polo field markers
            <div className="absolute inset-0 pointer-events-none opacity-25">
              {/* Pool boundaries */}
              <div className="absolute inset-4 border border-white" />
              
              {/* Center Line (White line) */}
              <div className="absolute inset-x-4 top-1/2 h-[2px] bg-white" />
              
              {/* 2-meter Line (Red markers near the goal lines) */}
              <div className="absolute top-16 inset-x-4 h-[1px] bg-red-500 border-t border-dashed border-red-500" />
              <span className="absolute top-[68px] left-6 text-[8px] font-bold text-red-500">LINEA 2m</span>
              <div className="absolute bottom-16 inset-x-4 h-[1px] bg-red-500 border-t border-dashed border-red-500" />
              <span className="absolute bottom-[68px] left-6 text-[8px] font-bold text-red-500">LINEA 2m</span>
 
              {/* 5-meter Line (Yellow markers) */}
              <div className="absolute top-28 inset-x-4 h-[1px] bg-yellow-400 border-t border-dashed border-yellow-400" />
              <span className="absolute top-[116px] left-6 text-[8px] font-bold text-yellow-400">LINEA 5m</span>
              <div className="absolute bottom-28 inset-x-4 h-[1px] bg-yellow-400 border-t border-dashed border-yellow-400" />
              <span className="absolute bottom-[116px] left-6 text-[8px] font-bold text-yellow-400">LINEA 5m</span>
            </div>
          )}
 
          {/* HTML5 drawing canvas overlay */}
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasStart}
            onPointerMove={handleCanvasMove}
            onPointerUp={handleCanvasEnd}
            onPointerLeave={handleCanvasEnd}
            className="absolute inset-0 z-10 cursor-crosshair"
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
 
          {/* Guide tip footer bar */}
          <div className="w-full bg-[#161b26]/95 border-t border-slate-900 text-slate-400 p-2 text-[10px] text-center z-12 select-none pointer-events-none flex items-center justify-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Dibuja con el puntero en la pizarra. Arrastra fichas para mover tácticas.</span>
          </div>
        </div>
      </div>
 
      {/* 3. RIGHT PANEL: WHITEBOARD CHIPS SQUAD ASSISTANT */}
      <div className="xl:col-span-1 space-y-4">
        
        {/* Rapid tokens spawning kit */}
        <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl shadow-xl">
          <h3 className="text-2xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 animate-pulse" /> Materiales / Accesorios
          </h3>
          <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
            Añade complementos de entrenamiento directo al centro de tu pizarra con un simple click.
          </p>
          <div className="grid grid-cols-3 gap-2.5 text-3xs font-bold text-center">
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
          <h3 className="text-2xs font-extrabold uppercase tracking-widest text-[#06b6d4] mb-2.5">
            🏃 Incorporar Jugador (Plantilla)
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
    </div>
  );
}
