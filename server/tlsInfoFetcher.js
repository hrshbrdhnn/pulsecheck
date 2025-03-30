// server/tlsInfoFetcher.js
const tls = require('tls');
const { Monitor, Heartbeat, MonitorTlsInfo, ErrorTable } = require('./database');
const schedule = require('node-schedule');

const getDaysBetween = (validFrom, validTo) =>
    Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

const getDaysRemaining = (validFrom, validTo) => {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
};

const parseCertificateInfo = function (info) {
    let link = info;
    let i = 0;

    const existingList = {};

    while (link) {
        // log.debug("cert", `[${i}] ${link.fingerprint}`);

        if (!link.valid_from || !link.valid_to) {
            break;
        }
        link.validTo = new Date(link.valid_to);
        link.validFor = link.subjectaltname?.replace(/DNS:|IP Address:/g, "").split(", ");
        link.daysRemaining = getDaysRemaining(new Date(), link.validTo);

        existingList[link.fingerprint] = true;

        // Move up the chain until loop is encountered
        if (link.issuerCertificate == null) {
            link.certType = (i === 0) ? "self-signed" : "root CA";
            break;
        } else if (link.issuerCertificate.fingerprint in existingList) {
            // a root CA certificate is typically "signed by itself"  (=> "self signed certificate") and thus the "issuerCertificate" is a reference to itself.
            // log.debug("cert", `[Last] ${link.issuerCertificate.fingerprint}`);
            link.certType = (i === 0) ? "self-signed" : "root CA";
            link.issuerCertificate = null;
            break;
        } else {
            link.certType = (i === 0) ? "server" : "intermediate CA";
            link = link.issuerCertificate;
        }

        // Should be no use, but just in case.
        if (i > 500) {
            throw new Error("Dead loop occurred in parseCertificateInfo");
        }
        i++;
    }

    return info;
};

const fetchTLSInfo = (url, port = 443, callback) => {
    const domain = new URL(url).hostname;
    const options = {
        host: domain,
        port: port,
        rejectUnauthorized: false,
        servername: domain,
    };

    const socket = tls.connect(options, () => {
        const certificate = socket.getPeerCertificate(true);
        const valid = socket.authorized || false;
        socket.end();

        if (!certificate || Object.keys(certificate).length === 0) {
            callback(new Error("No certificate found."), null);
        } else {
            callback(null, { valid, certInfo: parseCertificateInfo(certificate) });
        }
    });
};

const scheduleTLSFetch = () => {
    // Schedule to run every 5 hour
    schedule.scheduleJob('0 */5 * * *', async () => {
        console.log('Running fetchTLSInfo every 5 minutes');
        try {
            const monitors = await Monitor.findAll();
            monitors.forEach((monitor) => {
                fetchTLSInfo(monitor.url, 443, async (err, result) => {
                    if (err) {
                        await ErrorTable.create({
                            table_name: 'monitor_tls_info',
                            err_text: err.message
                        });
                    } else {
                        // Check if entry exists and update or insert accordingly
                        const existingInfo = await MonitorTlsInfo.findOne({
                            where: { monitor_id: monitor.id }
                        });

                        if (existingInfo) {
                            // Update existing entry
                            await MonitorTlsInfo.update({
                                info_json: JSON.stringify(result)
                            }, {
                                where: { monitor_id: monitor.id }
                            });
                        } else {
                            // Create new entry
                            await MonitorTlsInfo.create({
                                monitor_id: monitor.id,
                                info_json: JSON.stringify(result)
                            });
                        }
                    }
                });
            });
        } catch (err) {
            console.error('Error fetching monitors for TLS info:', err);
        }
    });
};


// const scheduleTLSFetch = (io) => {
//     schedule.scheduleJob('0 0 * * *', async () => {
//         console.log('Running fetchTLSInfo at 00:00');
//         try {
//             const monitors = await Monitor.findAll();
//             monitors.forEach((monitor) => {
//                 fetchTLSInfo(monitor.url, (err, result) => {
//                     if (err) {
//                         ErrorTable.create({
//                             table_name: 'monitor_tls_info',
//                             err_text: err.message
//                         });
//                     } else {
//                         MonitorTlsInfo.create({
//                             monitor_id: monitor.id,
//                             info_json: JSON.stringify(result)
//                         });
//                     }
//                 });
//             });
//         } catch (err) {
//             console.error('Error fetching monitors for TLS info:', err);
//         }
//     });
// };

const fetchTLSInfoOnceIfNeeded = async (monitor) => {
    try {
        fetchTLSInfo(monitor.url, 443, (err, result) => {
            if (err) {
                ErrorTable.create({
                    table_name: 'monitor_tls_info',
                    err_text: err.message
                });
            } else {
                MonitorTlsInfo.create({
                    monitor_id: monitor.id,
                    info_json: JSON.stringify(result)
                });
            }
        });
    } catch (err) {
        console.error('Error checking monitors for TLS info:', err);
    }
};

module.exports = { scheduleTLSFetch, fetchTLSInfo, fetchTLSInfoOnceIfNeeded };

/*
Usage:::::

fetchTLSInfo("google.com", 443, (err, result) => {
        if (err) {
            console.error("Error:", err.message);
        } else {
            console.log("TLS Info:", result);
        }
    });
*/