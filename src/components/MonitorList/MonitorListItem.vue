<script setup>
import { defineProps } from 'vue';

const props = defineProps({
    monitor: {
        type: Object,
        required: true,
    },
    monitorStatus: {
        type: Object,
        required: true,
    },
    selectMode: {
        type: Boolean,
        required: true,
    },
});
</script>

<template>
    <router-link :to="`/${monitor.id}`" class="flex items-center p-2 justify-between rounded-md hover:bg-secondary" exact-active-class="bg-secondary">
        <div class="flex items-center gap-3">
            <span class="flex h-4 w-4 rounded-full"
                :class="monitorStatus[monitor.id] === 'up' ? 'bg-green-600' : monitorStatus[monitor.id] === 'down' ? 'bg-red-600' : 'bg-secondary loadingpulse'"></span>
            <div class="space-y-1">
                <p class="text-sm font-medium leading-none">{{ monitor.name }}</p>
                <p class="text-sm text-muted-foreground">{{ monitor.url }}</p>
            </div>
        </div>
        <div v-if="selectMode">
            <input type="checkbox" :id="'select-' + monitor.id"
                class="h-4 w-4 shrink-0 rounded-sm border border-input bg-background shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
        </div>
    </router-link>
</template>
