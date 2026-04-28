import { createContact, getContactById } from './contactsService';

/**
 * Temporary smoke test — creates a contact and reads it back.
 * Call this from a test button in HomeScreen.
 * Delete this file once Layer 2 is confirmed working.
 */
export async function runFirestoreContactTest(userId) {
  console.log('--- Firestore contact test start ---');

  // Step 1: create a test contact
  const createResult = await createContact(userId, {
    name: 'Test Contact',
    tier: 2,
    lastContactedDate: new Date(),
    nextTouchDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    phone: null,
    email: 'test@example.com',
    birthday: '07-04',
    notes: 'Created by Firestore smoke test.',
    lifeContext: null,
    followUpNote: null,
    howWeMet: 'Smoke test',
  });

  if (!createResult.success) {
    const msg = `Create failed: ${createResult.error}`;
    console.error(msg);
    return { success: false, message: msg };
  }

  const contactId = createResult.data.id;
  console.log('Created contact id:', contactId);

  // Step 2: read it back
  const readResult = await getContactById(userId, contactId);

  if (!readResult.success || !readResult.data) {
    const msg = `Read failed: ${readResult.error ?? 'Contact not found'}`;
    console.error(msg);
    return { success: false, message: msg };
  }

  const contact = readResult.data;
  console.log('Read back contact:', JSON.stringify(contact, null, 2));

  // Step 3: verify fields match
  const checks = [
    contact.name === 'Test Contact',
    contact.tier === 2,
    contact.email === 'test@example.com',
    contact.isArchived === false,
    contact.userId === userId,
  ];

  const allPassed = checks.every(Boolean);

  if (!allPassed) {
    const msg = 'Read back succeeded but field values did not match expected.';
    console.warn(msg);
    return { success: false, message: msg };
  }

  const msg = `All checks passed. Contact "${contact.name}" (id: ${contactId}) created and read back successfully.`;
  console.log(msg);
  console.log('--- Firestore contact test end ---');
  return { success: true, message: msg };
}
