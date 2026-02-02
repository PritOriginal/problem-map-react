import "./panel.scss"

import {
    Routes,
    Route,
    useLocation,
    Outlet,
    useNavigate,
    useParams,
} from "react-router-dom";
import AboutProblem from "./panels/problem/about-problem";
import AddProblem from "./panels/add-problem";
import SignIn from "../../SignIn";
import SignUp from "../../SignUp";
import SignOut from "../../SignOut";
import AddCheck from "./panels/problem/add-check";
import ProblemPanel from "./panels/problem/problem";
import { useEffect } from "react";
import selectedMark from "../../store/selected_mark";
import selectedPoint from "../../store/selected_point";
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
            </Route>
            <Route path='/signin' element={<SignIn />} />
            <Route path='/signup' element={<SignUp />} />
            <Route path='/signout' element={<SignOut />} />
        </Routes>
    );
}

function Panel() {
    const location = useLocation();
    const navigate = useNavigate();
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
    }, [location])

    return (
        <>
            {location.pathname !== "/" ?
                <div className="panel">
                    <div className="panel__close-button" onClick={() => { navigate("/") }}>
                        <div className="panel__close-button__content">
                            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0 14.545L1.455 16 8 9.455 14.545 16 16 14.545 9.455 8 16 1.455 14.545 0 8 6.545 1.455 0 0 1.455 6.545 8z" fillRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                    <Outlet />
                </div>
                :
                <></>
            }
        </>
    );
}