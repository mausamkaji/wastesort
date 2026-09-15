import { useState, useEffect, useCallback } from 'react';
import { WasteItem, InspectionResult } from '../types';
import { WASTE_ITEMS } from '../data/wasteItems';

const STORAGE_KEY = 'ecosort_user_searched_encyclopedia_v1';
const UPDATE_EVENT = 'ecosort-encyclopedia-updated';

// In-memory cache
let cachedUserSearchedItems: WasteItem[] = [];
let hasLoadedFromStorage = false;

function loadFromLocalStorage(): WasteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    // Purge any previously cached user search items so the encyclopedia stays clean and curated
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Graceful fallback
  }
  return [];
}

function saveToLocalStorage(_items: WasteItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Graceful fallback
  }
}

function getInitialUserItems(): WasteItem[] {
  if (!hasLoadedFromStorage) {
    loadFromLocalStorage();
    cachedUserSearchedItems = [];
    hasLoadedFromStorage = true;
  }
  return [];
}

// Sync from server in background
export async function syncUserSearchedItemsFromServer(): Promise<WasteItem[]> {
  cachedUserSearchedItems = [];
  return [];
}

function dispatchUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(UPDATE_EVENT, {
        detail: {
          userSearchedItems: [],
        },
      })
    );
  }
}

/**
 * Returns all user-searched encyclopedia items (now empty, kept for interface compatibility).
 */
export function getUserSearchedEncyclopediaItems(): WasteItem[] {
  return [];
}

/**
 * Returns the curated catalog: Curated WASTE_ITEMS only.
 */
export function getCombinedEncyclopedia(): WasteItem[] {
  return [...WASTE_ITEMS].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Saves a validated WasteItem (no-op: user searches are not saved to encyclopedia).
 */
export function saveValidatedSearchToEncyclopedia(item: WasteItem): WasteItem {
  return item;
}

/**
 * Validates a search query with Google Search & AI without modifying the encyclopedia catalog.
 */
export async function validateAndAddToEncyclopedia(
  query: string,
  materialHint?: string
): Promise<{ item: WasteItem; inspection: InspectionResult; isNew: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Search query cannot be empty');
  }

  const res = await fetch('/api/inspect-waste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemName: trimmed, materialHint }),
  });

  if (!res.ok) {
    throw new Error('AI inspection failed');
  }

  const inspection = await res.json();
  const dummyItem: WasteItem = {
    id: `item-${Date.now()}`,
    name: inspection.itemName || trimmed,
    category: 'plastics',
    bin: inspection.primaryBin || 'general_waste',
    emoji: '📦',
    prepInstructions: inspection.prepInstructions || [],
    whyItGoesHere: inspection.disposalAdvice || '',
    difficulty: 'beginner',
    tags: inspection.detectedMaterials || [],
  };

  return {
    item: dummyItem,
    inspection,
    isNew: false,
  };
}

/**
 * Removes a user-searched item (no-op).
 */
export function removeUserSearchedItem(_id: string): void {
  // No-op
}

/**
 * React Hook for real-time reactivity across all components.
 */
export function useEncyclopediaStore() {
  const allItems = WASTE_ITEMS;
  const userSearchedItems: WasteItem[] = [];

  const refresh = useCallback(() => {
    // Curated catalog only
  }, []);

  const validateAndAdd = useCallback(
    async (query: string, materialHint?: string) => {
      return await validateAndAddToEncyclopedia(query, materialHint);
    },
    []
  );

  const removeItem = useCallback((_id: string) => {}, []);

  return {
    allItems,
    userSearchedItems,
    curatedItems: WASTE_ITEMS,
    totalSearchedCount: 0,
    isSyncing: false,
    validateAndAdd,
    saveValidatedSearch: saveValidatedSearchToEncyclopedia,
    removeItem,
    refresh,
  };
}
