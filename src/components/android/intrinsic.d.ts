import 'react'

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            div: any
            text: any
            image: any
            scroll: any
            span: any
            button: any
        }
    }
}
