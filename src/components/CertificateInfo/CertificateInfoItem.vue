<template>
    <div class="mx-2 text-muted-foreground">
        <p>Subject: {{ formatSubject(cert.subject) }}</p>
        <p>Issuer: {{ formatSubject(cert.issuer) }}</p>
        <p>Valid To: {{ convertToIST(cert.validTo) }}</p>
        <p>Days Remaining: {{ cert.daysRemaining }} days</p>
        <p>Fingerprint: {{ cert.fingerprint }}</p>
    </div>
    <div v-if="cert?.issuerCertificate">
        <svg class="h-10 w-10" viewBox="-7.5 0 24 24" xmlns:dc="http://purl.org/dc/elements/1.1/"
            xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
            xmlns="http://www.w3.org/2000/svg" version="1.1" id="svg4355" fill="#000000">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
                <path id="rect819"
                    d="M3 3c-1.108 0-2 .892-2 2v4c0 1.108.892 2 2 2h3c1.108 0 2-.892 2-2V5c0-1.108-.892-2-2-2zm0 1h3c.554 0 1 .446 1 1v4c0 .554-.446 1-1 1H3c-.554 0-1-.446-1-1V5c0-.554.446-1 1-1z"
                    style="opacity:1;vector-effect:none;fill:#373737;fill-opacity:1;stroke:none;stroke-width:4;stroke-linecap:square;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:3.20000005;stroke-opacity:.55063291">
                </path>
                <path id="rect819-3"
                    d="M3 13c-1.108 0-2 .892-2 2v4c0 1.108.892 2 2 2h3c1.108 0 2-.892 2-2v-4c0-1.108-.892-2-2-2zm0 1h3c.554 0 1 .446 1 1v4c0 .554-.446 1-1 1H3c-.554 0-1-.446-1-1v-4c0-.554.446-1 1-1z"
                    style="opacity:1;vector-effect:none;fill:#373737;fill-opacity:1;stroke:none;stroke-width:4;stroke-linecap:square;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:3.20000005;stroke-opacity:.55063291">
                </path>
                <path id="rect839" d="M4.5 8c-.554 0-1 .446-1 1v3h2V9c0-.554-.446-1-1-1z"
                    style="opacity:1;vector-effect:none;fill:#373737;fill-opacity:1;stroke:none;stroke-width:4;stroke-linecap:square;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:3.20000005;stroke-opacity:.55063291">
                </path>
                <path id="rect839-6" d="M3.5 12v3c0 .554.446 1 1 1s1-.446 1-1v-3z"
                    style="opacity:1;vector-effect:none;fill:#373737;fill-opacity:1;stroke:none;stroke-width:4;stroke-linecap:square;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:3.20000005;stroke-opacity:.55063291">
                </path>
            </g>
        </svg>
    </div>
    <CertificateInfoItem v-if="cert?.issuerCertificate" :cert="cert?.issuerCertificate" />
</template>

<script setup>
import CertificateInfoItem from './CertificateInfoItem.vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

defineProps({
    cert: {
        type: Object,
        required: true,
    }
})

dayjs.extend(utc);
dayjs.extend(timezone);

const convertToIST = (utcDate, type) => {
    if (!utcDate) return 'Loading...';

    // Convert the UTC date to IST using dayjs
    if (type === "date") return dayjs.utc(utcDate).tz('Asia/Kolkata').format('YYYY-MM-DD');
    return dayjs.utc(utcDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
};

const formatSubject = (subject) => {
    if (subject.O && subject.CN && subject.C) {
        return `${subject.CN} - ${subject.O} (${subject.C})`;
    } else if (subject.O && subject.CN) {
        return `${subject.CN} - ${subject.O}`;
    } else if (subject.CN) {
        return subject.CN;
    } else {
        return "no info";
    }
}
</script>