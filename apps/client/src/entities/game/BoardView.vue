<script setup lang="ts">
import { computed } from "vue";
import { computeBoardLayout, seatColor, playerColorHex, type CellPos } from "./board-geometry";
import { isSafeSquare, startSquare } from "@ludo/shared";
import type { Token } from "@ludo/shared";

const props = defineProps<{
  boardSize: number;
  localSeat?: number;
  tokens?: Token[];
  legalTokenIds?: string[];
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

/** Color each start square to its seat color. */
function startSquareColor(cellId: string): string | null {
  for (let si = 1; si <= props.boardSize; si++) {
    if (cellId === startSquare(si, props.boardSize)) return seatColor(si);
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
        :opacity="startSquareColor(cell.id) ? 0.4 : 1"
        stroke="#b2afae"
        :stroke-width="layout.cellSize * 0.15"
      />
      <!-- Safe marker (star) -->
      <text
        v-if="safeSquares.has(cell.id)"
        :x="cell.x"
        :y="cell.y"
        text-anchor="middle"
        dominant-baseline="central"
        :font-size="layout.cellSize * 0.8"
        fill="#898683"
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
        :fill="seatColor(si + 1)"
        :opacity="0.35"
        stroke="#b2afae"
        :stroke-width="layout.cellSize * 0.15"
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
        :fill="seatColor(si + 1)"
        :opacity="0.25"
        stroke="#b2afae"
        :stroke-width="layout.cellSize * 0.15"
      />
    </template>

    <!-- Center marker -->
    <circle
      :cx="layout.center.x"
      :cy="layout.center.y"
      :r="layout.cellSize * 1.5"
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
  </svg>
</template>
