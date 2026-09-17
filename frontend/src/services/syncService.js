import { pashuDb } from '../db/pashuDb';
import API from './api'; // Reusing your existing Axios config for tokens & base URL

// 📡 HELPER: Prevents "Poison Pill" infinite loops
// If the server explicitly rejects the payload (e.g., 400 Bad Request), drop it so it doesn't jam the queue forever.
// If it's a 5xx Server Error or 401 Unauthorized, keep it in the queue to try again later.
const handleSyncError = async (table, id, error) => {
    const status = error.response?.status;
    if (status >= 400 && status < 500 && status !== 401) {
        console.error(`🚨 [Sync] Permanent API rejection (${status}). Dropping invalid record ${id} to unblock queue.`);
        await table.delete(id);
    } else {
        console.warn(`⚠️ [Sync] Temporary failure for record ${id}. Will retry on next reconnect.`, error.message);
    }
};

export const syncOfflineRecords = async () => {
    // Safety check: don't attempt to sync if still offline
    if (!navigator.onLine) return;

    console.log('📡 Starting background sync for all offline queues...');

    try {
        // ==========================================
        // 1. SYNC CLINICAL LOGS
        // ==========================================
        const pendingClinical = await pashuDb.offline_clinical_logs.where('sync_status').equals('pending').toArray();
        if (pendingClinical.length > 0) {
            console.log(`🩺 Syncing ${pendingClinical.length} clinical log(s)...`);
            for (const record of pendingClinical) {
                const { id, sync_status, created_at, ...payload } = record;
                try {
                    await API.post('/clinical/log', payload);
                    await pashuDb.offline_clinical_logs.delete(id);
                } catch (e) { await handleSyncError(pashuDb.offline_clinical_logs, id, e); }
            }
        }

        // ==========================================
        // 2. SYNC CATTLE REGISTRATIONS
        // ==========================================
        const pendingCattle = await pashuDb.offline_cattle.where('sync_status').equals('pending').toArray();
        if (pendingCattle.length > 0) {
            console.log(`🐄 Syncing ${pendingCattle.length} cattle registration(s)...`);
            for (const record of pendingCattle) {
                const { id, sync_status, created_at, ...payload } = record;
                try {
                    await API.post('/cattle/register', payload);
                    await pashuDb.offline_cattle.delete(id);
                } catch (e) { await handleSyncError(pashuDb.offline_cattle, id, e); }
            }
        }

        // ==========================================
        // 3. SYNC VACCINATIONS
        // ==========================================
        const pendingVaccines = await pashuDb.offline_vaccines.where('sync_status').equals('pending').toArray();
        if (pendingVaccines.length > 0) {
            console.log(`💉 Syncing ${pendingVaccines.length} vaccination(s)...`);
            for (const record of pendingVaccines) {
                const { id, sync_status, created_at, ...payload } = record;
                try {
                    await API.post('/vaccination/log', payload);
                    await pashuDb.offline_vaccines.delete(id);
                } catch (e) { await handleSyncError(pashuDb.offline_vaccines, id, e); }
            }
        }

        // ==========================================
        // 4. SYNC MILK YIELDS
        // ==========================================
        const pendingMilk = await pashuDb.offline_milk_yields.where('sync_status').equals('pending').toArray();
        if (pendingMilk.length > 0) {
            console.log(`🥛 Syncing ${pendingMilk.length} milk yield(s)...`);
            for (const record of pendingMilk) {
                const { id, sync_status, created_at, ...payload } = record;
                try {
                    await API.post('/milk/log', payload);
                    await pashuDb.offline_milk_yields.delete(id);
                } catch (e) { await handleSyncError(pashuDb.offline_milk_yields, id, e); }
            }
        }

        // ==========================================
        // 5. SYNC BREEDING LOGS
        // ==========================================
        const pendingBreeding = await pashuDb.offline_breeding_logs.where('sync_status').equals('pending').toArray();
        if (pendingBreeding.length > 0) {
            console.log(`🧬 Syncing ${pendingBreeding.length} breeding log(s)...`);
            for (const record of pendingBreeding) {
                const { id, sync_status, created_at, ...payload } = record;
                try {
                    await API.post('/breeding/log', payload);
                    await pashuDb.offline_breeding_logs.delete(id);
                } catch (e) { await handleSyncError(pashuDb.offline_breeding_logs, id, e); }
            }
        }

        // ==========================================
        // 6. SYNC BACKGROUND QUEUE (ARCHIVES & DELETES)
        // ==========================================
        const pendingQueue = await pashuDb.sync_queue.toArray();
        if (pendingQueue.length > 0) {
            console.log(`🗑️ Processing ${pendingQueue.length} background task(s)...`);
            for (const item of pendingQueue) {
                try {
                    if (item.action === 'ARCHIVE_CATTLE') {
                        await API.post('/cattle/archive', item.payload);
                    } else if (item.action === 'DELETE_360_RECORD') {
                        // Strip out 'recordType' from the payload so we don't send useless data to the backend
                        const { recordType, ...apiPayload } = item.payload;
                        await API.post(`/${recordType}/delete`, apiPayload);
                    }

                    // Only remove from queue if the API call succeeds
                    await pashuDb.sync_queue.delete(item.id);
                } catch (e) {
                    await handleSyncError(pashuDb.sync_queue, item.id, e);
                }
            }
        }

        // Only log success if we actually attempted to sync something
        if (pendingClinical.length || pendingCattle.length || pendingVaccines.length || pendingMilk.length || pendingBreeding.length || pendingQueue.length) {
            console.log('✅ Background sync complete! All offline data pushed to cloud.');

            // 📡 Tell the rest of the app that the sync is finished so it can refresh the UI (e.g. Navbar badge)
            window.dispatchEvent(new Event('offline-sync-complete'));
        }

    } catch (err) {
        console.warn('⚠️ Critical failure during background sync. Will retry later.', err);
    }
};