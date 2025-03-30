<template>
  <div id="app" class="border-dashed h-full">
    <Toaster richColors position="bottom-right" theme="dark" />
    <Header />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import Header from './components/Header.vue';
import { Toaster } from 'vue-sonner';
import { onMounted, onUnmounted } from "vue";
import socket from "./socket.js";

onMounted(() => {
  socket.on("connect", () => {
    console.log("Connected to server:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err.message);
  });
});

</script>
