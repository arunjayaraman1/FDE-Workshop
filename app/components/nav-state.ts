"use client";

const mobileNavListeners = new Set<() => void>();
let mobileNavOpen = false;

function emit() {
  for (const cb of mobileNavListeners) cb();
}

export function subscribeMobileNav(callback: () => void): () => void {
  mobileNavListeners.add(callback);
  return () => {
    mobileNavListeners.delete(callback);
  };
}

export function getMobileNavOpen(): boolean {
  return mobileNavOpen;
}

export function toggleMobileNav(): void {
  mobileNavOpen = !mobileNavOpen;
  emit();
}

export function closeMobileNav(): void {
  if (mobileNavOpen) {
    mobileNavOpen = false;
    emit();
  }
}