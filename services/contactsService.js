import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from './firebase';

const CONTACTS_COLLECTION = 'contacts';

function success(data) {
  return { success: true, data, error: null };
}

function failure(error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { success: false, data: null, error: message };
}

/**
 * Creates a new contact document for a user.
 */
export async function createContact(userId, contactInput) {
  try {
    const payload = {
      ...contactInput,
      userId,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CONTACTS_COLLECTION), payload);

    // Persist the generated document id inside the document for easier client reads.
    await updateDoc(docRef, { id: docRef.id });

    return success({ id: docRef.id });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Returns all non-archived contacts belonging to a user.
 */
export async function getContacts(userId) {
  try {
    const contactsQuery = query(
      collection(db, CONTACTS_COLLECTION),
      where('userId', '==', userId),
      where('isArchived', '==', false)
    );

    const snapshot = await getDocs(contactsQuery);
    const contacts = snapshot.docs.map((contactDoc) => ({
      id: contactDoc.id,
      ...contactDoc.data(),
    }));

    return success(contacts);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Returns one contact by id if it exists, belongs to the user, and is not archived.
 */
export async function getContactById(userId, contactId) {
  try {
    const contactRef = doc(db, CONTACTS_COLLECTION, contactId);
    const snapshot = await getDoc(contactRef);

    if (!snapshot.exists()) {
      return success(null);
    }

    const contact = { id: snapshot.id, ...snapshot.data() };

    if (contact.userId !== userId || contact.isArchived) {
      return success(null);
    }

    return success(contact);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Updates an existing contact if it belongs to the user and is not archived.
 */
export async function updateContact(userId, contactId, updates) {
  try {
    const contactRef = doc(db, CONTACTS_COLLECTION, contactId);
    const snapshot = await getDoc(contactRef);

    if (!snapshot.exists()) {
      return success(null);
    }

    const existingContact = snapshot.data();
    if (existingContact.userId !== userId || existingContact.isArchived) {
      return success(null);
    }

    await updateDoc(contactRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return success({ id: contactId });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Soft-deletes a contact by marking isArchived=true.
 */
export async function deleteContact(userId, contactId) {
  try {
    const contactRef = doc(db, CONTACTS_COLLECTION, contactId);
    const snapshot = await getDoc(contactRef);

    if (!snapshot.exists()) {
      return success(null);
    }

    const existingContact = snapshot.data();
    if (existingContact.userId !== userId || existingContact.isArchived) {
      return success(null);
    }

    await updateDoc(contactRef, {
      isArchived: true,
      updatedAt: serverTimestamp(),
    });

    return success({ id: contactId });
  } catch (error) {
    return failure(error);
  }
}
