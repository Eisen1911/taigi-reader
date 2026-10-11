import type { ButtonHTMLAttributes } from 'react';
export function Button({variant,size,...props}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?:string;size?:string}) { return <button {...props} className={'reader-button '+(props.className||'')} />; }
