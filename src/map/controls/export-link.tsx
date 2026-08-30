import type { ReactNode } from "react";
import { observer } from "mobx-react-lite";

import MarksService, { type ExportFormat } from "../../services/MarksService";
import marksStore from "../../store/marks";

/** Download link to `GET /marks/export` for the current filters (a real anchor is not blocked by popup blockers). */
const ExportLink = observer(({ format, children }: { format: ExportFormat; children: ReactNode }) => (
    <a
        className="btn-secondary mini"
        href={MarksService.exportUrl(marksStore.filters, format)}
        download={`marks.${format}`}
        target="_blank"
        rel="noopener"
    >
        {children}
    </a>
));

export default ExportLink;
