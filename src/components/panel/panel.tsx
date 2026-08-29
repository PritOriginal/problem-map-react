import "./panel.scss"

import {
    Routes,
    Route,
    useLocation,
    Outlet,
    useParams,
} from "react-router-dom";
import { useT } from "../../i18n";
import { lazy, Suspense, useEffect } from "react";
import selectedMark from "../../store/selected_mark";
import selectedPoint from "../../store/selected_point";
import { observer } from "mobx-react-lite";
import panelStore from "../../store/panel";
import { useDeviceDetect } from "../../utils/hooks";
import { useNavigateKeepSearch } from "../../utils/navigation";
import ErrorBanner from "../error-banner/error-banner";

/* Panels are the bulk of the bundle (~3700 lines across 15 screens) and a
   visitor opens one or two of them. Loading them on demand keeps the moderation,
   admin and analytics screens out of the first paint for everyone who never
   opens them. */
const AboutProblem = lazy(() => import("./panels/problem/about-problem"));
const AddProblem = lazy(() => import("./panels/add-problem"));
const SignIn = lazy(() => import("./panels/sign-in"));
const SignUp = lazy(() => import("./panels/sign-up"));
const Profile = lazy(() => import("./panels/sign-out"));
const AddCheck = lazy(() => import("./panels/problem/add-check"));
const ProblemPanel = lazy(() => import("./panels/problem/problem"));
const NotificationsPanel = lazy(() => import("./panels/notifications"));
const Leaderboard = lazy(() => import("./panels/leaderboard"));
const Analytics = lazy(() => import("./panels/analytics"));
const TasksPanel = lazy(() => import("./panels/tasks"));
const OrgPanel = lazy(() => import("./panels/org"));
const ModerationPanel = lazy(() => import("./panels/moderation"));
const AdminPanel = lazy(() => import("./panels/admin"));
const UserProfilePanel = lazy(() => import("./panels/user-profile"));
const QueuePanel = lazy(() => import("./panels/queue"));

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
                <Route path='/moderation' element={<ModerationPanel />} />
                <Route path='/admin' element={<AdminPanel />} />
                <Route path='/users/:id' element={<UserProfilePanel />} />
                <Route path='/queue' element={<QueuePanel />} />
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

    const isProblemRoute = location.pathname.startsWith("/problem/");
    useEffect(() => {
        const markIdParam = isProblemRoute ? params.id : undefined;
        selectedMark.setId(markIdParam ? Number(markIdParam) : 0);
    }, [params.id, isProblemRoute])

    useEffect(() => {
        if (location.pathname == "/add") {
            selectedPoint.setAddMode();
        } else if (location.pathname == "/signup") {
            selectedPoint.setSignupMode();
        } else {
            selectedPoint.hideAll();
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
                    {/* Inside the shell, not around <Routes>: a boundary above the
                        shell would tear down the close button and the error banner
                        on every panel-to-panel move and flash the whole panel. */}
                    <Suspense fallback={<p className="empty-state">{t("common.loading")}</p>}>
                        <Outlet />
                    </Suspense>
                </div >
                :
                <></>
            }
        </>
    );
});