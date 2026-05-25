import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("@/pages/HomePage.vue"),
  },
  {
    path: "/room/:roomId",
    name: "room",
    component: () => import("@/pages/RoomPage.vue"),
    props: true,
  },
  {
    path: "/match/:roomId",
    name: "match",
    component: () => import("@/pages/MatchPage.vue"),
    props: true,
  },
  {
    path: "/post-game/:roomId",
    name: "post-game",
    component: () => import("@/pages/PostGamePage.vue"),
    props: true,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
