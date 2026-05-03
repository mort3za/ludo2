<script setup lang="ts">
import { computed } from "vue";
import { computeBoardLayout, seatColor } from "./board-geometry";

const props = defineProps<{
  boardSize: number;
}>();

const layout = computed(() => computeBoardLayout(props.boardSize));
</script>

<template>
  <svg
    :viewBox="layout.viewBox"
    class="w-full h-full"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Track cells -->
    <circle
      v-for="cell in layout.track"
      :key="cell.id"
      :cx="cell.x"
      :cy="cell.y"
      :r="layout.cellSize"
      fill="#edece7"
      stroke="#b2afae"
      :stroke-width="layout.cellSize * 0.15"
    />

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
  </svg>
</template>
