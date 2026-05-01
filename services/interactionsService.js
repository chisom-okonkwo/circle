import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { computeNextTouchDate } from './relationshipUtils';

const INTERACTIONS_COLLECTION = 'interactions';
const CONTACTS_COLLECTION = 'contacts';

function success(data) {
  return { success: true, data, error: null };
}

function failure(error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { success: false, data: null, error: message };
}

/**
 * Creates an interaction log entry and atomically updates the contact's
 * lastContactedDate and recomputed nextTouchDate.
 *
 * @param {string} userId - The authenticated user's uid.
 * @param {string} contactId - The contact document id.
 * @param {Object} interactionInput - Interaction fields:
 *   - date {Date}   - When the interaction happened (defaults to now).
 *   - type {string} - 'call' | 'text' | 'in-person' | 'voice-note' | 'social' | 'other'
 *   - initiatedBy {string} - 'me' | 'them' | 'mutual'
 *   - notes {string} - Optional free-text notes.
 */
export async function createInteraction(userId, contactId, interactionInput) {
  try {
    // 1. Fetch the contact to verify ownership and get current tier.
    const contactRef = doc(db, CONTACTS_COLLECTION, contactId);
    const contactSnap = await getDoc(contactRef);

    if (!contactSnap.exists()) {
      return failure(new Error('Contact not found.'));
    }

    const contact = contactSnap.data();

    if (contact.userId !== userId || contact.isArchived) {
      return failure(new Error('Contact not accessible.'));
    }

    const interactionDate = interactionInput.date instanceof Date
      ? interactionInput.date
      : new Date();

    // 2. Recompute nextTouchDate based on current tier + interaction date.
    const nextTouchDate = computeNextTouchDate(contact.tier, interactionDate);

    // 3. Build the interaction payload.
    const interactionPayload = {
      userId,
      contactId,
      date: interactionDate,
      type: interactionInput.type ?? 'other',
      initiatedBy: interactionInput.initiatedBy ?? 'me',
      notes: interactionInput.notes ?? null,
      createdAt: serverTimestamp(),
    };

    // 4. Atomic write: add interaction + update contact in one batch.
    const batch = writeBatch(db);

    const interactionRef = doc(collection(db, INTERACTIONS_COLLECTION));
    batch.set(interactionRef, interactionPayload);

    batch.update(contactRef, {
      lastContactedDate: interactionDate,
      nextTouchDate,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return success({ id: interactionRef.id });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Returns all interactions for a given contactId, sorted by date descending
 * (most recent first). Verifies the contact belongs to the user.
 *
 * @param {string} userId - The authenticated user's uid.
 * @param {string} contactId - The contact document id.
 */
export async function getInteractionsByContact(userId, contactId) {
  try {
    // Verify the contact belongs to this user before returning its interactions.
    const contactRef = doc(db, CONTACTS_COLLECTION, contactId);
    const contactSnap = await getDoc(contactRef);

    if (!contactSnap.exists() || contactSnap.data().userId !== userId) {
      return failure(new Error('Contact not accessible.'));
    }

    const interactionsQuery = query(
      collection(db, INTERACTIONS_COLLECTION),
      where('contactId', '==', contactId),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(interactionsQuery);
    const interactions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return success(interactions);
  } catch (error) {
    return failure(error);
  }
}
