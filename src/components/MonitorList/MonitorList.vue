<script setup>
import { ref, computed, onMounted, defineProps } from 'vue';
import MonitorListItem from './MonitorListItem.vue';
import axios from 'axios';
import socket from '../../socket';

const props = defineProps({
    monitorStatus: {
        type: Object,
        required: true,
    },
});

const monitors = ref([]);
const statusFilter = ref('');
const activeFilter = ref('');
const selectMode = ref(false);

// Fetch monitors from backend
const fetchMonitors = async () => {
    try {
        const response = await axios.get('/api/monitors');
        monitors.value = response.data.monitors;
    } catch (error) {
        console.error('Error fetching monitors:', error);
    }
};

const filteredMonitors = computed(() => {
    return monitors.value.filter(monitor => {
        const matchesStatus = !statusFilter.value || monitor.status === statusFilter.value;
        const matchesActive = activeFilter.value === '' || monitor.active === (activeFilter.value === 'true');
        return matchesStatus && matchesActive;
    });
});

const toggleSelectMode = () => {
    selectMode.value = !selectMode.value;
};

socket.on('monitor-deleted', (deletedMonitorId) => {
    console.log('Monitor deleted:', deletedMonitorId);
    monitors.value = monitors.value.filter((monitor) => monitor.id !== Number(deletedMonitorId));
    console.log('Monitors after deletion:', monitors.value);
});

socket.on('monitor-added', (newMonitor) => {
    if (!monitors.value.some(monitor => monitor.id === newMonitor.id)) {
        monitors.value.push(newMonitor);
    }
});

onMounted(() => {
    fetchMonitors();
});

</script>

<template>
    <div class="border border-border rounded-md p-4 space-y-2">
        <!-- Search -->
        <input id="search" type="search" placeholder="Search..."
            class=" w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
        <!-- Filters -->
        <div class="flex  justify-between">
            <div class="flex gap-2">
                <select v-model="statusFilter"
                    class="border border-input p-2 rounded-md focus-visible:outline-none cursor-pointer">
                    <option value="">All Statuses</option>
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                    <option value="pending">Pending</option>
                </select>
                <select v-model="activeFilter"
                    class="border border-input p-2 rounded-md focus-visible:outline-none cursor-pointer">
                    <option value="">All Active</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
            </div>
            <button @click="toggleSelectMode" class="text-sm rounded-md border border-input px-3 py-2 cursor-pointer">
                {{ selectMode ? 'Deselect' : 'Select' }}
            </button>
        </div>
        <!-- List Items -->
        <div class="space-y-1">
            <div v-for="monitor in filteredMonitors" :key="monitor.id" >
                <MonitorListItem :monitorStatus="monitorStatus" :monitor="monitor" :selectMode="selectMode" />
            </div>
        </div>

    </div>
</template>
