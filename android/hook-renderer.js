// QuickJS-safe entry for Android test harnesses.
// Provides a minimal API to init the transpiler and render hooks without extra glue.
import React from 'react'
import { HookRenderer, initAndroid, transpileHook, installWebApiShims } from '../dist/index.android.js'

export async function initTranspiler() {
    return initAndroid()
}

export function renderHook(host = 'http://localhost:8002', path = '/hooks/client/get-client.jsx', opts = {}) {
    const ReactImpl = opts.React || React
    if (!ReactImpl) throw new Error('React instance is required to render hooks')
    return ReactImpl.createElement(HookRenderer, { host, hookPath: path, ...opts })
}

export { transpileHook }
export { installWebApiShims }
