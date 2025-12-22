import React, { useEffect } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer.js'

interface FileRendererProps {
  content: string
  contentType: string
  onElement?: (tag: string, props: any) => void
}

export function FileRenderer({ content, contentType, onElement }: FileRendererProps) {
  useEffect(() => {
    if (onElement) {
      const lower = (contentType || '').toLowerCase()
      if (lower.startsWith('image/')) {
        onElement('div', { className: "flex justify-center" })
        onElement('img', { style: { maxWidth: '100%', height: 'auto' } })
      } else if (lower.includes('json') || (!lower.includes('markdown') && !lower.includes('md'))) {
        onElement('pre', {})
      }
    }
  }, [onElement, contentType])

  const lower = (contentType || '').toLowerCase()

  if (lower.includes('markdown') || lower.includes('md')) {
    return <MarkdownRenderer content={content} onElement={onElement} />
  }

  if (lower.startsWith('image/')) {
    const isDataUrl = content.startsWith('data:')
    const src = isDataUrl ? content : `data:${contentType};base64,${content}`
    return (
      <div className="flex justify-center">
        <img src={src} alt="image" style={{ maxWidth: '100%', height: 'auto' }} />
      </div>
    )
  }

  if (lower.includes('json')) {
    let pretty: string = content
    try {
      pretty = JSON.stringify(JSON.parse(content), null, 2)
    } catch (e) {
      // ignore
    }
    return (
      <pre>
        {pretty}
      </pre>
    )
  }

  return (
    <pre>
      {content}
    </pre>
  )
}
