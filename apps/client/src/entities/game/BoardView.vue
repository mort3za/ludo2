<script setup lang="ts">
import { computed } from "vue";
import { computeBoardLayout, playerColorHex, type CellPos } from "./board-geometry";
import { startSquare, findBlocks } from "@ludo/shared";
import type { Token, Seat } from "@ludo/shared";

const props = defineProps<{
  boardSize: number;
  localSeat?: number;
  tokens?: Token[];
  legalTokenIds?: string[];
  seats?: Seat[];
}>();

const emit = defineEmits<{
  move: [tokenId: string];
}>();

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
  if (!props.tokens) return new Map<string, number>();
  const counts = new Map<string, number>();
  for (const token of props.tokens) {
    counts.set(token.cell, (counts.get(token.cell) ?? 0) + 1);
  }
  return new Map([...counts].filter(([, v]) => v >= 2));
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
    class="w-full h-full transition-transform duration-500"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Track cells -->
    <template v-for="cell in layout.track" :key="cell.id">
      <circle
        :cx="cell.x"
        :cy="cell.y"
        :r="layout.cellSize"
        :fill="startSquareColor(cell.id) ?? '#edece7'"
        :opacity="startSquareColor(cell.id) ? 0.35 : 1"
        :stroke="startSquareColor(cell.id) ?? '#b2afae'"
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
      <text
        v-if="safeSquares.has(cell.id)"
        :x="cell.x"
        :y="cell.y"
        text-anchor="middle"
        dominant-baseline="central"
        :font-size="layout.cellSize * 0.8"
        :fill="startSquareColor(cell.id) ?? '#898683'"
        :opacity="startSquareColor(cell.id) ? 0.7 : 1"
        :style="{
          transform: `rotate(${-rotation}deg)`,
          transformOrigin: `${cell.x}px ${cell.y}px`,
        }"
      >
        ★
      </text>
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
        :opacity="0.3"
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
        :opacity="0.25"
        :stroke="resolvedSeatColor(si + 1)"
        :stroke-width="layout.cellSize * 0.15"
        stroke-opacity="0.4"
      />
    </template>

    <!-- Center marker: fills the central goal area between the four home columns. -->
    <circle
      :cx="layout.center.x"
      :cy="layout.center.y"
      :r="layout.cellSize * 4"
      fill="#f7f7f5"
      stroke="#898683"
      :stroke-width="layout.cellSize * 0.2"
    />

    <!-- Tokens -->
    <template v-if="tokens">
      <circle
        v-for="token in tokens"
        :key="token.id"
        :cx="cellPositions.get(token.cell)?.x ?? 0"
        :cy="cellPositions.get(token.cell)?.y ?? 0"
        :r="layout.cellSize * 0.7"
        :fill="playerColorHex(token.color)"
        stroke="#1a1816"
        :stroke-width="layout.cellSize * 0.12"
        :class="['transition-all duration-300', legalSet.has(token.id) && 'cursor-pointer']"
        :style="legalSet.has(token.id) ? { filter: 'drop-shadow(0 0 4px #fff)' } : {}"
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
          fill="#1a1816"
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
        >{{ count }}</text>
      </template>
    </template>
  </svg>
</template>
