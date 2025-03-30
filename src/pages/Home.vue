<template>
	<div class="container-wrapper" id="home">
		<div class="flex">
			<div class="left-container">
				<div class="m-4">
					<MonitorList :monitor-status="monitorStatus" />
				</div>
			</div>
			<div class="right-container border-border border-l border-dashed">
				<div class="m-4" id="home-route-view">
					<router-view v-slot="{ Component, route }" :monitor-status="monitorStatus" :heartbeats="heartbeats">
						<Transition name="effect" mode="out-in">
							<component :is="Component" :key="route.path" :monitor-status="monitorStatus"
								:heartbeats="heartbeats" />
						</Transition>
					</router-view>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import MonitorList from '../components/MonitorList/MonitorList.vue';
import { ref, reactive } from 'vue';
import socket from '../socket';

// Reactive object to store monitor status by monitorId used in Up, Down Maintainance status in the Welcome.vue component.
const monitorStatus = reactive({});

// This is used to show the table present in Welcome.vue
const heartbeats = ref([]);

// Listen for the 'heartbeat' event from the socket
socket.on('heartbeat', (data) => {
	console.log('Heartbeat received:', data);

	if (data.monitorId && data.status) {
		monitorStatus[data.monitorId] = data.status;
	}

	updateHeartbeats(data);

});

// Function to update heartbeats
function updateHeartbeats(data) {
	if (heartbeats.value.length >= 100) heartbeats.value.shift();
	heartbeats.value.push(data);
}

</script>

<style scoped>
.effect-enter-active,
.effect-leave-active {
	transition: .2s;
}

.effect-leave-to {
	opacity: 0;
}

.effect-enter-from {
	opacity: 0;
	transform: translateY(50px);
}
</style>
