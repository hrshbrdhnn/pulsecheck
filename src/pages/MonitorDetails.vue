<template>
  <div class="container" id="monitor-details">
    <div class="flex flex-col space-y-2">
      <div v-if="monitor">
        <div class="flex items-center gap-3 justify-between">
          <div>
            <p class="text-xl font-medium leading-none mb-1">{{ monitor.name }}</p>
            <a class="text-sm underline text-blue-500" :href="monitor.url" target="_blank">{{ monitor.url }}</a>
          </div>
          <div class="flex items-center gap-2 flex-row">
            <button class="hover:bg-secondary p-2 rounded-md border border-input cursor-pointer" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor" class="size-5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
            <button class="p-2 rounded-md border border-input cursor-pointer bg-red-800 hover:bg-red-600 transition"
              title="Delete" @click="deleteMonitor(monitor.id)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                stroke="currentColor" class="size-5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div v-else>
        <p>Loading...</p>
      </div>

      <div class="border border-border p-2 rounded-md flex flex-row w-full">
        <div class="flex-grow m-4 flex flex-col items-center">
          <div class="text-lg">Response</div>
          <div class="text-sm text-muted-foreground">Current</div>
          <div :class="['text-base', { loadingpulse: response === null }]">{{ response === null ? '--' : response }} ms
          </div>
        </div>
        <div class="flex-grow m-4 flex flex-col items-center ">
          <div class="text-lg">Avg. Response</div>
          <div class="text-sm text-muted-foreground">24 hour</div>
          <div class="text-base">ToBeCalc ms</div>
        </div>
        <div class="flex-grow m-4 flex flex-col items-center">
          <div class="text-lg">Uptime</div>
          <div class="text-sm text-muted-foreground">24 hour</div>
          <div class="text-base">TobeCalc%</div>
        </div>
        <div class="flex-grow m-4 flex flex-col items-center">
          <div class="text-lg">Certificate Expiry</div>
          <div class="text-sm text-muted-foreground">{{ convertToIST(certificate?.certInfo?.validTo, "date") }}</div>
          <div class="text-base cursor-pointer underline" @click="toggleCertificateInfoVisibility">{{
            certificate?.certInfo?.daysRemaining }} days</div>
        </div>
      </div>
      <CertificateInfo v-if="isCertificateInfoVisible" :valid="certificate?.valid" :cert-info="certificate?.certInfo" />
      <!-- <PingChart :heartbeatGraph="heartbeatGraph" /> -->
      <Chart />
      <!-- Table -->
      <div class="border border-border p-2 rounded-md flex flex-col w-full justify-center">
        <p class="mb-1">Here's the Heartbeat Summary with Status Updates 🚀</p>
        <table class="w-full text-left table-auto min-w-max font-normal">
          <thead>
            <tr>
              <th class="p-2">Status</th>
              <th class="p-2">DateTime</th>
              <th class="p-2">Message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(heartbeat, index) in heartbeatSummary" :key="index">
              <td class="p-2">
                <span class="flex h-4 w-4 rounded-full" :class="heartbeat.status === 1 ? 'bg-green-500' : 'bg-red-600'">
                </span>
              </td>
              <td class="p-2">{{ convertToIST(heartbeat.startTime, 'datetime') }}</td>
              <td class="p-2">{{ heartbeat.msg }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, defineEmits, reactive, defineProps } from 'vue';
import { useRoute, useRouter } from 'vue-router'; 
import axios from 'axios';
import CertificateInfo from '../components/CertificateInfo/CertificateInfo.vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import socket from '../socket';
// import PingChart from '../components/PingChart.vue';
import Chart from '../components/Chart.vue';

dayjs.extend(utc);
dayjs.extend(timezone);

const route = useRoute();
const router = useRouter();
const monitor = ref(null);
const response = ref(null);
const certificate = ref(null);
const heartbeatSummary = reactive([])
const isCertificateInfoVisible = ref(false);

const toggleCertificateInfoVisibility = () => {
  isCertificateInfoVisible.value = !isCertificateInfoVisible.value;
};

const fetchMonitorDetails = async (id) => {
  monitor.value = null;
  try {
    const response = await axios.get(`/api/monitor/${id}`);
    monitor.value = response.data.monitor;
    certificate.value = JSON.parse(response.data.monitorCertificate.info_json);
  } catch (error) {
    console.error('Error fetching monitor details:', error);
  }
};

const fetchHeartbeatDetails = async (id) => {
  heartbeatSummary.length = 0;  
  try {
    const response = await axios.get(`/api/heartbeat/${id}`);
    heartbeatSummary.push(...response.data.heartbeatSummary); 
  } catch (error) {
    console.error('Error fetching heartbeat details:', error);
  }
};

const convertToIST = (utcDate, type) => {
  if (!utcDate) return 'Loading...';

  // Convert the UTC date to IST using dayjs
  if (type === "date") return dayjs.utc(utcDate).tz('Asia/Kolkata').format('YYYY-MM-DD');
  return dayjs.utc(utcDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
};

const deleteMonitor = async (id) => {
  try {
    const response = await axios.delete(`/api/monitor/${id}`);

    // Check if the response status is 200 (OK), indicating success
    if (response.status === 200) {
      monitor.value = null; // Reset monitor value
      router.push('/'); // Redirect to home page
    } else {
      console.error('Monitor deletion failed:', response.data.error);
    }
  } catch (error) {
    console.error('Error deleting monitor:', error);
  }
};

socket.on('heartbeat', (data) => {
  if (data.monitorId == route.params.id) response.value = data.ping;
})

onMounted(() => {
  fetchMonitorDetails(route.params.id);
  fetchHeartbeatDetails(route.params.id);
});

watch(
  () => route.params.id, (newId) => {
    if (newId) {
      fetchMonitorDetails(newId);
      fetchHeartbeatDetails(newId);
    }
  },
);
</script>