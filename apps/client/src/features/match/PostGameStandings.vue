<script setup lang="ts">
import { computed } from "vue";
import { DButton, DCard } from "@/shared/ui";
import { playerColorHex } from "@/entities/game/board-geometry";
import type { GameState, Seat } from "@ludo/shared";
import { TIMINGS } from "@ludo/shared";

const props = defineProps<{
  state: GameState;
  isOwner: boolean;
  /** Unix ms when the game ended — rematch available until gameEndedAt + postGameWindow. */
  gameEndedAt?: number;
}>();

const emit = defineEmits<{
  rematch: [];
}>();

/** Seats sorted by standings position (1st, 2nd, etc.). */
const rankedSeats = computed(() => {
  const result: { seat: Seat; rank: number }[] = [];
  for (const seat of props.state.seats) {
    const rank = props.state.standings.indexOf(seat.index);
    result.push({ seat, rank: rank >= 0 ? rank + 1 : props.state.seats.length });
  }
  return result.sort((a, b) => a.rank - b.rank);
});

const rematchAvailable = computed(() => {
  if (!props.isOwner || !props.gameEndedAt) return false;
  return Date.now() < props.gameEndedAt + TIMINGS.postGameWindow * 1000;
});

const ordinalSuffix = (n: number) => {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
};
</script>

<template>
  <DCard class="p-6 max-w-sm mx-auto">
    <h2 class="text-heading font-sans text-midnight-ink mb-4 text-center">Game Over</h2>

    <ol class="space-y-2 mb-6">
      <li
        v-for="{ seat, rank } in rankedSeats"
        :key="seat.index"
        class="flex items-center gap-3 font-sans text-body-sm"
      >
        <span class="w-8 text-right text-subtle-gray">{{ rank }}{{ ordinalSuffix(rank) }}</span>
        <span
          class="w-4 h-4 rounded-full inline-block"
          :style="{ backgroundColor: playerColorHex(seat.color) }"
        />
        <span class="text-deep-charcoal">Seat {{ seat.index }}</span>
      </li>
    </ol>

    <DButton v-if="rematchAvailable" class="w-full" @click="emit('rematch')"> Rematch </DButton>
    <p v-else-if="isOwner" class="text-caption text-subtle-gray text-center font-sans">
      Rematch window expired
    </p>
  </DCard>
</template>
