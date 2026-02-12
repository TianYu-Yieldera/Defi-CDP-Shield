"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"

import { config } from "@/lib/wagmi"
import { ToastProvider } from "@/components/ui/toast"

// Suppress non-critical errors from WalletConnect at module level
if (typeof window !== 'undefined') {
  // Intercept unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof TypeError && reason.message === 'Failed to fetch') {
      event.preventDefault();
      return;
    }
    if (reason && typeof reason === 'object' && 'code' in reason) {
      const code = (reason as { code: string }).code;
      const nonCritical = ['no_speech', 'aborted', 'timeout', 'recognition_aborted', 'no_speech_detected'];
      if (nonCritical.includes(code)) {
        event.preventDefault();
        return;
      }
    }
  });

  // Intercept console.error to suppress WalletConnect "Failed to fetch"
  // Next.js dev overlay triggers on console.error, so we downgrade to console.warn
  const _origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    // Suppress "Failed to fetch" TypeError from WalletConnect
    if (args[0] instanceof TypeError && (args[0] as TypeError).message === 'Failed to fetch') {
      return;
    }
    // Suppress string "Failed to fetch"
    if (typeof args[0] === 'string' && args[0].includes('Failed to fetch')) {
      return;
    }
    _origConsoleError.apply(console, args);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: false,
      },
    },
  }))

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'hsl(217, 91%, 60%)',
            accentColorForeground: 'white',
            borderRadius: 'small',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
        >
          <ToastProvider>
            {children}
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
