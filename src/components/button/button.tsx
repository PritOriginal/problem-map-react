import React from "react";
import "./button.scss"

interface ButtonProps {
    children: React.ReactNode;
    /** The button's ROLE. Exactly one `primary` per screen: the action it exists for. */
    style: "primary" | "secondary" | "positive" | "negative";
    isMini?: boolean;
    disabled?: boolean;
    
    onClick?: React.MouseEventHandler;
}

export function Button({ children, style, isMini = false, disabled, onClick }: ButtonProps) {
    return (
        <button
            className={`btn-${style}` + (isMini ? " mini" : "")}
            type="button"
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}