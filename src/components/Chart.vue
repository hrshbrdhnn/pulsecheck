<template>
    <div id="chart" class="border border-border p-2 rounded-md">
        <div class="toolbar space-x-1">
            <button class="p-2 bg-secondary rounded-sm" id="3h" @click="updateData('3h')"
                :class="{ active: selection === '3h' }">
                3h
            </button>
            <button class="p-2 bg-secondary rounded-sm" id="6h" @click="updateData('6h')"
                :class="{ active: selection === '6h' }">
                6h
            </button>
            <button class="p-2 bg-secondary rounded-sm" id="10h" @click="updateData('10h')"
                :class="{ active: selection === '10h' }">
                10h
            </button>
        </div>

        <div id="chart-timeline">
            <ApexCharts type="area" height="350" ref="chart" :options="chartOptions" :series="series"></ApexCharts>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import ApexCharts from 'vue3-apexcharts';

const route = useRoute();
const now = new Date().getTime();
const chart = ref(null);

// Chart Options. Themes, Tooltips, etc.
const chartOptions = ref({
    chart: {
        id: 'area-datetime',
        type: 'area',
        height: 350,
        zoom: {
            autoScaleYaxis: true
        }
    },
    stroke: {
        show: true,
        width: 2,
        colors: ['#00a63e'], // Green stroke color
    },
    grid: {
        show: true,
        borderColor: '#262626',
    },
    dataLabels: {
        enabled: false
    },
    markers: {
        size: 0,
        style: 'hollow',
    },
    xaxis: {
        type: 'datetime',
        tickAmount: 6,
        // axisBorder: {
        //     show: true,
        //     color: '#00a63e',
        //     height: 1,
        //     width: '100%',
        //     offsetX: 0,
        //     offsetY: 0
        // },
    },
    tooltip: {
        theme: 'dark',
        fillSeriesColor: true,
        x: {
            format: 'dd MMM yyyy HH:mm:ss'
        },
        y: {
            title: {
                formatter: function (seriesName) {
                    return seriesName;
                }
            },
            formatter: function (val) {
                return val + " ms";
            }
        }
    },
    fill: {
        type: 'gradient',
        gradient: {
            shade: 'dark',
            shadeIntensity: 1,
            opacityFrom: 0.7,
            opacityTo: 0.9,
            stops: [0, 100],
            colorStops: [
                {
                    offset: 0,
                    color: '#00a63e', // Green gradient start
                    opacity: 1
                },
                {
                    offset: 100,
                    color: '#00a63e', // Green gradient end
                    opacity: 0.1
                }
            ]
        },
    },
});

// Data series
const series = ref([]);

// Selection
const selection = ref('3h');

// Fetch data function
const fetchData = async (id) => {
    try {
        const response = await axios.get(`/api/heartbeat/${id}`);
        const data = response.data.heartbeatGraph; // Assume data is in the format [{ time: timestamp, value: number }]
        console.log('Fetched data:', data);
        const formattedData = data.map(item => {
            // If ping is 0, we assign null so that it can be handled differently in the chart
            return [new Date(item.time).getTime(), item.ping === 0 ? null : item.ping]
        });

        // Update the series with the fetched data
        series.value = [{
            name: 'Ping',
            data: formattedData,
            color: "#00a63e"
        }];
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};

// Update the chart data based on selected timeframe
const updateData = (timeline) => {
    selection.value = timeline;

    if (chart.value) {
        switch (timeline) {
            case '3h':
                chart.value.zoomX(now - (3 * 60 * 60 * 1000), now); // Zoom for the last 5 hours
                break;
            case '6h':
                chart.value.zoomX(now - (6 * 60 * 60 * 1000), now); // Zoom for the last 10 hours
                break;
            case '10h':
                chart.value.zoomX(now - (10 * 60 * 60 * 1000), now); // Zoom for the last 24 hours
                break;
            default:
                break;
        }
    }
};

// Fetch data when component is mounted
onMounted(() => {
    fetchData(route.params.id);
});
</script>
