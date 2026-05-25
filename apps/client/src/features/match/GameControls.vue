<script setup lang="ts">
import { computed } from "vue";
import { DButton } from "@/shared/ui";
import { playerColorHex } from "@/entities/game/board-geometry";
import type { GameState } from "@ludo/shared";

const props = defineProps<{
  state: GameState;
  mySeat: number;
  legalTokenIds: string[];
  lastRolledValue: number | null;
  actionLocked: boolean;
}>();

const emit = defineEmits<{
  roll: [];
}>();

const isMyTurn = computed(() => props.state.activeSeat === props.mySeat);

const activeSeat = computed(() =>
  props.state.seats.find((s) => s.index === props.state.activeSeat),
);

const activeSeatColor = computed(() =>
  activeSeat.value ? playerColorHex(activeSeat.value.color) : "#888",
);

const activeSeatIsBot = computed(() => activeSeat.value?.isBot ?? false);

const phase = computed(() => {
  if (!isMyTurn.value || activeSeatIsBot.value) return "waiting" as const;
  if (props.actionLocked) return "locked" as const;
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
      if (activeSeatIsBot.value) return `Player${activeSeat.value?.index ?? ""} (AI) is thinking…`;
      return "Their turn";
    case "locked":
      return "Waiting for dice…";
    case "roll":
      return "Your turn — roll the dice!";
    case "no-moves":
      return "No legal moves — passing…";
    case "forced":
      return "Only one move — auto-picking…";
    case "pick":
      return "Your turn — move a token!";
  }
});
</script>

<template>
  <div class="flex items-center gap-3 w-full">
    <p class="text-body-sm text-subtle-gray font-sans flex items-center gap-1.5 w-2/3">
      <span
        class="inline-block size-3 rounded-full"
        :class="{ 'animate-pulse': activeSeatIsBot && phase === 'waiting' }"
        :style="{ backgroundColor: activeSeatColor }"
      ></span>
      {{ statusText }}
    </p>

    <!-- Roll button + Dice result -->
    <div class="flex items-center gap-3 w-1/3 justify-end">
      <div
        :class="{ invisible: lastRolledValue === null }"
        class="flex items-center justify-center rounded-lg bg-onyx-button text-canvas-white text-heading font-sans font-bold"
      >
        {{ lastRolledValue }}
      </div>
      <DButton :disabled="phase !== 'roll'" @click="emit('roll')"> Roll </DButton>
    </div>
  </div>
</template>
