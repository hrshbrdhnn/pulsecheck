# PulseCheck
> The watchdog for your web.

## Introduction

PulseCheck is an advanced website monitoring application designed to track the uptime, performance, and security of configured URLs. It provides real-time insights, alerts for downtime, SSL certificate monitoring, and graphical performance analysis to help users ensure their websites remain operational and secure.

## Features

- Real-Time URL Monitoring – Continuously tracks the availability and performance of configured URLs.
- Automated Downtime Alerts – Sends instant email notifications when a website becomes unreachable.
- Graphical Data Representation – Displays performance trends through interactive graphs.
- SSL Certificate Monitoring – Alerts users before SSL certificates expire.
- Custom Monitoring Intervals – Allows users to define how frequently URLs are checked.
- WebSocket-Powered Updates – Ensures real-time status updates without manual refresh.
- Lightweight & Efficient – Simple deployment with minimal setup required.

## Tech Stack

- Frontend: Vue.js (interactive and responsive UI)
- Backend: Express.js (API and monitoring logic)
- Database: SQLite (stores monitoring history and configurations)
- Real-Time Communication: Socket.io (for live updates)
- Email Notifications: Resend (for alert emails)

## Steps to Run Locally
1. Clone the repository:
   ```sh
   git clone https://github.com/harsshhhgit/pulsecheck
   cd PulseCheck
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the application:
   ```sh
   npm run build-and-start
   ```
4. Open the application in your browser at `http://localhost:3200`

## Usage
1. Configure URLs to monitor via the dashboard.
2. View real-time status updates and performance analytics.
3. Receive email alerts if a monitored site goes down.
4. Track SSL certificate expiration dates.

## Screenshots
<img width="1470" height="806" alt="image" src="https://github.com/user-attachments/assets/8a2cf89f-46a7-4971-b711-1924ee546d29" />
<img width="1470" height="807" alt="image" src="https://github.com/user-attachments/assets/300fcae3-ca1b-4bbc-8910-d8c5f81a1b74" />
<img width="1470" height="807" alt="image" src="https://github.com/user-attachments/assets/053f757d-60c2-4370-aa92-a3f8b031361c" />
<img width="1470" height="806" alt="image" src="https://github.com/user-attachments/assets/51d8db24-c774-4297-be96-61d39a23c9d4" />
