<script setup lang="ts">
import { computed } from "vue";
import { computeBoardLayout, playerColorHex, type CellPos } from "./board-geometry";
import { HOME_COLUMN_LENGTH, findBlocks, parseCell, startSquare } from "@ludo/shared";
import type { Seat, Token } from "@ludo/shared";

const props = defineProps<{
  boardSize: number;
  localSeat?: number;
  tokens?: Token[];
  legalTokenIds?: string[];
  animatingTokenId?: string;
  hiddenStackBadgeCellId?: string;
  seats?: Seat[];
}>();

const emit = defineEmits<{
  move: [tokenId: string];
}>();

/** 5-pointed star path, outer radius 10, centered at origin, pointing up. */
const STAR_PATH =
  "M0,-10 L2.351,-3.236 L9.511,-3.09 L3.804,1.236 L5.878,8.09 L0,4 L-5.878,8.09 L-3.804,1.236 L-9.511,-3.09 L-2.351,-3.236 Z";

const legalSet = computed(() => new Set(props.legalTokenIds ?? []));

const layout = computed(() => computeBoardLayout(props.boardSize));

/** Rotation (degrees) so the local seat arm points to the bottom. */
const rotation = computed(() => {
  if (!props.localSeat) return 0;
  return 180 - (props.localSeat - 1) * (360 / props.boardSize);
});

/** Set of safe square cell IDs for quick lookup. */
const safeSquares = computed(() => {
  const set = new Set<string>();
  for (let si = 1; si <= props.boardSize; si++) {
    set.add(startSquare(si, props.boardSize));
  }
  return set;
});

/** Map cell ID → position for token placement. */
const cellPositions = computed(() => {
  const map = new Map<string, CellPos>();
  for (const c of layout.value.track) map.set(c.id, c);
  for (const cols of layout.value.homes) for (const c of cols) map.set(c.id, c);
  for (const yard of layout.value.yards) for (const c of yard) map.set(c.id, c);
  return map;
});

/**
 * Finished tokens (those that reached H/seat/L) share a single logical cell.
 * Fan them out across any unoccupied cells in the home column so they don't
 * visually stack.
 */
const homeDisplayOverrides = computed(() => {
  const tokens = props.tokens ?? [];
  const occupied = new Map<number, Set<number>>();
  const finished = new Map<number, Token[]>();

  for (const token of tokens) {
    const p = parseCell(token.cell);
    if (p.kind !== "home") continue;
    if (p.index < HOME_COLUMN_LENGTH) {
      let set = occupied.get(p.seat);
      if (!set) occupied.set(p.seat, (set = new Set()));
      set.add(p.index);
    } else {
      let group = finished.get(p.seat);
      if (!group) finished.set(p.seat, (group = []));
      group.push(token);
    }
  }

  const overrides = new Map<string, string>();
  for (const [seat, group] of finished) {
    const taken = occupied.get(seat) ?? new Set<number>();
    let slot = HOME_COLUMN_LENGTH;
    for (const token of group) {
      while (slot > 0 && taken.has(slot)) slot -= 1;
      overrides.set(token.id, `H/${seat}/${slot > 0 ? slot : HOME_COLUMN_LENGTH}`);
      slot -= 1;
    }
  }
  return overrides;
});

function displayCellOf(token: Token): string {
  return homeDisplayOverrides.value.get(token.id) ?? token.cell;
}

const renderedTokens = computed(() => {
  const tokens = props.tokens ?? [];
  if (!props.animatingTokenId) return tokens;
  const animatingId = props.animatingTokenId;
  return [
    ...tokens.filter((token) => token.id !== animatingId),
    ...tokens.filter((token) => token.id === animatingId),
  ];
});

/** Map seat index (1-based) → CSS hex color from actual seat data. */
const seatColorMap = computed(() => {
  const map = new Map<number, string>();
  if (props.seats) {
    for (const seat of props.seats) {
      map.set(seat.index, playerColorHex(seat.color));
    }
  }
  return map;
});

function resolvedSeatColor(seatIndex: number): string {
  return seatColorMap.value.get(seatIndex) ?? "#888";
}

/** Map cell ID → token count for cells with 2+ tokens (for stack badge). */
const stackedCells = computed(() => {
  const tokens = props.tokens ?? [];
  const counts = new Map<string, number>();
  for (const token of tokens) {
    const cell = displayCellOf(token);
    counts.set(cell, (counts.get(cell) ?? 0) + 1);
  }
  return new Map(
    [...counts].filter(([cellId, count]) => count >= 2 && cellId !== props.hiddenStackBadgeCellId),
  );
});

/** Track cells that are blocks (2+ same-color tokens): Map<cellId, hexColor>. */
const blockedTrackCells = computed(() => {
  if (!props.tokens) return new Map<string, string>();
  const blocks = findBlocks(props.tokens);
  const result = new Map<string, string>();
  for (const [cell, color] of blocks) {
    result.set(cell, playerColorHex(color));
  }
  return result;
});

