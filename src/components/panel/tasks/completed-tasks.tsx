import { useEffect, useState } from "react";
import TasksService, { Task, TaskStatusType } from "../../../services/TasksService";
import user from "../../../store/user";
import { COLOR_MARK_STATUSES, TypeMarkIcons } from "../../mark/mark";
import MarksService, { Mark, MarkType } from "../../../services/MarksService";
import markTypesStore from "../../../store/mark-types";
import { Link } from "react-router-dom";

export default function CompletedTasksPanel() {
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        TasksService.getTasksByUserId(user.id, {
            statuses: [
                TaskStatusType.CompletedStatus,
            ]
        })
            .then((data) => {
                console.log(data.payload)
                setTasks(data.payload.tasks);
            })
            .catch(function (error) {
                console.log(error);
            });
    }, [])

    return (
        <>
            {tasks.map((task) => (
                <TaskItem task={task} />
            ))}
        </>
    )
}

function TaskItem({ task }: { task: Task }) {
    // const mark = marksStore.marks.find((v) => v.mark_id == task.mark_id);
    const [mark, setMark] = useState<Mark | undefined>(undefined);

    useEffect(() => {
        MarksService.getMarkById(task.mark_id)
            .then((data) => {
                console.log(data.payload)
                setMark(data.payload.mark);
            })
            .catch(function (error) {
                console.log(error);
            });
    }, [])

    const markColor = mark ? COLOR_MARK_STATUSES[mark.mark_status_id] : "#fff";

    let markType: MarkType = { mark_type_id: 0, name: "" };
    if (mark && markTypesStore.types.length > 0 && mark.mark_type_id !== 0) {
        const findType = markTypesStore.types.find((type) => type.mark_type_id == mark.mark_type_id);
        if (findType) {
            markType = findType
        }
    }

    return (
        <Link className="task-item" to={`/problem/${task.mark_id}`}>
            <div
                className="task-item__icon"
                style={{ backgroundColor: markColor }}
            >
                <div className="task-item__icon__content">
                    {mark && TypeMarkIcons[mark!.mark_type_id]({ color: "#000" })}
                </div>
            </div>
            <div className="task-item__content">
                <p className="task-item__content__title">Провести проверку</p>
                <p className="task-item__content__mark-type">{markType.name}</p>
            </div>
            <p className="task-item__mark-id">
                <p>№{task.mark_id}</p>
            </p>
        </Link>
    )
}