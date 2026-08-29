import { KeyboardEvent, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { LngLat } from "@yandex/ymaps3-types";
import user from "../../../store/user";
import notificationsStore from "../../../store/notifications";
import markTypesStore from "../../../store/mark-types";
import taskStatusesStore from "../../../store/task-statuses";
import selectedMark from "../../../store/selected_mark";
import TasksService, { Task, TaskStatusType } from "../../../services/TasksService";
import MarksService, { Mark } from "../../../services/MarksService";
import UnauthorizedBlock from "../../unauthorized-block/unauthorized-block";
import { Button } from "../../button/button";
import { MarkBadges } from "../../badges/badges";
import { TypeIcon } from "../../mark/mark";
import { useNavigateKeepSearch } from "../../../utils/navigation";
import { deadlineState, formatDateTime, formatDeadline } from "../../../utils/deadline";
import { useNow } from "../../../utils/hooks";
import { mapWithLimit } from "../../../utils/concurrency";
import { TranslationKey, localeOf, useT } from "../../../i18n";
import "../../badges/badges.scss";
import PanelHeader from "../panel-header";

export const TASKS_LIMIT = 100;
/** How many `GET /marks/{id}` requests run at once while filling the task cards. */
const MARKS_CONCURRENCY = 6;

type TabKey = "current" | "done" | "overdue";

const TABS: { key: TabKey; label: TranslationKey; statuses: number[] }[] = [
    { key: "current", label: "tasks.tab.current", statuses: [TaskStatusType.Assigned] },
    { key: "done", label: "tasks.tab.done", statuses: [TaskStatusType.Done] },
    { key: "overdue", label: "tasks.tab.overdue", statuses: [TaskStatusType.Overdue] },
];

/** `/tasks`: the user's tasks by status, each with its mark (backend integration/wave-4). */
const TasksPanel = observer(function TasksPanel() {
    const { t } = useT();

    const userId = user.id;
    const [tab, setTab] = useState<TabKey>("current");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [marks, setMarks] = useState<Record<number, Mark>>({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (userId === 0) {
            return;
        }
        let ignore = false;
        setIsLoading(true);
        const statuses = TABS.find((x) => x.key === tab)!.statuses;
        TasksService.getUserTasks(userId, { statuses, limit: TASKS_LIMIT, offset: 0 })
            .then(async (data) => {
                if (ignore) {
                    return;
                }
                const list = data.payload ?? [];
                setTasks(list);
                // marks are loaded per task (there is no batch endpoint); failures leave the card without details
                const ids = Array.from(new Set(list.map((task) => task.mark_id)));
                const loaded = await mapWithLimit(ids, MARKS_CONCURRENCY, (id) => MarksService.getMarkById(id));
                if (ignore) {
                    return;
                }
                const byId: Record<number, Mark> = {};
                loaded.forEach((res, index) => {
                    if (res.status === "fulfilled") {
                        byId[ids[index]] = res.value.payload.mark;
                    } else {
                        console.error(res.reason);
                    }
                });
                setMarks(byId);
            })
            .catch((error) => {
                if (ignore) {
                    return;
                }
                console.error(error);
                notificationsStore.showError(error, t("tasks.loadFailed"));
            })
            .finally(() => {
                if (!ignore) {
                    setIsLoading(false);
                }
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, tab]);

    useEffect(() => {
        if (userId !== 0) {
            taskStatusesStore.fetch();
        }
    }, [userId]);

    /** Left/Right arrows move between tabs and focus the newly selected one (WAI-ARIA tabs). */
    const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (step === 0) {
            return;
        }
        e.preventDefault();
        const index = TABS.findIndex((x) => x.key === tab);
        const next = TABS[(index + step + TABS.length) % TABS.length].key;
        setTab(next);
        document.getElementById(`tasks-tab-${next}`)?.focus();
    };

    return (
        <>
            <PanelHeader openOnMount title={t("tasks.title")} subtitle={t("tasks.subtitle")} />
            <div className="panel__content">
                {userId === 0 ?
                    <UnauthorizedBlock text={t("unauth.tasks")} />
                    :
                    <>
                        <div className="tabs" role="tablist" aria-label={t("tasks.title")} onKeyDown={onTabsKeyDown}>
                            {TABS.map((item) => (
                                <button
                                    key={item.key}
                                    id={`tasks-tab-${item.key}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === item.key}
                                    aria-controls="tasks-tabpanel"
                                    tabIndex={tab === item.key ? 0 : -1}
                                    className={`tabs__item ${tab === item.key ? "active" : ""}`}
                                    onClick={() => setTab(item.key)}
                                >
                                    {t(item.label)}
                                </button>
                            ))}
                        </div>
                        <div id="tasks-tabpanel" role="tabpanel" aria-labelledby={`tasks-tab-${tab}`}>
                            {isLoading && tasks.length === 0 && <p className="empty-state">{t("common.loading")}</p>}
                            {!isLoading && tasks.length === 0 && <p className="empty-state">{t("tasks.empty")}</p>}
                            <div className="profile-list">
                                {tasks.map((task) => <TaskCard key={task.task_id} task={task} mark={marks[task.mark_id]} />)}
                            </div>
                        </div>
                    </>
                }
            </div>
        </>
    );
});

const TaskCard = observer(function TaskCard({ task, mark }: { task: Task; mark?: Mark }) {
    const { t, lang } = useT();
    const navigate = useNavigateKeepSearch();
    const now = useNow();
    const deadline = deadlineState(task.due_at, now);
    const isDone = task.status_id === TaskStatusType.Done;
    const overdue = task.status_id === TaskStatusType.Overdue || (!isDone && deadline?.overdue === true);

    const type = mark ? markTypesStore.types.find((x) => x.mark_type_id === mark.mark_type_id) : undefined;

    const showOnMap = () => {
        if (mark) {
            selectedMark.setId(mark.mark_id);
            selectedMark.setLoadedCoords(mark.mark_id, mark.geom.coordinates as LngLat);
        }
        navigate(`/problem/${task.mark_id}`);
    };

    return (
        <div className={`task-card ${overdue ? "overdue" : ""}`}>
            <div className="task-card__row">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    {mark && <TypeIcon typeId={mark.mark_type_id} type={type} color="#000" />}
                    <p style={{ fontSize: 14 }}><b>{t("common.problemN", { id: task.mark_id })}</b> {type?.name ?? ""}</p>
                </div>
                <span className="profile-list__status" style={{ borderColor: overdue ? "var(--danger-ink)" : isDone ? "var(--success-ink)" : "var(--ink-muted)" }}>
                    {taskStatusesStore.nameOf(task.status_id)}
                </span>
            </div>
            {task.name !== "" && <p style={{ fontSize: 13 }}>{task.name}</p>}
            {mark && mark.description !== "" && <p className="task-card__desc">{mark.description}</p>}
            {mark && <MarkBadges mark={mark} />}
            <div className="task-card__row">
                <p style={{ fontSize: 12 }}>
                    {t("tasks.due")}: {task.due_at ? formatDateTime(task.due_at, localeOf(lang)) : t("tasks.noDue")}
                </p>
                {deadline && !isDone &&
                    <span className={`deadline ${deadline.overdue ? "overdue" : deadline.soon ? "soon" : ""}`}>
                        {formatDeadline(task.due_at, now, lang)}
                    </span>
                }
            </div>
            <div className="task-card__actions">
                <Button style="secondary" isMini onClick={showOnMap}>{t("tasks.showOnMap")}</Button>
                {!isDone &&
                    <Button style="primary" isMini onClick={() => navigate(`/problem/${task.mark_id}/add-check`)}>
                        {t("tasks.check")}
                    </Button>
                }
            </div>
        </div>
    );
});

export default TasksPanel;
