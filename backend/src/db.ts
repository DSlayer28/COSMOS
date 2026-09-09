import path from 'path';
import fs from 'fs';
import type { User, PublicUser, UserStatus } from './shared/types';

type DbSchema = {
    users: Record<string, User>;
};

let dbData: DbSchema = { users: {} };
let dbFilePath = '';

function saveDb() {
    fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf8');
}

/**
 * We fell back to a simple JSON file store because `better-sqlite3` caused a napi_fatal_error 
 * native module crash when packaged with `pkg` for Windows. This pure-JS approach avoids all 
 * native binding issues and works seamlessly in the packaged executable.
 */
export function initDb() {
    const isPkg = typeof (process as any).pkg !== 'undefined';
    const baseDir = isPkg ? process.cwd() : path.join(__dirname, '../../');
    const dataDir = path.join(baseDir, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    dbFilePath = path.join(dataDir, 'cosmos.json');

    if (fs.existsSync(dbFilePath)) {
        try {
            dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
        } catch (e) {
            console.error('Failed to parse DB, starting fresh:', e);
            dbData = { users: {} };
        }
    } else {
        saveDb();
    }

    // Reset all users to offline on startup
    let changed = false;
    for (const id in dbData.users) {
        if (dbData.users[id].is_online) {
            dbData.users[id].is_online = false;
            changed = true;
        }
    }
    if (changed) saveDb();
}

export function upsertUser(id: string, name: string): User {
    const now = Date.now();
    const existing = dbData.users[id];

    if (existing) {
        existing.name = name;
        existing.is_online = true;
        existing.last_seen = now;
        existing.updated_at = now;
    } else {
        dbData.users[id] = {
            id,
            name,
            lat: null,
            lng: null,
            status: 'unknown',
            role: 'civilian',
            medical_notes: null,
            is_online: true,
            last_seen: now,
            created_at: now,
            updated_at: now
        };
    }

    saveDb();
    return dbData.users[id];
}

export function updateLocation(id: string, lat: number, lng: number): void {
    const user = dbData.users[id];
    if (user) {
        user.lat = lat;
        user.lng = lng;
        user.last_seen = Date.now();
        user.updated_at = Date.now();
        saveDb();
    }
}

export function updateStatus(id: string, status: UserStatus): void {
    const user = dbData.users[id];
    if (user) {
        user.status = status;
        user.updated_at = Date.now();
        saveDb();
    }
}

export function setOnlineStatus(id: string, isOnline: boolean): void {
    const user = dbData.users[id];
    if (user) {
        user.is_online = isOnline;
        user.last_seen = Date.now();
        user.updated_at = Date.now();
        saveDb();
    }
}

function stripSensitiveData(user: User): PublicUser {
    const { medical_notes, ...rest } = user;
    return rest;
}

export function getAllUsers(): PublicUser[] {
    return Object.values(dbData.users).map(stripSensitiveData);
}

export function getUser(id: string): User | undefined {
    return dbData.users[id];
}

export function getPublicUser(id: string): PublicUser | undefined {
    const user = dbData.users[id];
    if (!user) return undefined;
    return stripSensitiveData(user);
}
