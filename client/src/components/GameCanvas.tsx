import { useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricImage } from 'fabric';
import type { Card, Player, Action } from '@zaff/shared';
import { ActionTypes } from '@zaff/shared';

/** Standard MTG card back from Scryfall */
const CARD_BACK_URL = 'https://cards.scryfall.io/back.png';

interface GameCanvasProps {
  cards: Card[];
  players: Record<string, Player>;
  playerId: string;
  sendAction: (action: Action) => void;
}

/** Card dimensions on canvas (MTG aspect ratio ~63:88 ≈ 5:7) */
const CARD_WIDTH = 120;
const CARD_HEIGHT = 168;

/** Small pixel offset per card in a stack so the pile has visual depth */
const STACK_OFFSET = 0.4;

/** Margin from edges for deck stacks */
const DECK_MARGIN = 40;

/** Seat → color mapping */
const SEAT_COLORS: Record<string, string> = {
  south: '#ef4444', // red
  north: '#3b82f6', // blue
  east: '#eab308',  // yellow
  west: '#22c55e',  // green
};

const DEFAULT_COLOR = '#a855f7'; // purple fallback

type Seat = 'south' | 'north' | 'east' | 'west';

/** Returns the deck stack origin for a given seat relative to canvas size */
function seatPosition(seat: Seat, canvasW: number, canvasH: number): { x: number; y: number } {
  switch (seat) {
    case 'south':
      return { x: DECK_MARGIN, y: canvasH - CARD_HEIGHT - DECK_MARGIN };
    case 'north':
      return { x: canvasW - CARD_WIDTH - DECK_MARGIN, y: DECK_MARGIN };
    case 'east':
      return { x: canvasW - CARD_WIDTH - DECK_MARGIN, y: canvasH - CARD_HEIGHT - DECK_MARGIN };
    case 'west':
      return { x: DECK_MARGIN, y: DECK_MARGIN };
    default:
      return { x: DECK_MARGIN, y: canvasH - CARD_HEIGHT - DECK_MARGIN };
  }
}

/** Get the player color based on their seat */
function getPlayerColor(players: Record<string, Player>, playerId: string): string {
  const player = players[playerId];
  if (!player) return DEFAULT_COLOR;
  return SEAT_COLORS[player.seat] ?? DEFAULT_COLOR;
}

/**
 * FabricJS canvas that renders all players' cards on a shared table.
 * Cards start stacked at each player's corner based on their seat.
 * Own cards are selectable and draggable.
 * Selection and movement are synced via WebSocket actions.
 */