/** Color each start square to its seat color. */
function startSquareColor(cellId: string): string | null {
  for (let si = 1; si <= props.boardSize; si++) {
    if (cellId === startSquare(si, props.boardSize)) return resolvedSeatColor(si);
  }
  return null;
}
</script>

<template>
  <svg
    :viewBox="layout.viewBox"
    :style="{ transform: `rotate(${rotation}deg)` }"
    class="bg-frost w-full h-full rounded-lg transition-transform duration-500"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Track cells -->
    <template v-for="cell in layout.track" :key="cell.id">
      <circle
        :cx="cell.x"
        :cy="cell.y"
        :r="layout.cellSize"
        :fill="startSquareColor(cell.id) ?? 'var(--color-board-cell)'"
        :opacity="startSquareColor(cell.id) ? 0.7 : 1"
        :stroke="startSquareColor(cell.id) ?? 'var(--color-board-cell-edge)'"
        :stroke-width="layout.cellSize * 0.15"
      />
      <!-- Block indicator ring (2 same-color tokens on this cell) -->
      <circle
        v-if="blockedTrackCells.has(cell.id)"
        :cx="cell.x"
        :cy="cell.y"
        :r="layout.cellSize * 0.85"
        fill="none"
        :stroke="blockedTrackCells.get(cell.id)"
        :stroke-width="layout.cellSize * 0.18"
        stroke-opacity="0.75"
      />
      <!-- Safe marker (star) -->
      <path
        v-if="safeSquares.has(cell.id)"
        :d="STAR_PATH"
        fill="var(--color-board-star)"
        :opacity="startSquareColor(cell.id) ? 0.7 : 1"
        :transform="`translate(${cell.x} ${cell.y}) rotate(${-rotation}) scale(${layout.cellSize * 0.05})`"
      />
    </template>

    <!-- Home columns -->
    <template v-for="(homeCol, si) in layout.homes" :key="`home-${si}`">
      <circle
        v-for="cell in homeCol"
        :key="cell.id"
        :cx="cell.x"
        :cy="cell.y"
        :r="layout.cellSize"
        :fill="resolvedSeatColor(si + 1)"
        :opacity="0.7"
        :stroke="resolvedSeatColor(si + 1)"
        :stroke-width="layout.cellSize * 0.15"
        stroke-opacity="0.5"
      />
    </template>

    <!-- Yards -->
    <template v-for="(yardCells, si) in layout.yards" :key="`yard-${si}`">
      <circle
        v-for="cell in yardCells"
        :key="cell.id"
        :cx="cell.x"
        :cy="cell.y"
        :r="layout.cellSize"
        :fill="resolvedSeatColor(si + 1)"
        :opacity="0.7"
        :stroke="resolvedSeatColor(si + 1)"
        :stroke-width="layout.cellSize * 0.15"
        stroke-opacity="0.4"
      />
    </template>

    <!-- Tokens -->
    <template v-if="tokens">
      <circle
        v-for="token in renderedTokens"
        :key="token.id"
        :cx="cellPositions.get(displayCellOf(token))?.x ?? 0"
        :cy="cellPositions.get(displayCellOf(token))?.y ?? 0"
        :r="layout.cellSize * 0.7"
        :fill="playerColorHex(token.color)"
        stroke="var(--color-board-ink)"
        :stroke-width="layout.cellSize * 0.12"
        :class="['transition-all duration-300', legalSet.has(token.id) && 'legal-token']"
        @click="legalSet.has(token.id) && emit('move', token.id)"
      />
    </template>

    <!-- Token stack badges: small count badge when 2+ tokens share a cell -->
    <template v-if="tokens">
      <template v-for="[cellId, count] in stackedCells" :key="`badge-${cellId}`">
        <circle
          :cx="(cellPositions.get(cellId)?.x ?? 0) + layout.cellSize * 0.5"
          :cy="(cellPositions.get(cellId)?.y ?? 0) - layout.cellSize * 0.5"
          :r="layout.cellSize * 0.35"
          fill="var(--color-board-ink)"
        />
        <text
          :x="(cellPositions.get(cellId)?.x ?? 0) + layout.cellSize * 0.5"
          :y="(cellPositions.get(cellId)?.y ?? 0) - layout.cellSize * 0.5"
          text-anchor="middle"
          dominant-baseline="central"
          :font-size="layout.cellSize * 0.45"
          fill="white"
          font-weight="bold"
          :style="{
            transform: `rotate(${-rotation}deg)`,
            transformOrigin: `${(cellPositions.get(cellId)?.x ?? 0) + layout.cellSize * 0.5}px ${(cellPositions.get(cellId)?.y ?? 0) - layout.cellSize * 0.5}px`,
          }"
        >
          {{ count }}
        </text>
      </template>
    </template>
  </svg>
</template>

<style scoped>
.legal-token {
  cursor: pointer;
  transform-box: fill-box;
  transform-origin: center;
  animation: legal-token-pulse 0.9s ease-in-out infinite;
}

@keyframes legal-token-pulse {
  0%,
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.7));
  }
  50% {
    transform: scale(1.18);
    filter: drop-shadow(0 0 7px rgba(255, 255, 255, 1));
  }
}
</style>
