"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "./actions";

/** Opening the Notifications tab reads what's there; counts update on the next visit. */
export function MarkRead() {
  useEffect(() => {
    void markNotificationsRead();
  }, []);
  return null;
}
