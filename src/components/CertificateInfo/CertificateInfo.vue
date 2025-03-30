<template>
  <div class="border border-border p-2 rounded-md flex flex-col w-full transition">
    <div class="flex flex-col text-center w-full mb-2">
      <h1 class="text-lg font-bold">Certificate Information</h1>
      <h2 class="text-sm text-muted-foreground">
        Certificate Chain:
        <span class="bold text-green-500">
          {{ valid ? "Valid" : "Expired" }}
        </span>
      </h2>
    </div>
    <div class="space-y-2">
      <CertificateInfoItem :cert="certInfo" />
    </div>
  </div>
</template>

<script setup>
import CertificateInfoItem from './CertificateInfoItem.vue';

defineProps({
  certInfo: {
    type: Object,
    required: true,
  },
  valid: {
    type: Boolean,
    required: true,
  },
});
</script>
