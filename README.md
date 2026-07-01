# IoT Temperature Monitoring Platform

Welcome to the central repository for the **IoT Temperature Monitoring Platform**. This repository houses the platform's backend services, dashboard frontend, databases, and deployment configurations.

For the ESP32 firmware repository, see: **[project-monitoring-firmware](https://github.com/mochmizan/project-monitoring-firmware)**

---

## 1. Project Overview

This capstone project implements a scalable IoT temperature-monitoring platform. It is initially deployed as a testbed in the campus building's server room, with immediate scope covering up to **4 rooms** (including the Server Room and Ecolab).

The architecture is designed to scale building-wide across multiple hubs and devices without needing a redesign.

---

## 2. Hardware Developer Integration Guide

If you are developing the hardware modules (ESP32-based), this section defines the connectivity, security, and messaging interfaces required to communicate with the platform.

### A. Connectivity & Security
* **Default Network Path:** ESP32 devices connect directly to the campus enterprise Wi-Fi (WPA2/WPA3-Enterprise, 802.1X).
* **Protocol:** MQTT over TLS (Secure MQTT) on port **`8883`**.
* **Credentials:** Every hardware module must authenticate with its unique client username and password. ACLs are enforced on the broker.
* **Fallback Path:** In areas with poor RF signals (e.g. inside metal ATS enclosures), sensors wire directly to a local Raspberry Pi running a local Mosquitto bridge that forwards messages to the central broker.

### B. MQTT Topic Structure
The topic naming convention is: `<room>/<module>/<metric>`
* **QoS Level:** Use **QoS 1** (at-least-once) for all message telemetry and configurations.
* **Birth & Last Will/Testament (LWT):**
  * Set a Last Will and Testament to publish `offline` (retained) to the status topic: `<room>/<module>/status`.
  * Publish `online` (retained) to `<room>/<module>/status` immediately upon successful connection.

### C. Example Payloads

#### 1. Device Discovery
Devices must announce themselves on boot/reconnection by publishing a birth message:
* **Topic:** `discovery/<mac-address>` (retained)
* **Payload:**
  ```json
  {
    "mac": "AA:BB:CC:DD:EE:FF",
    "firmware_type": "temp",
    "firmware_version": "1.0.0"
  }
  ```

#### 2. Telemetry (Temperature/Humidity)
* **Topic:** `<room>/temp/value`
* **Payload:**
  ```json
  {
    "celsius": 23.5,
    "ts": 1719876543
  }
  ```

#### 3. Power Status (ATS Module)
* **Topic:** `<room>/ats/status`
* **Payload:**
  ```json
  {
    "source": "PLN",
    "fault": false
  }
  ```

#### 4. AC Control & State
* **Topic (State Reporting):** `<room>/ac/state`
* **Topic (Command Ingest):** `<room>/ac/cmd`
* **Payload:**
  ```json
  {
    "power": "on",
    "setpoint": 22
  }
  ```

#### 5. Remote Configuration
Devices receive operating parameters (such as sampling intervals) via a configuration topic:
* **Topic:** `<room>/<module>/config` (retained)
* **Acknowledge Topic:** `<room>/<module>/config/ack` (published by the device to confirm settings application)
