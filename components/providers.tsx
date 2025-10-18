'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider
                enableSystem
                attribute='class'
                defaultTheme='dark'
                disableTransitionOnChange
            >
                {children}
                <ToasterProvider />
            </ThemeProvider>
        </SessionProvider>
    )
}

function ToasterProvider() {
    const { resolvedTheme } = useTheme()

    return (
        <Toaster
            richColors
            closeButton
            position='top-center'
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        />
    )
}
