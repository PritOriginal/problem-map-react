import { createContext } from "react";
import { Mark } from "../../../../services/MarksService";

export const emptyMark: Mark = {
    mark_id: 0,
    name: "",
    geom: {
        type: "Point",
        coordinates: [0, 0]
    },
    mark_type_id: 1,
    description: "",
    user_id: 0,
    mark_status_id: 0,
    created_at: "",
    updated_at: ""
}

export const MarkContext = createContext<Mark>(emptyMark)
/** Re-fetches the mark shown in the panel (and the marks on the map). */
export const MarkReloadContext = createContext<() => void>(() => {})
