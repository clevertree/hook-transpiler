import React from 'react';
type DivProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
    tag?: string;
    onElement?: (tag: string, props: any) => void;
    [key: string]: any;
};
export declare const TSDiv: React.FC<DivProps>;
export {};
