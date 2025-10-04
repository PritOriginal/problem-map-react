import React from "react";
import "./button.scss"

interface ButtonProps {
    children: React.ReactNode;
    style: "white-2-black" | "black-2-white";
    isMini?: boolean;
    disabled?: boolean;
    
    onClick?: React.MouseEventHandler;
}

export function Button({ children, style, isMini = false, disabled, onClick }: ButtonProps) {
    return (
        <button
            className={style + (isMini ? " mini" : "")}
            type="button"
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}