export default function GameCanvas({ cards, players, playerId, sendAction }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  // Map instanceId → fabric object on canvas
  const objectMapRef = useRef<Map<string, FabricImage>>(new Map());
  // Track which instanceId is being dragged locally (skip position updates from server)
  const draggingRef = useRef<string | null>(null);
  // Throttle timer for CARD_MOVING
  const moveThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoveTimeRef = useRef(0);

  // Initialize fabric canvas and handle resize
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: '#1a1a2e',
      selection: false, // no group selection, only individual card selection
    });
    fabricRef.current = canvas;

    function resize() {
      if (!containerRef.current || !fabricRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      fabricRef.current.setDimensions({ width, height });
    }

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (moveThrottleRef.current) clearTimeout(moveThrottleRef.current);
      canvas.dispose();
      fabricRef.current = null;
      objectMapRef.current.clear();
    };
  }, []);

  // Wire up fabric events for selection and movement
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    function getInstanceId(obj: unknown): string | undefined {
      return (obj as Record<string, unknown>)?._cardInstanceId as string | undefined;
    }

    function handleSelected(e: { selected?: unknown[] }) {
      const selected = e.selected;
      if (!selected || selected.length === 0) return;
      const instanceId = getInstanceId(selected[0]);
      if (!instanceId) return;
      sendAction({
        type: ActionTypes.CARD_SELECTED,
        payload: { instanceId },
      });
    }

    function handleDeselected() {
      sendAction({
        type: ActionTypes.CARD_SELECTED,
        payload: { instanceId: '' },
      });
    }

    function handleMoving(e: { target?: unknown }) {
      const obj = e.target as { left?: number; top?: number } | undefined;
      if (!obj) return;
      const instanceId = getInstanceId(e.target);
      if (!instanceId) return;

      draggingRef.current = instanceId;

      const now = Date.now();
      const elapsed = now - lastMoveTimeRef.current;

      if (elapsed >= 100) {
        lastMoveTimeRef.current = now;
        sendAction({
          type: ActionTypes.CARD_MOVING,
          payload: { instanceId, x: obj.left ?? 0, y: obj.top ?? 0 },
        });
      } else if (!moveThrottleRef.current) {
        moveThrottleRef.current = setTimeout(() => {
          moveThrottleRef.current = null;
          lastMoveTimeRef.current = Date.now();
          // Re-read position from the fabric object in case it moved further
          const currentObj = objectMapRef.current.get(instanceId);
          if (currentObj) {
            sendAction({
              type: ActionTypes.CARD_MOVING,
              payload: { instanceId, x: currentObj.left ?? 0, y: currentObj.top ?? 0 },
            });
          }
        }, 100 - elapsed);
      }
    }

    function handleDragEnd(e: { target?: unknown }) {
      const instanceId = getInstanceId(e.target);
      if (!instanceId) return;
      draggingRef.current = null;

      // Send final position
      if (moveThrottleRef.current) {
        clearTimeout(moveThrottleRef.current);
        moveThrottleRef.current = null;
      }
      const obj = e.target as { left?: number; top?: number };
      sendAction({
        type: ActionTypes.CARD_MOVING,
        payload: { instanceId, x: obj.left ?? 0, y: obj.top ?? 0 },
      });
    }

    function handleDblClick(e: { target?: unknown }) {
      if (!e.target) return;
      const instanceId = getInstanceId(e.target);
      if (!instanceId) return;
      sendAction({
        type: ActionTypes.REVEAL_CARD,
        payload: { instanceId },
      });
    }

    function handleContextMenu(e: { target?: unknown; e?: Event }) {
      // Prevent browser context menu
      if (e.e) e.e.preventDefault();
      if (!e.target) return;
      const instanceId = getInstanceId(e.target);
      if (!instanceId) return;
      sendAction({
        type: ActionTypes.TAP_CARD,
        payload: { instanceId },
      });
    }

    canvas.on('selection:created', handleSelected);
    canvas.on('selection:updated', handleSelected);
    canvas.on('selection:cleared', handleDeselected);
    canvas.on('object:moving', handleMoving);
    canvas.on('object:modified', handleDragEnd);
    canvas.on('mouse:dblclick', handleDblClick);
    canvas.on('mouse:down', (e: { target?: unknown; e?: Event }) => {
      if (e.e && (e.e as MouseEvent).button === 2) {
        handleContextMenu(e);
      }
    });

    // Disable browser context menu on the canvas element
    const canvasEl = canvas.getSelectionElement();
    const preventCtx = (ev: Event) => ev.preventDefault();
    canvasEl.addEventListener('contextmenu', preventCtx);

    return () => {
      canvas.off('selection:created', handleSelected);
      canvas.off('selection:updated', handleSelected);
      canvas.off('selection:cleared', handleDeselected);
      canvas.off('object:moving', handleMoving);
      canvas.off('object:modified', handleDragEnd);
      canvas.off('mouse:dblclick', handleDblClick);
      // mouse:down handlers are anonymous, canvas.dispose cleans them
      canvasEl.removeEventListener('contextmenu', preventCtx);
    };
  }, [sendAction]);

  const addCardToCanvas = useCallback(
    (card: Card, stackIndex: number, canvasW: number, canvasH: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const objectMap = objectMapRef.current;
      if (objectMap.has(card.instanceId)) return;

      // Find the owner's seat to determine stack position
      const owner = players[card.ownerId];
      const seat = (owner?.seat || 'south') as Seat;
      const origin = seatPosition(seat, canvasW, canvasH);

      // Use card x/y from state if set, otherwise stack position
      const x = (card.x !== 0 || card.y !== 0) ? card.x : origin.x + stackIndex * STACK_OFFSET;
      const y = (card.x !== 0 || card.y !== 0) ? card.y : origin.y - stackIndex * STACK_OFFSET;

      const isOwn = card.ownerId === playerId;
      const imageUrl = card.faceDown ? CARD_BACK_URL : card.imageUrl;

      // Determine selection border color
      const selectionColor = getPlayerColor(players, playerId);

      FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then(
        (img) => {
          if (!fabricRef.current) return;
          if (objectMap.has(card.instanceId)) return;

          img.set({
            left: x,
            top: y,
            scaleX: CARD_WIDTH / (img.width || CARD_WIDTH),
            scaleY: CARD_HEIGHT / (img.height || CARD_HEIGHT),
            selectable: isOwn,
            evented: isOwn,
            hasControls: false,
            hasBorders: true,
            borderColor: selectionColor,
            borderScaleFactor: 2.5,
          });

          // Apply stroke if another player has this card selected
          if (card.selectedBy && card.selectedBy !== playerId) {
            const selectorColor = getPlayerColor(players, card.selectedBy);
            img.set({
              stroke: selectorColor,
              strokeWidth: 3,
              strokeUniform: true,
            });
          }

          // Apply initial rotation if card is tapped
          if (card.rotation !== 0) {
            const scaleX = img.scaleX ?? 1;
            const scaleY = img.scaleY ?? 1;
            const px = (CARD_WIDTH / 2) * scaleX;
            const py = (CARD_HEIGHT - CARD_WIDTH / 2) * scaleY;
            const rad = (card.rotation * Math.PI) / 180;
            const newLeft = x + px - px * Math.cos(rad) + py * Math.sin(rad);
            const newTop = y + py - px * Math.sin(rad) - py * Math.cos(rad);
            img.set({ angle: card.rotation, left: newLeft, top: newTop });
          }

          // Tag with game data
          const data = img as unknown as Record<string, unknown>;
          data._cardInstanceId = card.instanceId;
          data._cardOwnerId = card.ownerId;
          data._faceDown = card.faceDown;

          objectMap.set(card.instanceId, img);
          fabricRef.current!.add(img);
        },
      );
    },
    [players, playerId],
  );

  // Sync cards onto the canvas whenever the card list or players change
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !containerRef.current) return;

    const { width: canvasW, height: canvasH } = containerRef.current.getBoundingClientRect();
    const objectMap = objectMapRef.current;

    // Only show cards whose owner is connected
    const connectedPlayerIds = new Set(
      Object.entries(players)
        .filter(([, p]) => p.connected)
        .map(([id]) => id),
    );

    const visibleCards = cards.filter((c) => connectedPlayerIds.has(c.ownerId));
    const visibleIds = new Set(visibleCards.map((c) => c.instanceId));

    // Remove cards no longer visible
    for (const [instanceId, obj] of objectMap) {
      if (!visibleIds.has(instanceId)) {
        canvas.remove(obj);
        objectMap.delete(instanceId);
      }
    }

    // Build a map for quick card lookup
    const cardMap = new Map(visibleCards.map((c) => [c.instanceId, c]));

    // Update existing cards: position, rotation, faceDown, and selection visuals
    for (const [instanceId, obj] of objectMap) {
      const card = cardMap.get(instanceId);
      if (!card) continue;

      // Update position from server state (skip if being dragged locally)
      if (draggingRef.current !== instanceId && (card.x !== 0 || card.y !== 0)) {
        obj.set({ left: card.x, top: card.y });
        obj.setCoords();
      }

      // Update rotation (tap/untap) with origin at center-x, bottom minus half-width
      const currentAngle = obj.angle ?? 0;
      if (card.rotation !== currentAngle) {
        // Origin: centered horizontally, half card-width up from bottom
        const originX = CARD_WIDTH / 2;
        const originY = CARD_HEIGHT - CARD_WIDTH / 2;
        const scaleX = obj.scaleX ?? 1;
        const scaleY = obj.scaleY ?? 1;

        // Convert custom origin to absolute point, rotate, reposition
        const radOld = (currentAngle * Math.PI) / 180;
        const radNew = (card.rotation * Math.PI) / 180;
        // Pivot in scaled coordinates
        const px = originX * scaleX;
        const py = originY * scaleY;
        const left = obj.left ?? 0;
        const top = obj.top ?? 0;
        // Absolute pivot position (current)
        const pivotX = left + px * Math.cos(radOld) - py * Math.sin(radOld);
        const pivotY = top + px * Math.sin(radOld) + py * Math.cos(radOld);
        // New top-left so pivot stays in place
        const newLeft = pivotX - px * Math.cos(radNew) + py * Math.sin(radNew);
        const newTop = pivotY - px * Math.sin(radNew) - py * Math.cos(radNew);

        obj.set({ angle: card.rotation, left: newLeft, top: newTop });
        obj.setCoords();
      }

      // Update face (reveal/hide) — swap image when faceDown state changes
      const currentFaceDown = (obj as unknown as Record<string, unknown>)._faceDown as boolean | undefined;
      if (currentFaceDown !== undefined && currentFaceDown !== card.faceDown) {
        const newUrl = card.faceDown ? CARD_BACK_URL : card.imageUrl;
        FabricImage.fromURL(newUrl, { crossOrigin: 'anonymous' }).then((newImg) => {
          if (!fabricRef.current) return;
          const source = newImg.getElement();
          obj.setElement(source);
          obj.set({
            scaleX: CARD_WIDTH / (newImg.width || CARD_WIDTH),
            scaleY: CARD_HEIGHT / (newImg.height || CARD_HEIGHT),
          });
          (obj as unknown as Record<string, unknown>)._faceDown = card.faceDown;
          fabricRef.current!.requestRenderAll();
        });
      }

      // Update selection stroke for other players' selections
      if (card.selectedBy && card.selectedBy !== playerId) {
        const selectorColor = getPlayerColor(players, card.selectedBy);
        obj.set({
          stroke: selectorColor,
          strokeWidth: 3,
          strokeUniform: true,
        });
      } else if (!card.selectedBy || card.selectedBy === playerId) {
        // Clear stroke if no one else is selecting, or only I am
        obj.set({
          stroke: undefined,
          strokeWidth: 0,
        });
      }
    }

    // Group new cards by owner for stack indexing
    const byOwner = new Map<string, Card[]>();
    for (const card of visibleCards) {
      if (objectMap.has(card.instanceId)) continue; // already on canvas
      let group = byOwner.get(card.ownerId);
      if (!group) {
        group = [];
        byOwner.set(card.ownerId, group);
      }
      group.push(card);
    }

    // Count existing cards per owner for correct stack offset
    const existingCountByOwner = new Map<string, number>();
    for (const card of visibleCards) {
      if (!objectMap.has(card.instanceId)) continue;
      existingCountByOwner.set(card.ownerId, (existingCountByOwner.get(card.ownerId) ?? 0) + 1);
    }

    // Add new cards
    for (const [ownerId, ownerCards] of byOwner) {
      const existingCount = existingCountByOwner.get(ownerId) ?? 0;
      ownerCards.forEach((card, i) => {
        addCardToCanvas(card, existingCount + i, canvasW, canvasH);
      });
    }

    canvas.requestRenderAll();
  }, [cards, players, playerId, addCardToCanvas]);

  return (
    <div ref={containerRef} className="absolute inset-0 top-10">
      <canvas ref={canvasRef} />
    </div>
  );
}
