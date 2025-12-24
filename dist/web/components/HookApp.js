import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import HookRenderer from './HookRenderer.js';
import { registerUsage, getUsageSnapshot, registerTheme, getThemePayload } from '../../shared/themeRegistry.js';
const DEFAULT_HOST = 'http://localhost:8002';
const DEFAULT_HOOK = '/hooks/client/get-client.jsx';
export const HookApp = ({ host = DEFAULT_HOST, hookPath = DEFAULT_HOOK, onStatus, ...rest }) => {
    const [status, setStatus] = useState({ loading: true, error: null, hookPath });
    const handleStatus = useCallback((next) => {
        setStatus(next);
        if (onStatus)
            onStatus(next);
    }, [onStatus]);
    const onElement = useCallback((tag, props) => {
        registerUsage(tag, props);
        if (rest.onElement)
            rest.onElement(tag, props);
    }, [rest]);
    const registerThemeStyles = useCallback((name, defs) => {
        registerTheme(name, defs);
        if (rest.registerTheme)
            rest.registerTheme(name, defs);
    }, [rest]);
    const hookRendererProps = useMemo(() => ({
        host,
        hookPath,
        onElement,
        registerTheme: registerThemeStyles,
        ...rest,
    }), [host, hookPath, onElement, registerThemeStyles, rest]);
    const handleLoading = useCallback(() => handleStatus({ loading: true, error: null, hookPath }), [handleStatus, hookPath]);
    const handleError = useCallback((err) => handleStatus({ loading: false, error: err, hookPath }), [handleStatus, hookPath]);
    const handleReady = useCallback(() => handleStatus({ loading: false, error: null, hookPath }), [handleStatus, hookPath]);
    return (_jsx(HookRenderer, { ...hookRendererProps, startAutoSync: (interval) => {
            if (rest.startAutoSync)
                rest.startAutoSync(interval);
            handleLoading();
        }, stopAutoSync: () => {
            if (rest.stopAutoSync)
                rest.stopAutoSync();
        }, requestRender: () => {
            if (rest.requestRender)
                rest.requestRender();
        }, onElement: onElement, registerTheme: registerThemeStyles, loadThemesFromYamlUrl: rest.loadThemesFromYamlUrl, renderCssIntoDom: () => {
            if (rest.renderCssIntoDom)
                rest.renderCssIntoDom();
        }, 
        // Bridge basic status updates
        onError: (msg) => handleError(msg || null), onLoading: handleLoading, onReady: () => {
            handleReady();
            // expose snapshot for callers if they want it
            getUsageSnapshot();
            getThemePayload();
        } }));
};
export default HookApp;
//# sourceMappingURL=HookApp.js.map