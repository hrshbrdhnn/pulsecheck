import { createRouter, createWebHistory } from 'vue-router';
import AddMonitor from '../pages/AddMonitor.vue';
import MonitorDetails from '../pages/MonitorDetails.vue';
import Welcome from '../components/Welcome.vue';
import Home from '../pages/Home.vue';

const routes = [
  {
    path: '/', component: Home,
    children: [
      { path: '', component: Welcome },
      { path: '/add-monitor', component: AddMonitor },
      { path: '/:id', component: MonitorDetails }
    ]
  },
  // { path: '/add-monitor', component: AddMonitor }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;