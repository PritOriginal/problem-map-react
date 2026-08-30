import { useContext, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import MarksService from "../../../../../services/MarksService";
import { useT } from "../../../../../i18n";
import notificationsStore from "../../../../../store/notifications";
import organizationsStore from "../../../../../store/organizations";
import { MarkContext } from "../mark-context";

/** Moderator/admin: assigns the mark to an organization (`PATCH /marks/{id}/assign`). */
export const AssignBlock = observer(function AssignBlock({ onDone }: { onDone: () => void }) {
    const mark = useContext(MarkContext);
    const { t } = useT();
    const [pending, setPending] = useState(false);

    useEffect(() => {
        organizationsStore.fetch();
    }, []);

    const options = organizationsStore.items.map((o) => ({ value: o.organization_id, label: o.name }));
    const current = options.find((o) => o.value === mark.organization_id) ?? null;

    const assign = (organizationId: number) => {
        setPending(true);
        MarksService.assignMark(mark.mark_id, organizationId)
            .then(() => {
                notificationsStore.clear();
                onDone();
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("mark.assignFailed"));
            })
            .finally(() => setPending(false));
    };

    return (
        <>
            <p><b>{t("mark.assignOrganization")}</b></p>
            {/* A native <select>, not react-select: this is one organization out of a
                short list, with no search, no multiple choice and no custom option
                rendering -- nothing the library was carrying its ~100 KB (plus its two
                @emotion runtimes) for. `add-problem` dropped it for the same reason.
                The global rule in index.scss styles the control, and it follows the
                dark theme, which react-select's inline colours never did. */}
            <select
                aria-label={t("mark.assignOrganization")}
                value={current ? current.value : 0}
                disabled={pending || options.length === 0}
                onChange={(e) => {
                    const organizationId = Number(e.target.value);
                    if (organizationId !== 0 && organizationId !== mark.organization_id) {
                        assign(organizationId);
                    }
                }}
            >
                {/* The "no organization yet" line. Disabled, so it reads as a placeholder
                    rather than as an "unassign" the endpoint does not offer. */}
                <option value={0} disabled>
                    {organizationsStore.isLoading ? t("common.loading") : t("mark.noOrganization")}
                </option>
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <hr />
        </>
    );
});
