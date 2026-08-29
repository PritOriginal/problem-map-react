import { useEffect, useMemo, useRef, useState } from "react";
import notificationsStore from "../../../../store/notifications";
import AdminService, { AdminSettings } from "../../../../services/AdminService";
import { NumericField, SETTINGS_FIELDS, getPath, normalizeSettings, setPath, validateSettings } from "../../../../utils/admin-settings";
import { useAsyncData } from "../../../../utils/use-async-data";
import { Button } from "../../../button/button";
import { TranslationKey, useT } from "../../../../i18n";

/** How long the "saved" label stays on the save button. */
const OK_TIMEOUT_MS = 2500;

/**
 * Settings tab of `/admin`: `GET /admin/settings` into an editable copy, validated
 * client-side and sent back with `PUT`.
 */
export const SettingsForm = function SettingsForm() {
    const { t } = useT();
    const [saved, setSaved] = useState<AdminSettings | null>(null);
    const [form, setForm] = useState<AdminSettings | null>(null);
    const [pending, setPending] = useState(false);
    const [ok, setOk] = useState(false);

    // The "saved" label clears itself on a timer; unmounting in the meantime has to
    // cancel it, or the callback calls setOk on a component that is gone.
    const okTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(okTimer.current), []);

    // The loaded settings seed two pieces of state -- the saved copy and the editable
    // form -- so the answer is copied into them once rather than read from `data`.
    const { data: loaded } = useAsyncData(
        (signal) => AdminService.getSettings({ signal }).then((res) => normalizeSettings(res.payload)),
        [],
        { errorMessage: t("admin.settingsLoadFailed") },
    );

    useEffect(() => {
        if (loaded) {
            setSaved(loaded);
            setForm(loaded);
        }
    }, [loaded]);

    // Field-wise, and only when one of the two objects is replaced: the previous
    // `JSON.stringify(form) !== JSON.stringify(saved)` serialised the whole settings
    // tree twice on every keystroke and every unrelated re-render.
    const dirty = useMemo(
        () => form !== null && saved !== null && !settingsEqual(form, saved),
        [form, saved],
    );

    if (!form || !saved) {
        return <p className="empty-state">{t("common.loading")}</p>;
    }

    const errors = validateSettings(form);

    const save = () => {
        if (Object.keys(errors).length > 0) {
            notificationsStore.showError(null, t("admin.invalid"));
            return;
        }
        setPending(true);
        AdminService.updateSettings(form)
            .then((data) => {
                notificationsStore.clear();
                const s = normalizeSettings(data.payload ?? form);
                setSaved(s);
                setForm(s);
                setOk(true);
                window.clearTimeout(okTimer.current);
                okTimer.current = window.setTimeout(() => setOk(false), OK_TIMEOUT_MS);
            })
            .catch((error) => {
                console.error(error);
                notificationsStore.showError(error, t("admin.settingsSaveFailed"));
            })
            .finally(() => setPending(false));
    };

    const numberField = (path: string) => {
        const field: NumericField | undefined = SETTINGS_FIELDS.find((f) => f.path === path);
        if (!field) {
            // Every call below passes a path out of SETTINGS_FIELDS, so this is
            // unreachable -- but saying so honestly beats a non-null assertion that
            // would crash on `field.min` if a path were ever renamed on one side only.
            return null;
        }
        const error = errors[path];
        return (
            <label key={path} className={`admin-field ${error ? "invalid" : ""}`}>
                <span>{t(`admin.settings.${path}` as TranslationKey)}</span>
                <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.integer ? 1 : 0.01}
                    value={String(getPath(form, path) ?? "")}
                    onChange={(e) => setForm(setPath(form, path, e.target.value === "" ? NaN : Number(e.target.value)))}
                />
                <small>{t("admin.range", { min: field.min, max: field.max })}</small>
            </label>
        );
    };

    return (
        <div className="admin-form">
            <div className="admin-grid">
                {numberField("vote_threshold")}
                {numberField("dedup_radius_m")}
                {numberField("max_checks_per_day")}
            </div>
            <p><b>{t("admin.settings.rating")}</b></p>
            <div className="admin-grid">
                {(["check_correct", "check_wrong", "mark_confirmed", "mark_refuted", "task_completed"] as const).map((k) => numberField(`rating.${k}`))}
            </div>
            <p><b>{t("admin.settings.tasker")}</b></p>
            <div className="admin-grid">
                {numberField("tasker.max_tasks_per_user")}
                {numberField("tasker.target_probability")}
                {numberField("tasker.max_radius_meters")}
                <label className={`admin-field ${errors["tasker.task_ttl"] ? "invalid" : ""}`}>
                    <span>{t("admin.settings.tasker.task_ttl")}</span>
                    <input type="text" value={form.tasker.task_ttl} onChange={(e) => setForm(setPath(form, "tasker.task_ttl", e.target.value))} />
                    <small>1h30m · 24h · 90m</small>
                </label>
            </div>
            <div className="task-card__actions">
                <Button style="positive" disabled={pending || !dirty || Object.keys(errors).length > 0} onClick={save}>
                    {t(pending ? "common.saving" : ok ? "admin.settingsSaved" : "common.save")}
                </Button>
                <Button style="secondary" disabled={pending || !dirty} onClick={() => setForm(saved)}>{t("admin.reset")}</Button>
            </div>
        </div>
    );
};

/**
 * Equality over exactly the fields the form can edit: the numeric paths plus the one
 * free-text duration. `Object.is` so a cleared numeric input (NaN) equals itself, which
 * is what serialising both sides to `null` used to give.
 */
function settingsEqual(a: AdminSettings, b: AdminSettings): boolean {
    if (!Object.is(a.tasker.task_ttl, b.tasker.task_ttl)) {
        return false;
    }
    return SETTINGS_FIELDS.every((field) => Object.is(getPath(a, field.path), getPath(b, field.path)));
}

export default SettingsForm;
