import React, { useCallback, useMemo, useState } from 'react'
import HookRenderer, { type HookRendererProps } from './HookRenderer.js'
import { registerUsage, getUsageSnapshot, registerTheme, getThemePayload } from '../../themeRegistry.js'

type Status = { loading: boolean; error?: string | null; hookPath: string }

export interface HookAppProps extends Partial<HookRendererProps> {
    host?: string
    hookPath?: string
    onStatus?: (status: Status) => void
}

const DEFAULT_HOST = 'http://localhost:8002'
const DEFAULT_HOOK = '/hooks/client/get-client.jsx'

export const HookApp: React.FC<HookAppProps> = ({ host = DEFAULT_HOST, hookPath = DEFAULT_HOOK, onStatus, ...rest }) => {
    const [status, setStatus] = useState<Status>({ loading: true, error: null, hookPath })

    const handleStatus = useCallback((next: Status) => {
        setStatus(next)
        if (onStatus) onStatus(next)
    }, [onStatus])

    const onElement = useCallback((tag: string, props?: any) => {
        registerUsage(tag, props)
        if (rest.onElement) rest.onElement(tag, props)
    }, [rest])

    const registerThemeStyles = useCallback((name: string, defs?: any) => {
        registerTheme(name, defs)
        if (rest.registerTheme) rest.registerTheme(name, defs)
    }, [rest])

    const hookRendererProps = useMemo<HookRendererProps>(() => ({
        host,
        hookPath,
        onElement,
        registerTheme: registerThemeStyles,
        ...rest,
    }), [host, hookPath, onElement, registerThemeStyles, rest])

    const handleLoading = useCallback(() => handleStatus({ loading: true, error: null, hookPath }), [handleStatus, hookPath])
    const handleError = useCallback((err: string | null) => handleStatus({ loading: false, error: err, hookPath }), [handleStatus, hookPath])
    const handleReady = useCallback(() => handleStatus({ loading: false, error: null, hookPath }), [handleStatus, hookPath])

    return (
        <HookRenderer
            {...hookRendererProps}
            startAutoSync={(interval) => {
                if (rest.startAutoSync) rest.startAutoSync(interval)
                handleLoading()
            }}
            stopAutoSync={() => {
                if (rest.stopAutoSync) rest.stopAutoSync()
            }}
            requestRender={() => {
                if (rest.requestRender) rest.requestRender()
            }}
            onElement={onElement}
            registerTheme={registerThemeStyles}
            loadThemesFromYamlUrl={rest.loadThemesFromYamlUrl}
            renderCssIntoDom={() => {
                if (rest.renderCssIntoDom) rest.renderCssIntoDom()
            }}
            // Bridge basic status updates
            onError={(msg?: string) => handleError(msg || null)}
            onLoading={handleLoading}
            onReady={() => {
                handleReady()
                // expose snapshot for callers if they want it
                getUsageSnapshot()
                getThemePayload()
            }}
        />
    )
}

export default HookApp
