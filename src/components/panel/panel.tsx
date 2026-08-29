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
import user from "../../store/user";
import { useDeviceDetect } from "../../utils/hooks";
import { useNavigateKeepSearch } from "../../utils/navigation";
import ErrorBanner from "../error-banner/error-banner";

/* Panels are the bulk of the bundle (~3700 lines across 15 screens) and a
   visitor opens one or two of them. Loading them on demand keeps the moderation,
   admin and analytics screens out of the first paint for everyone who never
   opens them.

   The import factories are named here rather than inlined into lazy() so the
   prefetch below can call the very same ones: a second `import()` of a module
   already in flight or resolved is deduplicated by the browser, so warming a
   chunk and later rendering its panel share one request. */
const load = {
    aboutProblem: () => import("./panels/problem/about-problem"),
    addProblem: () => import("./panels/add-problem"),
    signin: () => import("./panels/sign-in"),
    signup: () => import("./panels/sign-up"),
    profile: () => import("./panels/sign-out"),
    addCheck: () => import("./panels/problem/add-check"),
    problem: () => import("./panels/problem/problem"),
    notifications: () => import("./panels/notifications"),
    leaderboard: () => import("./panels/leaderboard"),
    analytics: () => import("./panels/analytics"),
    tasks: () => import("./panels/tasks"),
    org: () => import("./panels/org"),
    moderation: () => import("./panels/moderation/moderation"),
    admin: () => import("./panels/admin"),
    userProfile: () => import("./panels/user-profile"),
    queue: () => import("./panels/queue"),
};

const AboutProblem = lazy(load.aboutProblem);
const AddProblem = lazy(load.addProblem);
const SignIn = lazy(load.signin);
const SignUp = lazy(load.signup);
const Profile = lazy(load.profile);
const AddCheck = lazy(load.addCheck);
const ProblemPanel = lazy(load.problem);
const NotificationsPanel = lazy(load.notifications);
const Leaderboard = lazy(load.leaderboard);
const Analytics = lazy(load.analytics);
const TasksPanel = lazy(load.tasks);
const OrgPanel = lazy(load.org);
const ModerationPanel = lazy(load.moderation);
const AdminPanel = lazy(load.admin);
const UserProfilePanel = lazy(load.userProfile);
const QueuePanel = lazy(load.queue);

type PanelLoader = () => Promise<unknown>;

/**
 * What this visitor is most likely to open next, given who they are. Splitting the
 * panels traded bundle size for a round trip on the first navigation; warming the
 * likely chunks while the browser is idle buys the size back without the wait.
 *
 * `problem` is on every list: opening a mark is far and away the commonest move
 * from the map. Nothing here is role-restricted UI -- the panels do their own
 * authorisation -- so a warmed chunk grants nothing, it only saves a request.
 */
function likelyPanels(isSignedIn: boolean, isModerator: boolean, isService: boolean): PanelLoader[] {
    const loaders: PanelLoader[] = [load.problem, load.aboutProblem];
    if (isSignedIn) {
        loaders.push(load.notifications, load.profile);
    } else {
        loaders.push(load.signin);
    }
    if (isModerator) {
        loaders.push(load.moderation, load.admin);
    }
    if (isService) {
        loaders.push(load.org, load.tasks);
    }
    return loaders;
}

/**
 * `requestIdleCallback` with a `setTimeout` fallback -- Safari still ships without
 * it. Returns its own canceller so the caller does not have to remember which of
 * the two it got.
 */
function whenIdle(run: () => void): () => void {
    if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(run, { timeout: 2000 });
        return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(run, 1000);
    return () => window.clearTimeout(handle);
}

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

    // Read as plain values so the effect re-runs on sign-in/sign-out and on a role
    // change, rather than warming only whatever the visitor was when the map loaded.
    const isSignedIn = user.id !== 0;
    const { isModerator, isService } = user;
    useEffect(() => {
        return whenIdle(() => {
            // Failures are ignored on purpose: this is a guess about the next
            // navigation, and a chunk that will not load offline must not surface an
            // error here -- the real navigation will report it if it happens.
            likelyPanels(isSignedIn, isModerator, isService).forEach((loader) => { void loader().catch(() => {}); });
        });
    }, [isSignedIn, isModerator, isService]);

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