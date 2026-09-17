import Dexie from 'dexie';

// Initialize the local browser database
export const pashuDb = new Dexie('PashuSetuLocalDB');

// Version 1 (Original schema for backward compatibility)
pashuDb.version(1).stores({
    offline_clinical_logs: '++id, cattle_tag, farmer_username, sync_status, created_at'
});

// Version 2 (Expanded schema for full offline capabilities)
pashuDb.version(2).stores({
    // 1. Offline Data Entry Queues (Must-Have)
    offline_clinical_logs: '++id, cattle_tag, farmer_username, sync_status, created_at',
    offline_vaccines: '++id, cattle_tag, username, sync_status, created_at', // Fixed to match App.jsx
    offline_cattle: '++id, tag, username, sync_status, created_at',
    offline_milk_yields: '++id, cattle_tag, username, sync_status, created_at',
    offline_breeding_logs: '++id, cattle_tag, username, sync_status, created_at', // Added missing breeding table

    // 2. Read-Only Caches (For viewing without internet)
    cached_herd: 'tag, username', // Using cattle 'tag' as the primary key
    cached_schemes: 'id'          // Using scheme 'id' as the primary key
});

// Version 3 (Added Soft Deletes and Offline Sync Queue)
pashuDb.version(3).stores({
    // Upgrading the index to include 'is_deleted' so we can filter hidden cows
    cached_herd: 'tag, username, is_deleted',

    // New table specifically for generic background tasks like DELETE requests
    sync_queue: '++id, action'
});