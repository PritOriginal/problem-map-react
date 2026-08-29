import { useContext, useEffect, useState } from "react";
import Select from "react-select";
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
            <Select
                options={options}
                value={current}
                placeholder={t("mark.noOrganization")}
                isDisabled={pending || options.length === 0}
                isLoading={organizationsStore.isLoading}
                onChange={(val) => { if (val && val.value !== mark.organization_id) { assign(val.value); } }}
            />
            <hr />
        </>
    );
});
