<script setup lang="ts">
import { computed } from "vue";
import { DButton } from "@/shared/ui";
import { playerColorHex } from "@/entities/game/board-geometry";
import type { GameState, Token } from "@ludo/shared";

const props = defineProps<{
  state: GameState;
  mySeat: number;
  legalTokenIds: string[];
}>();

const emit = defineEmits<{
  roll: [];
  move: [tokenId: string];
}>();

const isMyTurn = computed(() => props.state.activeSeat === props.mySeat);

const activeSeatColor = computed(() => {
  const seat = props.state.seats.find((s) => s.index === props.state.activeSeat);
  return seat ? playerColorHex(seat.color) : "#888";
});

const phase = computed(() => {
  if (!isMyTurn.value) return "waiting" as const;
  if (props.state.status === "rolling") return "roll" as const;
  if (props.state.status === "moving") {
    if (props.legalTokenIds.length === 0) return "no-moves" as const;
    if (props.legalTokenIds.length === 1) return "forced" as const;
    return "pick" as const;
  }
  return "waiting" as const;
});

const statusText = computed(() => {
  switch (phase.value) {
    case "waiting":
      return "Their turn";
    case "roll":
      return "Your turn — roll the dice!";
    case "no-moves":
      return "No legal moves — passing…";
    case "forced":
      return "Only one move — auto-picking…";
    case "pick":
      return `Rolled ${props.state.diceValue} — pick a token`;
  }
});
</script>

<template>
  <div class="flex items-center gap-3 w-full">
    <p class="text-body-sm text-subtle-gray font-sans flex items-center gap-1.5 w-2/3">
      <span
        class="inline-block size-3 rounded-full"
        :style="{ backgroundColor: activeSeatColor }"
      ></span>
      {{ statusText }}
    </p>

    <!-- Roll button + Dice result -->
    <div class="flex items-center gap-3 w-1/3 justify-end">
      <DButton v-if="phase === 'roll'" @click="emit('roll')"> Roll </DButton>

      <div
        v-if="state.diceValue"
        class="flex items-center justify-center size-12 rounded-lg bg-onyx-button text-canvas-white text-heading font-sans font-bold"
      >
        {{ state.diceValue }}
      </div>
    </div>

    <!-- Token pick buttons -->
    <div v-if="phase === 'pick'" class="flex gap-2">
      <DButton
        v-for="tokenId in legalTokenIds"
        :key="tokenId"
        variant="ghost"
        @click="emit('move', tokenId)"
      >
        {{ tokenId }}
      </DButton>
    </div>
  </div>
</template>
