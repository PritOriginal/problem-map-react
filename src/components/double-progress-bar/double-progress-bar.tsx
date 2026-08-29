
import "./double-progress-bar.scss"
import { useT } from "../../i18n";

const DoubleProgressBar = ({ question, negative, positive }: { question: string, negative: number, positive: number }) => {
    const { t } = useT();
    let sum = negative + positive;
    if (sum < 3) {
        sum = 3
    }

    return (
        <div className="double-progress-bar">
            <p className="double-progress-bar__title">{question}</p>
            <div className="double-progress-bar__scale">
                <div className="double-progress-bar__scale__left__zone"></div>
                <div className="double-progress-bar__scale__left" style={{ width: `${Math.min(1, negative / sum) * 50}%` }}>
                    <span className="double-progress-bar__scale__left__text">{negative}</span>
                </div>
                <div className="double-progress-bar__scale__right__zone"></div>
                <div className="double-progress-bar__scale__right" style={{ width: `${Math.min(1, positive / sum) * 50}%` }}>
                    <span className="double-progress-bar__scale__right__text">{positive}</span>
                </div>
            </div>
            <div className="double-progress-bar__signatures">
                <p>{t("mark.refutedVotes")}</p>
                <p>{t("mark.confirmedVotes")}</p>
            </div>
        </div>
    );
};

export default DoubleProgressBar;
