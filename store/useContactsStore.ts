import { create } from 'zustand';

type Contact = {
  id: string;
  name: string;
};

type Store = {
  contacts: Contact[];
  addContact: (contact: Contact) => void;
};

export const useContactsStore = create<Store>((set) => ({
  contacts: [],
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
}));