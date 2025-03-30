const { Resend } = require('resend');
const { ErrorTable } = require("./database");
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);
console.log(resend);

const sendMail = async (monitorStatus, monitorName, monitorUrl, monitorResponse) => {
    const { data, error } = await resend.emails.send({
        from: 'Alert <alert@nyxcloud.cloud>',
        to: ['monkmind8@gmail.com'],
        subject: `${monitorStatus === 'UP' ? `${monitorName} Is Back Up - All Systems Normal` : `${monitorName} Is Down - Urgent Action Required`}`,
        html: mailTemplate(monitorStatus, monitorName, monitorUrl, monitorResponse),
    });

    if (error) {
        ErrorTable.create({
            table_name: 'mail',
            err_text: error.message
        });
        return console.error({ error });
    }
}

const mailTemplate = (monitorStatus, monitorName, monitorUrl, monitorResponse) => {
    return `
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                .up-email-wrapper {
                    font-family: Arial, sans-serif;
                    color: #333;
                    background-color: #008000;
                    margin: 0;
                    padding: 10px;
                }
                .down-email-wrapper {
                    font-family: Arial, sans-serif;
                    color: #333;
                    background-color: #ED2100;
                    margin: 0;
                    padding: 10px;
                }
                .email-container {
                    background-color: #ffffff;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    max-width: 600px;
                    margin: 20px auto;
                }
                h2 {
                    color: #2c3e50;
                }
                p {
                    font-size: 14px;
                    color: #333;
                    line-height: 1.6;
                }
                .status-up {
                    color: #008000;;
                }
                .status-down {
                    color: #ED2100;
                }
                .link {
                    color: #3498db;
                    text-decoration: none;
                }
                .footer {
                    font-size: 12px;
                    color: #888;
                    text-align: center;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="${monitorStatus==='UP' ? 'up-email-wrapper' : 'down-email-wrapper'}">
                <div class="email-container">
                    <h2>Monitor Status Alert</h2>
                    <p>Dear Team,</p>
                    <p>We would like to inform you about the current status of the monitored URL:</p>
                    
                    <ul>
                        <li><strong>Monitor Name:</strong> ${monitorName}</li>
                        <li><strong>Monitor URL:</strong> <a href="${monitorUrl}" class="link">${monitorUrl}</a></li>
                        <li><strong>Status:</strong> <span class="${monitorStatus==='UP' ? 'status-up' : 'status-down'}"><strong>${monitorStatus}</strong></span></li>
                    </ul>
                    
                    <p><strong>Current Response:</strong> ${monitorResponse}</p>

                    ${monitorStatus == 'UP' ? `<p>The monitor is back up, no further action is needed at the moment.</p>` : `<p>The monitor is down, please look into it as soon as possible to ensure the service is fully operational.</p>`}

                    <p>Please don't hesitate to contact us if you need further assistance.</p>
            
                    <p>Best regards,</p>
                    <p><strong>Admin</strong><br />
                    <strong>PulseCheck</strong><br />
                    <a href="mailto:support@nyxcloud.cloud">support@nyxcloud.cloud</a></p>
                </div>
            
                <div class="footer">
                    <p>&copy; 2025 | NyxCloud. All rights reserved.</p>
                </div>
            </div>
        </body>
    </html>
    `;
}

module.exports = {
    resend, sendMail
};
