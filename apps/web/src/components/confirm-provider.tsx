"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@coledia/ui/dialog";
import { Button } from "@coledia/ui/button";

/**
 * Global confirmation dialog system.
 *
 * Wrap the app in <ConfirmProvider>. Any client component inside can then:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: "Delete event?",
 *     description: "This action cannot be undone.",
 *     confirmLabel: "Delete",
 *     destructive: true,
 *   });
 *   if (ok) { ... }
 *
 * Also exposes `useAlert()` for one-button informational dialogs
 * (replaces window.alert()).
 */

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmContextValue = (opts: ConfirmOptions) => Promise<boolean>;
type AlertContextValue = (opts: { title: string; description?: string; okLabel?: string }) => Promise<void>;

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);
const AlertContext = React.createContext<AlertContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [confirmOpts, setConfirmOpts] = React.useState<ConfirmOptions | null>(null);
  const [alertOpts, setAlertOpts] = React.useState<{ title: string; description?: string; okLabel?: string } | null>(null);
  const confirmResolver = React.useRef<((v: boolean) => void) | null>(null);
  const alertResolver = React.useRef<(() => void) | null>(null);

  const confirm = React.useCallback<ConfirmContextValue>((opts) => {
    setConfirmOpts(opts);
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const alert = React.useCallback<AlertContextValue>((opts) => {
    setAlertOpts(opts);
    return new Promise<void>((resolve) => {
      alertResolver.current = resolve;
    });
  }, []);

  function handleCloseConfirm(result: boolean) {
    setConfirmOpts(null);
    confirmResolver.current?.(result);
    confirmResolver.current = null;
  }

  function handleCloseAlert() {
    setAlertOpts(null);
    alertResolver.current?.();
    alertResolver.current = null;
  }

  // Close on Escape for confirm → treat as cancel
  function handleConfirmEscape(event: KeyboardEvent) {
    if (confirmOpts && event.key === "Escape") handleCloseConfirm(false);
  }

  React.useEffect(() => {
    if (confirmOpts) {
      document.addEventListener("keydown", handleConfirmEscape);
      return () => document.removeEventListener("keydown", handleConfirmEscape);
    }
  }, [confirmOpts]);

  return (
    <ConfirmContext.Provider value={confirm}>
      <AlertContext.Provider value={alert}>
        {children}

        {/* Confirm dialog */}
        <Dialog open={!!confirmOpts} onOpenChange={(open: boolean) => { if (!open) handleCloseConfirm(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmOpts?.title}</DialogTitle>
              {confirmOpts?.description && (
                <DialogDescription>{confirmOpts.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleCloseConfirm(false)}>
                {confirmOpts?.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={confirmOpts?.destructive ? "destructive" : "default"}
                onClick={() => handleCloseConfirm(true)}
                autoFocus
              >
                {confirmOpts?.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alert dialog */}
        <Dialog open={!!alertOpts} onOpenChange={(open: boolean) => { if (!open) handleCloseAlert(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{alertOpts?.title}</DialogTitle>
              {alertOpts?.description && (
                <DialogDescription>{alertOpts.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleCloseAlert} autoFocus>
                {alertOpts?.okLabel ?? "OK"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AlertContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

export function useAlert(): AlertContextValue {
  const ctx = React.useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within <ConfirmProvider>");
  return ctx;
}
