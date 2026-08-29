import "./panel.scss"

import {
    Routes,
    Route,
    useLocation,
    Outlet,
    useParams,
} from "react-router-dom";
import AboutProblem from "./panels/problem/about-problem";
import AddProblem from "./panels/add-problem";
import SignIn from "./panels/sign-in";
import SignUp from "./panels/sign-up";
import Profile from "./panels/sign-out";
import AddCheck from "./panels/problem/add-check";
import ProblemPanel from "./panels/problem/problem";
import NotificationsPanel from "./panels/notifications";
import Leaderboard from "./panels/leaderboard";
import Analytics from "./panels/analytics";
import TasksPanel from "./panels/tasks";
import OrgPanel from "./panels/org";
import { useT } from "../../i18n";
import { useEffect } from "react";
import selectedMark from "../../store/selected_mark";
import selectedPoint from "../../store/selected_point";
import { observer } from "mobx-react-lite";
import panelStore from "../../store/panel";
import { useDeviceDetect } from "../../utils/hooks";
import { useNavigateKeepSearch } from "../../utils/navigation";
import ErrorBanner from "../error-banner/error-banner";
export default function PanelRoute() {
    return (
        <Routes>
            <Route path="/" element={<Panel />}>
                <Route index element={<></>} />
                <Route path="/problem/:id" element={<ProblemPanel />}>
                    <Route path="" element={<AboutProblem />} />
                    <Route path="add-check" element={<AddCheck />} />
                </Route>
                <Route path="/add" element={<AddProblem />} />
                <Route path='/signin' element={<SignIn />} />
                <Route path='/signup' element={<SignUp />} />
                <Route path='/profile' element={<Profile />} />
                <Route path='/notifications' element={<NotificationsPanel />} />
                <Route path='/leaderboard' element={<Leaderboard />} />
                <Route path='/analytics' element={<Analytics />} />
                <Route path='/tasks' element={<TasksPanel />} />
                <Route path='/org' element={<OrgPanel />} />
            </Route>
        </Routes>
    );
}

const Panel = observer(() => {
    const { isMobile } = useDeviceDetect();
    const { t } = useT();

    const location = useLocation();
    const navigate = useNavigateKeepSearch();
    const params = useParams();

    useEffect(() => {
        const markIdParam = params.id;
        selectedMark.setId(markIdParam ? Number(markIdParam) : 0);
    }, [params.id])

    useEffect(() => {
        if (location.pathname == "/add") {
            selectedPoint.showPoint();
        } else {
            selectedPoint.hidePoint();
        }
        if (location.pathname == "/") {
            panelStore.setHeight(0);
        }
    }, [location])

    const showCloseButton = !isMobile || (isMobile && !panelStore.isOpen);

    return (
        <>
            {location.pathname !== "/" ?
                <div
                    className={`panel ${panelStore.isOpen ? "open" : ""}`}
                >
                    {showCloseButton &&
                        <div className="panel__close-button" role="button" tabIndex={0} aria-label={t("common.close")}
                            onClick={() => navigate("/")}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/"); } }}
                        >
                            <div className="panel__close-button__content">
                                <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M0 14.545L1.455 16 8 9.455 14.545 16 16 14.545 9.455 8 16 1.455 14.545 0 8 6.545 1.455 0 0 1.455 6.545 8z" fillRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    }
                    <ErrorBanner />
                    <Outlet />
                </div >
                :
                <></>
            }
        </>
    );
});