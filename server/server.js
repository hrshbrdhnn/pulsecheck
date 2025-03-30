const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Monitor, Heartbeat, MonitorTlsInfo } = require('./database');
const { startMonitoring, startMonitor, monitorIntervals } = require('./monitorService');
const { scheduleTLSFetch, fetchTLSInfo, fetchTLSInfoOnceIfNeeded } = require('./tlsInfoFetcher');
const { sequelize } = require('./database');
const { Op } = require('sequelize');
const cors = require('cors');
const { Certificate } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Serve static files from the 'dist' directory. This will host the Vue.js application.
// The 'dist' directory is where the Vue.js application is built and served.
app.use(express.static(path.join(__dirname, '../dist')));

// API route to get all monitors
app.get('/api/monitors', async (req, res) => {
    console.log('GET /api/monitors');
    try {
        const monitors = await Monitor.findAll();
        res.json({ monitors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API route to get a specific monitor by ID
// This route is used to fetch the details of a specific monitor
// and its associated TLS certificate information.
app.get('/api/monitor/:id', async (req, res) => {
    const monitorId = req.params.id;  // Retrieve the monitor ID from the URL parameter
    console.log(`GET /api/monitor/${monitorId}`);

    try {
        // Fetch the monitor with the given ID from the database
        const monitor = await Monitor.findByPk(monitorId);
        const monitorCertificate = await MonitorTlsInfo.findOne({
            where: { monitor_id: monitorId }, 
        });

        if (monitor && monitorCertificate) {
            res.json({ monitor, monitorCertificate });
        } else {
            res.status(404).json({ error: 'Monitor not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API route to add a new monitor
app.post('/api/monitors', async (req, res) => {
    try {
        const monitor = await Monitor.create(req.body);
        io.emit('monitor-added', monitor);
        // Immediately start monitoring the new monitor
        startMonitor(monitor, io);
        fetchTLSInfoOnceIfNeeded(monitor);
        // TODO: Add TLS Fetch
        res.status(201).json({ monitor });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete monitor API route
app.delete('/api/monitor/:id', async (req, res) => {
    const monitorId = req.params.id;
    console.log(`DELETE /api/monitor/${monitorId}`);

    const transaction = await sequelize.transaction();

    try {
        // Clear the interval for this monitor if it exists
        if (monitorIntervals[monitorId]) {
            clearInterval(monitorIntervals[monitorId]);
            delete monitorIntervals[monitorId]; // Remove it from the map
        }

        // Delete dependent records in Heartbeat and MonitorTlsInfo inside a transaction
        await Heartbeat.destroy({ where: { monitor_id: monitorId }, transaction });
        await MonitorTlsInfo.destroy({ where: { monitor_id: monitorId }, transaction });

        // Now delete the monitor
        const monitor = await Monitor.findByPk(monitorId, { transaction });
        if (monitor) {
            await monitor.destroy({ transaction }); // Delete the monitor
            await transaction.commit(); // Commit the transaction
            io.emit('monitor-deleted', monitorId);
            res.status(200).json({ message: 'Monitor and its related data deleted successfully' });
        } else {
            await transaction.rollback(); // Rollback if monitor is not found
            res.status(404).json({ error: 'Monitor not found' });
        }
    } catch (err) {
        await transaction.rollback(); // Rollback in case of error
        console.error('Error deleting monitor:', err);
        res.status(500).json({ error: err.message });
    }
});

// API route to get heartbeat messages for a specific monitor
app.get('/api/heartbeat/:id', async (req, res) => {
    const monitorId = req.params.id;
    try {
        const heartbeatSummary = await sequelize.query(`
            WITH grouped AS (
                SELECT 
                    msg,
                    status,
                    time,
                    ROW_NUMBER() OVER (ORDER BY time) 
                    - ROW_NUMBER() OVER (PARTITION BY msg ORDER BY time) AS grp
                FROM heartbeat
                WHERE monitor_id = :monitorId
            )
            SELECT 
                msg,
                status, 
                MIN(time) AS "startTime"
            FROM grouped
            GROUP BY msg, grp, status
            ORDER BY "startTime" DESC
        `, {
            replacements: { monitorId },
            type: sequelize.QueryTypes.SELECT
        });

        const threeHoursAgo = new Date();
        threeHoursAgo.setHours(threeHoursAgo.getHours() - 10);
        console.log("threeHoursAgo", threeHoursAgo);

        const heartbeatGraph = await Heartbeat.findAll({
            where: {
                monitor_id: monitorId,
                time: {
                    [Op.gte]: threeHoursAgo
                }
            },
            attributes: ['status', 'time', 'ping'],
            order: [['time', 'DESC']]
        });

        if (heartbeatSummary && heartbeatGraph) {
            res.json({ heartbeatSummary, heartbeatGraph });
        } else {
            res.status(404).json({ error: 'Heartbeat data not found' });
        }
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Serve the Vue.js application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
    console.log('a user connected');
    console.log("Id", socket.id);
});

server.listen(PORT, async () => {
    try {
        console.log('Creating Database');
        await sequelize.sync(); // Ensure tables exist before running queries
        console.log('Database & tables created!');
    } catch (err) {
        console.error('Error syncing database:', err);
    }
    console.log(`Server is running on http://localhost:${PORT}`);
    startMonitoring(io);
    scheduleTLSFetch();
    // fetchTLSInfoOnceIfNeeded();

    // fetchTLSInfo("https://google.com", 443, (err, result) => {
    //     if (err) {
    //         console.error("Error:", err.message);
    //     } else {
    //         console.log("TLS Info:", result);
    //     }
    // });
});