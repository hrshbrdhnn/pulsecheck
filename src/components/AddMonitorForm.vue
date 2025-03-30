<template>
  <form @submit.prevent="submitForm" class="mx-auto shadow-md rounded-lg space-y-4">
    <!-- General -->
    <div>
      <h2 class="text-lg font-semibold">General</h2>
      <div class="grid grid-cols-2 gap-4 mt-2">
        <div>
          <label for="name"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Name</label>
          <input id="name" type="text" v-model="monitor.name" placeholder="Enter name"
            class="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
          <p class="text-xs text-muted-foreground mt-1">This is the public display name for the monitor.</p>
        </div>

        <!-- Type -->
        <div>
          <label for="type"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Type</label>
          <select id="type" v-model="monitor.type"
            class="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm block transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
            <option value="http" selected>HTTP(s)</option>
            <option value="port">TCP Port</option>
            <option value="ping">Ping</option>
            <option value="snmp">SNMP</option>
          </select>
        </div>

        <!-- URL -->
        <div>
          <label for="url"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">URL</label>
          <input id="url" type="text" v-model="monitor.url" placeholder="Enter URL"
            class="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
        </div>

        <!-- Interval -->
        <div>
          <label for="interval"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Interval
            (seconds)</label>
          <input id="interval" type="number" v-model="monitor.interval" placeholder="Enter interval"
            class="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
      </div>
    </div>

    <!-- HTTP Options -->
    <template v-if="monitor.type === 'http'">
      <h2 class="text-lg font-semibold">HTTP Options</h2>
      <div class="grid grid-cols-2 gap-4 mt-2">
        <div>
          <label for="method"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Method</label>
          <select id="method" v-model="monitor.method"
            class="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm block transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
            <option value="get" selected>GET</option>
            <option value="post">POST</option>
            <option value="put">PUT</option>
            <option value="patch">PATCH</option>
            <option value="delete">DELETE</option>
          </select>
        </div>
        <div>
          <label for="httpBodyEncoding"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Body Encoding</label>
          <select id="httpBodyEncoding" v-model="monitor.httpBodyEncoding"
            class="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm block transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
            <option value="json" selected>JSON</option>
            <option value="xml">XML</option>
          </select>
        </div>
        <div class="col-span-2">
          <label for="acceptedStatusCodes"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Accepted Status
            Codes</label>
          <!-- <multiselect id="acceptedStatusCodes" v-model="monitor.accepted_statuscodes" :multiple="true"
            :close-on-select="false" :clear-on-select="false" :preserve-search="true"
            placeholder="Pick Accepted Status Codes" :preselect-first="false" :max-height="600"
            :taggable="true"></multiselect> -->
          <multiselect id="acceptedStatusCodes" v-model="monitor.accepted_statuscodes" :options="acceptedStatusCodeOptions" :multiple="true"
            :close-on-select="false" :clear-on-select="false" :preserve-search="true"
            placeholder="Pick Accepted Status Codes..." :preselect-first="true"
            class="mt-1 w-full rounded-md border border-input">
            <!-- <template #selection="{ values, search, isOpen }">
              <span class="multiselect__single" v-if="values.length" v-show="!isOpen">{{ values.length }} options
                selected</span>
            </template> -->
          </multiselect>
        </div>
        <div class="col-span-2">
          <label for="body"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Body</label>
          <textarea id="body" v-model="monitor.body" rows="3" :placeholder="bodyPlaceholder"
            class="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"></textarea>
        </div>
        <div class="col-span-2">
          <label for="headers"
            class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Headers</label>
          <textarea id="headers" v-model="monitor.headers" rows="3" :placeholder="headersPlaceholder"
            class="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"></textarea>
        </div>
      </div>
    </template>

    <!-- Submit Button -->
    <button type="submit"
      class="w-full mt-4 px-4 py-2 text-white bg-blue-600 rounded-md shadow-md hover:bg-blue-700 transition">
      Add Monitor
    </button>
  </form>
</template>

<script>
import axios from 'axios';
import Multiselect from 'vue-multiselect'
import { toast } from 'vue-sonner'
import 'vue-multiselect/dist/vue-multiselect.min.css';

export default {
  components: {
    Multiselect
  },
  data() {
    return {
      monitor: {
        name: '',
        type: 'http',
        url: "https://",
        interval: 60,
        method: 'GET',
        accepted_statuscodes: ["200-299"],
        httpBodyEncoding: 'json',
        body: '',
        headers: ''
      },
      acceptedStatusCodeOptions: []
    };
  },
  computed: {
    bodyPlaceholder() {
      if (this.monitor.httpBodyEncoding === "xml") {
        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Uptime>Kuma</Uptime>
  </soap:Body>
</soap:Envelope>`;
      }
      return `{
  "key": "value"
}`;
    },
    headersPlaceholder() {
      return `{
  "HeaderName": "HeaderValue"
}`;
    }
  },
  mounted() {
    let acceptedStatusCodeOptions = [
      "100-199",
      "200-299",
      "300-399",
      "400-499",
      "500-599",
    ];
    for (let i = 100; i <= 999; i++) {
      acceptedStatusCodeOptions.push(i.toString());
    }
    this.acceptedStatusCodeOptions = acceptedStatusCodeOptions;
  },
  methods: {
    async submitForm() {
      try {
        const response = await axios.post('/api/monitors', this.monitor);
        console.log('Monitor added:', response.data);
        toast.success('Monitor added successfully!')
        this.$router.push('/');
      } catch (error) {
        console.error('Error adding monitor:', error);
        toast.success('Error adding Monitor!')
        alert('Failed to add monitor.');
      }
    }
  }
};
</script>

<style scoped>
</style>