import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Check } from "../../../../../services/ChecksService";
import { MarkStatusHistoryItem, MarkStatusType } from "../../../../../services/MarksService";
import { TranslationKey, localeOf, tOr, useT } from "../../../../../i18n";
import user from "../../../../../store/user";
import DoubleProgressBar from "../../../../double-progress-bar/double-progress-bar";
import ReportButton from "../../../../report/report-button";
import { statusColors, STATUS_FALLBACK } from "../../../../../styles/tokens";
import { useTheme } from "../../../../../theme";
import { spanLabel } from "../../../../../utils/history-column";
import "../history-column.scss";
import "../checks.scss";

function getTitle(mark_status_id: number): string {
    return tOr(`mark.title.${mark_status_id}`, "");
}

function getQuestion(mark_status_id: number): string {
    switch (mark_status_id) {
        case MarkStatusType.UnconfirmedStatus:
        case MarkStatusType.ConfirmedStatus:
        case MarkStatusType.RediscoveredStatus:
            return tOr("mark.question.exists", "");
        case MarkStatusType.UnderReviewStatus:
            return tOr("mark.question.solved", "");
    }
    return "";
}

function getDate(dateStr: string, locale: string): string {
    const date = new Date(dateStr)
    return date.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

/** How many checks a collapsed block shows whole before the reader asks for the rest. */
const COLLAPSED_CHECKS = 2;

/**
 * One stratum of the column: the status changes that make up the layer, how long the
 * mark sat there, and -- when the status is one that can be asked about -- the verdict
 * the checks left on it.
 */
export function HistoryGroup({ group, depth, spanMs, isLast }: {
    group: MarkStatusHistoryItem[];
    depth: number;
    spanMs: number;
    isLast: boolean;
}) {
    const { t, lang } = useT();
    // `lang` re-renders the group when the language changes (titles/questions are read via tOr)
    void lang;

    const allChecks: Check[] = [];
    group.forEach((item) => {
        allChecks.push(...(item.checks ?? []));
    });

    const question = getQuestion(group[group.length - 1].new_mark_status_id);

    // The stratum takes the colour of the status that opened this layer -- from the
    // scale of the live theme, not the light one: the light greys vanish on a dark panel.
    const statuses = statusColors(useTheme().resolved);
    const statusId = group[0].new_mark_status_id;
    const span = spanLabel(spanMs);
    const duration = `${span.value} ${t(`common.${span.unit}` as TranslationKey)}`;

    return (
        <li className="core__layer" style={{ minHeight: `${depth}px` }}>
            <div className="core__spine" aria-hidden="true">
                <div
                    className="core__stratum"
                    style={{ height: `${depth}px`, backgroundColor: statuses[statusId] ?? STATUS_FALLBACK }}
                />
            </div>
            <div className="core__body">
                {group.map((item, i) => (
                    <HistoryItem key={item.id} item={item} isFirst={i === 0} />
                ))}
                <p className="core__span">{t(isLast ? "mark.stillInStatus" : "mark.spentInStatus", { duration })}</p>
                {question !== "" && <ChecksCard question={question} checks={allChecks} />}
            </div>
        </li>
    )
}

/**
 * One status change inside a stratum. The first one names the layer; any child
 * changes under it are set quieter, because they are steps within that status
 * rather than new layers of their own.
 */
function HistoryItem({ item, isFirst }: { item: MarkStatusHistoryItem, isFirst: boolean }) {
    const { lang } = useT();
    return (
        <div className={isFirst ? "core__head" : "core__step"}>
            <p className={isFirst ? "core__title" : undefined}>{getTitle(item.new_mark_status_id)}</p>
            <p className="core__time">{getDate(item.changed_at, localeOf(lang))}</p>
        </div>
    )
}

/**
 * The verdict on one layer: the question that was asked, the tally either way, and the
 * checks themselves. Collapsing is per layer, which is why the state lives here rather
 * than in the column.
 */
function ChecksCard({ question, checks }: { question: string; checks: Check[] }) {
    const { t } = useT();
    const [showChecks, setShowChecks] = useState(false);

    const confirmCount = checks.filter((check) => check.result).length;
    const refuteCount = checks.length - confirmCount;

    return (
        <>
            <div className="core__card">
                <DoubleProgressBar
                    question={question}
                    negative={refuteCount}
                    positive={confirmCount}
                />
            </div>
            {checks.length > 0 &&
                <div className="core__card checks">
                    <header className="checks__head">
                        <h3>{t("mark.checks")}</h3>
                        <span
                            className="checks__tally"
                            aria-label={t("mark.checksTally", { ok: confirmCount, no: refuteCount })}
                        >
                            <b className="ok">{confirmCount}</b>
                            <i aria-hidden="true">/</i>
                            <b className="no">{refuteCount}</b>
                        </span>
                    </header>

                    {/* Collapsed shows the FIRST FEW CHECKS WHOLE rather than a strip of
                        every photograph with the checks taken apart: in that strip a check
                        without photos left no trace at all, though it is just as much a vote. */}
                    <ol className="checks__list">
                        {(showChecks ? checks : checks.slice(0, COLLAPSED_CHECKS)).map((check) => (
                            <CheckItem key={check.check_id} check={check} />
                        ))}
                    </ol>

                    {checks.length > COLLAPSED_CHECKS &&
                        <button
                            type="button"
                            className="checks__more"
                            aria-expanded={showChecks}
                            onClick={() => setShowChecks(!showChecks)}
                        >
                            {showChecks
                                ? t("mark.checksCollapse")
                                : t("mark.checksMore", { n: checks.length - COLLAPSED_CHECKS })}
                        </button>
                    }
                </div>
            }
        </>
    );
}

/**
 * One check. The verdict is stated twice -- as the card's left rule and as a word
 * -- so it survives both a glance and a reader who cannot separate the two hues.
 */
const CheckItem = observer(function CheckItem({ check }: { check: Check }) {
    const { t, lang } = useT();
    return (
        <li className={`check check--${check.result ? "confirm" : "refute"}`}>
            <div className="check__top">
                <b className="check__author">{check.username}</b>
                <span className="check__verdict">{t(check.result ? "mark.confirmedBy" : "mark.refutedBy")}</span>
                <time className="check__time" dateTime={check.created_at}>{getDate(check.created_at, localeOf(lang))}</time>
            </div>
            {check.comment !== "" && <p className="check__comment">{check.comment}</p>}
            <div className="check__photos">
                {check.photos.length > 0
                    ? check.photos.map((src, index) => (
                        <img key={index} className="check__photo" src={src} alt="" />
                    ))
                    : <span className="check__nophotos">{t("mark.checkNoPhotos")}</span>
                }
            </div>
            {check.user_id !== user.id &&
                <div className="check__report">
                    <ReportButton targetType="check" targetId={check.check_id} small />
                </div>
            }
        </li>
    )
});
