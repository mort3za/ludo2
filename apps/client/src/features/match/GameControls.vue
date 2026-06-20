<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { playerColorHex } from "@/entities/game/board-geometry";
import type { GameState } from "@ludo/shared";

const props = defineProps<{
  state: GameState;
  mySeat: number;
  legalTokenIds: string[];
  actionLocked: boolean;
  seatConnected?: boolean;
}>();

const { t } = useI18n();

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
    // A single move is auto-picked server-side only when auto-move is on;
    // otherwise the player must tap the token like any other pick.
    if (props.legalTokenIds.length === 1 && props.state.options.autoMoveEnabled)
      return "forced" as const;
    return "pick" as const;
  }
  return "waiting" as const;
});

const statusText = computed(() => {
  switch (phase.value) {
    case "waiting":
      if (activeSeatIsBot.value)
        return t("match.aiThinking", { seat: activeSeat.value?.index ?? "" });
      return t("match.theirTurn");
    case "locked":
      return t("match.waitingForDice");
    case "roll":
      return t("match.yourTurnRoll");
    case "no-moves":
      return t("match.noLegalMoves");
    case "forced":
      return t("match.onlyOneMove");
    case "pick":
      return t("match.yourTurnMove");
  }
});
</script>

<template>
  <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full">
    <p
      class="text-xs sm:text-body-sm text-subtle-gray font-sans flex items-center gap-1.5 flex-1 min-w-0"
    >
      <span
        class="inline-block size-2 sm:size-3 rounded-full shrink-0"
        :class="{ 'animate-pulse': activeSeatIsBot && phase === 'waiting' }"
        :style="{ backgroundColor: activeSeatColor }"
      ></span>
      <span class="truncate">{{ statusText }}</span>
      <span
        v-if="!seatConnected"
        class="ms-auto text-caption text-neutral-500 whitespace-nowrap"
        :title="t('match.playerDisconnected')"
      >
        {{ t("match.away") }}
      </span>
    </p>
  </div>
</template>
