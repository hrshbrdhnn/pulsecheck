<template>
    <div>
        <div class="mb-2">
            <h1>Welcome to the PulseCheck Dashboard!</h1>
            <p>Below are some stats for you to get started with monitoring.</p>
        </div>
        <div class="flex flex-col space-y-2">
            <div class="flex flex-row gap-2">
                <!-- Up, Down and Maintenance quick view -->
                <div class="border border-border p-2 rounded-md flex flex-row">
                    <div class="flex-grow m-4 flex flex-col items-center">
                        <div class="text-lg">Up</div>
                        <div class="text-base">{{ upCount }}</div>
                    </div>
                    <div class="flex-grow m-4 flex flex-col items-center ">
                        <div class="text-lg">Down</div>
                        <div class="text-base">{{ downCount }}</div>
                    </div>
                    <div class="flex-grow m-4 flex flex-col items-center">
                        <div class="text-lg">Maintenance</div>
                        <div class="text-base">{{ maintenanceCount }}</div>
                    </div>
                </div>

                <!-- Just a demo placeholder -->
                <div
                    class="border border-border border-dotted p-2 rounded-md flex flex-row w-full items-center justify-center">
                    <p class="text-muted-foreground text-xl">Something Goes here</p>
                </div>
            </div>

            <!-- Just a demo placeholder -->
            <div
                class="border h-30 border-border border-dotted p-2 rounded-md flex flex-row w-full items-center justify-center">
                <p class="text-muted-foreground text-xl">Something Goes here</p>
            </div>

            <!-- Table showing the current heartbeats -->
            <div class="border border-border p-2 rounded-md flex flex-row w-full items-center justify-center">
                <table class="w-full text-left table-auto min-w-max font-normal">
                    <thead>
                        <tr>
                            <th class="p-2">Name</th>
                            <th class="p-2">Status</th>
                            <th class="p-2">DateTime</th>
                            <th class="p-2">Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="entry in paginatedHeartbeats" :key="entry.timestamp">
                            <router-link :to="`/${entry.monitorId}`">
                                <td class="p-2 underline">{{ entry.monitorName }}</td>
                            </router-link>
                            <td class="p-2">
                                <span :class="getStatusClass(entry.status)" class="flex h-4 w-4 rounded-full"></span>
                            </td>
                            <td class="p-2">{{ entry.timestamp }}</td>
                            <td class="p-2">{{ entry.msg }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination controls -->
            <div class="flex justify-center mt-4 items-center space-x-2">
                <button :disabled="currentPage === 1" @click="currentPage--"
                    class="bg-secondary p-2 rounded-md border border-input cursor-pointer">
                    Previous
                </button>
                <span>{{ currentPage }} / {{ totalPages }}</span>
                <button :disabled="currentPage === totalPages" @click="currentPage++"
                    class="bg-secondary p-2 rounded-md border border-input cursor-pointer">
                    Next
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, defineProps } from 'vue';
import socket from '../socket';

const props = defineProps({
    monitorStatus: {
        type: Object,
        required: true,
    },
    heartbeats: {
        type: Array,
        required: true,
    },
});

const itemsPerPage = 10;
const currentPage = ref(1);

// Computed property for paginated heartbeats
const paginatedHeartbeats = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return props.heartbeats.slice(start, start + itemsPerPage);
});

// Computed property for total pages
const totalPages = computed(() => Math.ceil(props.heartbeats.length / itemsPerPage));

// Map status to color class for table rows
function getStatusClass(status) {
    return {
        'up': 'bg-green-500',
        'down': 'bg-red-600',
        'inactive': 'bg-yellow-500'
    }[status] || '';
}

// Computed property for "Up" count
const upCount = computed(() => {
    return Object.values(props.monitorStatus).filter(status => status === 'up').length;
});

// Computed property for "Down" count
const downCount = computed(() => {
    return Object.values(props.monitorStatus).filter(status => status === 'down').length;
});

// Computed property for "Maintenance" count
const maintenanceCount = computed(() => {
    return Object.values(props.monitorStatus).filter(status => status === 'inactive').length;
});

</script>

<style scoped>
</style>
