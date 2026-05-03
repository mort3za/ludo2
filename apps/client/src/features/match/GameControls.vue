<script setup lang="ts">
import { computed } from "vue";
import { DButton } from "@/shared/ui";
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
      return `Seat ${props.state.activeSeat}'s turn`;
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
  <div class="flex flex-col items-center gap-3">
    <p class="text-body-sm text-subtle-gray font-sans">{{ statusText }}</p>

    <!-- Roll button -->
    <DButton v-if="phase === 'roll'" @click="emit('roll')"> Roll </DButton>

    <!-- Dice result -->
    <div v-if="state.diceValue" class="text-display font-sans text-midnight-ink">
      {{ state.diceValue }}
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
