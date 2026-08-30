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
    const changedCount = useMemo(
        () => (form === null || saved === null ? 0 : countChanged(form, saved)),
        [form, saved],
    );
    const dirty = changedCount > 0;

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

    // The range used to be repeated under every one of the nine fields as
    // "Диапазон 1–100" -- the same fact `min`/`max` already carry, spelled out nine
    // times. It stays only where it differs per field; the rating group shares one
    // range for all five of its fields, so that one is stated once, on the group.
    const numberField = (path: string, showRange = true) => {
        const field: NumericField | undefined = SETTINGS_FIELDS.find((f) => f.path === path);
        if (!field) {
            // Every call below passes a path out of SETTINGS_FIELDS, so this is
            // unreachable -- but saying so honestly beats a non-null assertion that
            // would crash on `field.min` if a path were ever renamed on one side only.
            return null;
        }
        const error = errors[path];
        const changed = !Object.is(getPath(form, path), getPath(saved, path));
        return (
            <label key={path} className={`admin-row ${error ? "invalid" : ""} ${changed ? "changed" : ""}`}>
                <span>{t(`admin.settings.${path}` as TranslationKey)}</span>
                {showRange && <em>{field.min}–{field.max}</em>}
                <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.integer ? 1 : 0.01}
                    value={String(getPath(form, path) ?? "")}
                    onChange={(e) => setForm(setPath(form, path, e.target.value === "" ? NaN : Number(e.target.value)))}
                />
            </label>
        );
    };

    return (
        <div className="admin-form">
            {/* Three cards, one per group, each saying what the group is for. These
                settings are edited by an administrator who opens this screen once a
                quarter and does not remember what "целевая вероятность" means; the
                old form gave the groups nothing but a bold word of the same size as
                the field labels, so they did not read as groups at all. */}
            <section className="admin-card">
                <h3 className="admin-card__h">
                    {t("admin.settings.confirm")}
                    <s>{t("admin.settings.confirmHint")}</s>
                </h3>
                {numberField("vote_threshold")}
                {numberField("dedup_radius_m")}
                {numberField("max_checks_per_day")}
            </section>
            <section className="admin-card">
                <h3 className="admin-card__h">
                    {t("admin.settings.rating")}
                    <s>{t("admin.settings.ratingHint")}</s>
                </h3>
                {(["check_correct", "check_wrong", "mark_confirmed", "mark_refuted", "task_completed"] as const).map((k) => numberField(`rating.${k}`, false))}
            </section>
            <section className="admin-card">
                <h3 className="admin-card__h">
                    {t("admin.settings.tasker")}
                    <s>{t("admin.settings.taskerHint")}</s>
                </h3>
                {numberField("tasker.max_tasks_per_user")}
                {numberField("tasker.target_probability")}
                {numberField("tasker.max_radius_meters")}
                <label className={`admin-row admin-row--wide ${errors["tasker.task_ttl"] ? "invalid" : ""} ${form.tasker.task_ttl !== saved.tasker.task_ttl ? "changed" : ""}`}>
                    <span>{t("admin.settings.tasker.task_ttl")}</span>
                    <em>24h · 90m</em>
                    <input type="text" value={form.tasker.task_ttl} onChange={(e) => setForm(setPath(form, "tasker.task_ttl", e.target.value))} />
                </label>
            </section>
            {/* The save bar says what state the form is in before it offers the
                action. Both buttons used to be full-width grey blocks, and a
                disabled "Сохранить" that size reads as broken rather than as
                "nothing to save". */}
            <div className={`admin-save ${dirty ? "admin-save--dirty" : ""}`}>
                <span>{dirty ? t("admin.changed", { n: changedCount }) : ok ? t("admin.settingsSaved") : t("admin.unchanged")}</span>
                {dirty && <Button style="secondary" isMini disabled={pending} onClick={() => setForm(saved)}>{t("admin.reset")}</Button>}
                <Button style="positive" isMini disabled={pending || !dirty || Object.keys(errors).length > 0} onClick={save}>
                    {t(pending ? "common.saving" : "common.save")}
                </Button>
            </div>
        </div>
    );
};

/**
 * How many of the editable fields differ -- the numeric paths plus the one free-text
 * duration. `Object.is` so a cleared numeric input (NaN) equals itself, which is what
 * serialising both sides to `null` used to give.
 *
 * A count, not a boolean: the save bar says how many fields are unsaved, and the
 * previous `JSON.stringify(form) !== JSON.stringify(saved)` serialised the whole
 * settings tree twice on every keystroke to answer even the boolean question.
 */
function countChanged(a: AdminSettings, b: AdminSettings): number {
    const ttl = Object.is(a.tasker.task_ttl, b.tasker.task_ttl) ? 0 : 1;
    return ttl + SETTINGS_FIELDS.filter((field) => !Object.is(getPath(a, field.path), getPath(b, field.path))).length;
}

export default SettingsForm;
