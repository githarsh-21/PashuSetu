# 🐄 PashuSetu (पशुसेतु)
### *AI-Powered Digital Livestock Management & Offline-First Triage Platform*

[![GitHub repo](https://img.shields.io/badge/GitHub-PashuSetu-blue?logo=github)](https://github.com/githarsh-21/PashuSetu)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline--First-success?logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![AI Diagnostics](https://img.shields.io/badge/Vision%20Model-SwinV2%20%2B%20LLM-blueviolet)](https://github.com/microsoft/Swin-Transformer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Overview

**PashuSetu** is an offline-first Progressive Web Application (PWA) designed to bridge the gap between smallholder dairy farmers and veterinary care in rural India. Built specifically to tackle **veterinary shortages**, **connectivity dead zones**, and **language barriers**, PashuSetu provides a full livestock ledger, automated milk yield analytics, government scheme matching, and an AI-driven bovine disease triage scanner directly on budget smartphones.

---

## ✨ Key Technical Highlights

- 📶 **Offline-First Resilience (Dexie.js / IndexedDB):** Full CRUD capability without active connectivity; records sit in a local queue tagged with `pending` status.
- 🔄 **Defensive Sync Engine (`syncService.js`):** Sequential background reconciliation upon reconnection with status-code guards (retries temporary 5xx errors; purges 4xx "poison pill" malformed requests).
- 🌐 **Zero-Reload Multilingual Support (`react-i18next`):** Complete dynamic localization across **English (en)**, **Hindi (hi)**, **Marathi (mr)**, and **Telugu (te)**.
- 🧠 **Dual-Stage AI Triage Pipeline:** Combines a **Swin Transformer V2 (SwinV2)** for localized visual feature extraction with an **LLM reasoning engine** for structured JSON triage advisories.
- 📊 **Dynamic Milk Analytics:** 7-day and 30-day moving averages tracking lactation curves with automatic anomaly detection triggers.
- 🏛️ **Rule-Based Scheme Recommender:** Matches farmer profiles with central and state subsidy schemes (e.g., Rashtriya Gokul Mission, Pashu Kisan Credit Card).

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Farmer_PWA ["📱 Farmer Progressive Web App"]
        direction TB
        F1["Farmer Interface (React + Vite)"]
        F2["react-i18next (EN, HI, MR, TE)"]
        F3["Health Ledger & Milk Analytics"]
        F4["AI Triage Scanner"]
        F5[("Dexie.js IndexedDB (Offline Storage)")]
        F1 --> F2 --> F3 & F4 --> F5
    end

    subgraph Sync_Layer ["🔄 Background Sync Engine"]
        S1["syncService.js Worker<br/>• Sequential Queue Processing<br/>• 4xx Poison Pill Drop Guard"]
    end

    subgraph Cloud_Core ["☁️ Central Backend (Render)"]
        C1["Python REST API"]
        C2[("Cloud Database (SQLite / PostgreSQL)")]
        C1 --> C2
    end

    subgraph Vet_Portal ["🩺 Veterinary Command Portal"]
        V1["Telemetry & Dynamic Tag Search"]
        V2["Outbreak Surveillance & CSV Export"]
    end

    F5 ==> S1
    S1 ==> C1
    C1 <==> Vet_Portal
