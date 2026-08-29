import { useEffect, useRef } from "react";
import panelStore from "../../../store/panel";
import { NavLink, Outlet } from "react-router-dom";

export default function TasksPanel() {
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    const panelTabBarRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (panelHeaderRef.current && panelTabBarRef.current) {
            panelStore.setHeight(panelHeaderRef.current.offsetHeight + panelTabBarRef.current.offsetHeight)
            panelStore.setOpen(true);
        }
    }, []);

    return (
        <>
            <div
                ref={panelHeaderRef}
                className="panel__header"
                onClick={() => panelStore.toggle()}
            >
                <p><b>Задания</b></p>
            </div>
            <div ref={panelTabBarRef} className="panel__tab-bar">
                <NavLink
                    className={({ isActive }) =>
                        `panel__tab-bar__item ${isActive && "active"}`
                    }
                    to={"current"}
                >
                    <p>Текущие</p>
                </NavLink>
                <NavLink
                    className={({ isActive }) =>
                        `panel__tab-bar__item ${isActive && "active"}`
                    }
                    to={"completed"}
                >
                    <p>Выполненные</p>
                </NavLink>
            </div>
            <div className="panel__content">
                <Outlet />
            </div>
        </>
    )
}