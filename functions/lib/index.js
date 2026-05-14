"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyDigest = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
admin.initializeApp();
const db = admin.firestore();
// Configurable daily digest time (24h format, e.g. "08:00").
// Set via: firebase functions:config:set or defineString param.
const DIGEST_SCHEDULE = (0, params_1.defineString)("DAILY_DIGEST_SCHEDULE", {
    default: "every day 08:00",
    description: "Cron schedule for the daily digest. Uses Google Cloud Scheduler syntax.",
});
// ── Helpers ────────────────────────────────────────────────────────────────
function toDate(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return value;
    // Firestore Timestamp
    if (typeof value === "object" &&
        value !== null &&
        typeof value.toDate === "function") {
        return value.toDate();
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}
function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** Parse MM-DD → { month, day } or null. */
function parseBirthday(birthday) {
    if (!birthday)
        return null;
    const match = birthday.match(/^(\d{2})-(\d{2})$/);
    if (!match)
        return null;
    return { month: parseInt(match[1], 10), day: parseInt(match[2], 10) };
}
/**
 * Returns true if the birthday (MM-DD) falls within the next `windowDays` days
 * from today (inclusive of today, exclusive of windowDays+1).
 */
function birthdayWithinDays(birthday, today, windowDays) {
    const parsed = parseBirthday(birthday);
    if (!parsed)
        return false;
    const todayNorm = startOfDay(today);
    for (let offset = 0; offset <= windowDays; offset++) {
        const candidate = new Date(todayNorm);
        candidate.setDate(candidate.getDate() + offset);
        if (candidate.getMonth() + 1 === parsed.month &&
            candidate.getDate() === parsed.day) {
            return true;
        }
    }
    return false;
}
/** Build a human-friendly digest message. */
function buildMessage(overdueCount, birthdayCount) {
    if (overdueCount === 0 && birthdayCount === 0)
        return null;
    const parts = [];
    if (overdueCount > 0) {
        parts.push(`${overdueCount} overdue contact${overdueCount > 1 ? "s" : ""}`);
    }
    if (birthdayCount > 0) {
        parts.push(`${birthdayCount} birthday${birthdayCount > 1 ? "s" : ""} coming up`);
    }
    return {
        title: "Circle — daily check-in",
        body: `You have ${parts.join(" and ")}. Tap to review.`,
    };
}
// ── Main function ──────────────────────────────────────────────────────────
exports.dailyDigest = (0, scheduler_1.onSchedule)({
    // Use the configurable schedule param.
    schedule: DIGEST_SCHEDULE.value(),
    timeZone: "America/New_York", // Adjust to your primary user base or use UTC.
    memory: "256MiB",
}, async () => {
    const today = new Date();
    const todayNorm = startOfDay(today);
    // Fetch all userSettings documents that have a push token and notifications enabled.
    const settingsSnap = await db
        .collection("userSettings")
        .where("notificationsEnabled", "==", true)
        .where("pushToken", "!=", null)
        .get();
    if (settingsSnap.empty) {
        console.log("[dailyDigest] No users with notifications enabled.");
        return;
    }
    const sendPromises = settingsSnap.docs.map(async (settingsDoc) => {
        const userId = settingsDoc.id;
        const { pushToken } = settingsDoc.data();
        // Fetch non-archived contacts for this user.
        const contactsSnap = await db
            .collection("contacts")
            .where("userId", "==", userId)
            .where("isArchived", "==", false)
            .get();
        if (contactsSnap.empty)
            return;
        let overdueCount = 0;
        let birthdayCount = 0;
        for (const contactDoc of contactsSnap.docs) {
            const contact = contactDoc.data();
            // Check overdue: today > nextTouchDate.
            const nextTouch = toDate(contact.nextTouchDate);
            if (nextTouch && startOfDay(nextTouch) < todayNorm) {
                overdueCount++;
            }
            // Check birthday within next 3 days.
            if (contact.birthday && birthdayWithinDays(contact.birthday, today, 3)) {
                birthdayCount++;
            }
        }
        const message = buildMessage(overdueCount, birthdayCount);
        if (!message)
            return; // Nothing to report today.
        // Send via FCM using the Expo push token.
        // Expo push tokens are in the format: ExponentPushToken[...]
        // Use the Expo Push API for Expo tokens, or FCM directly for raw device tokens.
        const fcmMessage = {
            token: pushToken,
            notification: {
                title: message.title,
                body: message.body,
            },
            data: {
                // Navigate to Home screen on tap.
                screen: "Home",
                type: "daily_digest",
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: overdueCount + birthdayCount,
                    },
                },
            },
            android: {
                priority: "normal",
                notification: {
                    sound: "default",
                    channelId: "circle_digest",
                },
            },
        };
        try {
            await admin.messaging().send(fcmMessage);
            console.log(`[dailyDigest] Sent digest to user ${userId}`);
        }
        catch (err) {
            // Token may be stale — log but don't crash.
            console.error(`[dailyDigest] Failed to send to user ${userId}:`, err);
        }
    });
    await Promise.allSettled(sendPromises);
    console.log(`[dailyDigest] Processed ${settingsSnap.docs.length} user(s).`);
});
//# sourceMappingURL=index.js.map