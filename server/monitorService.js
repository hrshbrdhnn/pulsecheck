const axios = require("axios");
const { Monitor, Heartbeat, MonitorTlsInfo, ErrorTable } = require("./database");
const dayjs = require("dayjs");
const { sendMail } = require("./resendInit");

const STATUS = {
    UP: "up",
    DOWN: "down",
    MAINTENANCE: "maintenance",
    PENDING: "pending",
};

const monitorIntervals = {}; // Object to store interval IDs by monitor ID

// Function to determine if a status change is important
const isImportantBeat = (isFirstBeat, previousBeatStatus, currentBeatStatus) => {
    return (
        isFirstBeat ||
        (previousBeatStatus === STATUS.UP && currentBeatStatus === STATUS.DOWN) ||
        (previousBeatStatus === STATUS.DOWN && currentBeatStatus === STATUS.UP) ||
        (previousBeatStatus === STATUS.PENDING && currentBeatStatus === STATUS.DOWN)
    ) ? 1 : 0;
};

const checkMonitor = async (monitor, io) => {
    let timeoutId;

    // Fetch the last recorded heartbeat
    const previousBeat = await Heartbeat.findOne({
        where: { monitor_id: monitor.id },
        order: [["time", "DESC"]],
    });

    try {
        const startTime = Date.now();

        const isFirstBeat = !previousBeat;
        const previousStatus = previousBeat ? (previousBeat.status ? STATUS.UP : STATUS.DOWN) : null;
        let downCount = previousBeat ? previousBeat.down_count || 0 : 0;

        // Create a timeout controller
        const controller = new AbortController();
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error("Request timed out"));
            }, monitor.timeout * 1000);
        });

        // Perform the request
        const response = await Promise.race([
            axios.get(monitor.url, { signal: controller.signal }),
            timeoutPromise,
        ]);

        clearTimeout(timeoutId); // Clear timeout if request is successful

        // Determine if the status code is in the 2xx range (success codes)
        const responseTime = Date.now() - startTime;
        const isSuccess = response.status >= 200 && response.status < 300;
        const currentStatus = isSuccess ? STATUS.UP : STATUS.DOWN;
        const currentStatusNumeric = isSuccess ? 1 : 0;
        const statusMessage = `${response.status} - ${response.statusText}`;

        // Reset down count if the monitor is UP
        if (isSuccess) {
            downCount = 0;
        }

        // Check if status change is important
        const isImportant = isImportantBeat(isFirstBeat, previousStatus, currentStatus);
        const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS");

        // Record heartbeat
        await Heartbeat.create({
            important: isImportant,
            monitor_id: monitor.id,
            status: currentStatusNumeric,
            msg: statusMessage,
            time: timestamp,
            ping: responseTime,
            duration: responseTime,
            down_count: downCount, // Track consecutive downtimes
        });

        io.emit("heartbeat", {
            monitorId: monitor.id,
            monitorName: monitor.name,
            msg: statusMessage,
            status: currentStatus,
            ping: responseTime,
            timestamp,
        });

        if(isImportant){
            sendMail((currentStatus.toUpperCase()), monitor.name, monitor.url, statusMessage)
        }

        return { status: currentStatusNumeric, responseTime: Date.now() - startTime };
    } catch (error) {
        clearTimeout(timeoutId);

        const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS");
        let errorMessage = error.message;
        if (error.response) {
            // Response error (non-2xx status)
            errorMessage = `${error.response.status} - ${error.response.statusText}`;
        } else if (error.request) {
            // Network error (no response)
            errorMessage = "Network Error: No response received";
        } else {
            // Other errors (e.g., timeout, setup issues)
            errorMessage = error.message;
        }
        const isFirstBeat = !previousBeat;
        const previousStatus = previousBeat ? (previousBeat.status ? STATUS.UP : STATUS.DOWN) : null;
        const isImportant = isImportantBeat(isFirstBeat, previousStatus, 'down');
        // Increment down count since the request failed
        let downCount = (previousBeat?.down_count || 0) + 1;

        // Store failure in database
        await Heartbeat.create({
            important: isImportant,
            monitor_id: monitor.id,
            status: 0, // DOWN
            msg: errorMessage,
            time: timestamp,
            ping: 0,
            duration: 0,
            down_count: downCount, // Store incremented down count
        });

        io.emit("heartbeat", {
            monitorId: monitor.id,
            monitorName: monitor.name,
            msg: errorMessage,
            status: "down",
            ping: 0,
            timestamp,
        });

        if(isImportant){
            sendMail('DOWN', monitor.name, monitor.url, errorMessage)
        }

        return { status: 0, error: errorMessage };
    }
};

const startMonitoring = (io) => {
    Monitor.findAll()
        .then((monitors) => {
            monitors.forEach((monitor) => {
                const intervalId = setInterval(() => {
                    checkMonitor(monitor, io);
                }, monitor.interval * 1000);

                // Store interval ID for each monitor
                monitorIntervals[monitor.id] = intervalId;
            });
        })
        .catch((err) => {
            console.error("Error fetching monitors:", err);
        });
};


const startMonitor = (monitor, io) => {
    if (!(monitor.active)) return;

    console.log(`Starting monitoring for ${monitor.url} every ${monitor.interval} seconds`);

    const intervalId = setInterval(() => {
        checkMonitor(monitor, io);
    }, monitor.interval * 1000);

    // Store the interval ID using the monitor ID as the key
    monitorIntervals[monitor.id] = intervalId;
};

module.exports = {
    startMonitoring,
    startMonitor,
    monitorIntervals
};