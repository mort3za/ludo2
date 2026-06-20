<script setup lang="ts">
import { computed } from "vue";
import { DCard } from "@/shared/ui";
import { playerColorHex } from "@/entities/game/board-geometry";
import type { GameState, Seat } from "@ludo/shared";

const props = defineProps<{
  state: GameState;
  /** Current viewer's player id — used to show "You won!" when they placed first. */
  playerId?: string | null;
}>();

/** Occupied seats sorted by standings position (1st, 2nd, etc.); empty seats excluded. */
const rankedSeats = computed(() => {
  const result: { seat: Seat; rank: number }[] = [];
  for (const seat of props.state.seats) {
    if (seat.state === "empty") continue;
    const rank = props.state.standings.indexOf(seat.index);
    result.push({ seat, rank: rank >= 0 ? rank + 1 : props.state.seats.length });
  }
  return result.sort((a, b) => a.rank - b.rank);
});

/** True when the viewer's seat placed first. */
const didWin = computed(() => {
  if (!props.playerId) return false;
  const mySeat = props.state.seats.find((s) => s.playerId === props.playerId);
  return mySeat != null && props.state.standings[0] === mySeat.index;
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
    <h2 class="text-heading font-sans text-midnight-ink mb-4 text-center">
      {{ didWin ? "You won!" : "Game Over" }}
    </h2>

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
  </DCard>
</template>
