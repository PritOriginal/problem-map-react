import "./double-progress-bar.scss"
import { useT } from "../../i18n";

/**
 * The confirm/refute vote on a mark status, drawn as a balance beam.
 *
 * Both sides grow outward from a central fulcrum, so the reader sees which way
 * the evidence tips and by how much. The denominator is floored at 3 so that a
 * single early vote does not fill half the beam.
 */
const DoubleProgressBar = ({ question, negative, positive }: { question: string, negative: number, positive: number }) => {
    const { t } = useT();
    const total = Math.max(3, negative + positive);
    const refute = Math.min(1, negative / total) * 100;
    const confirm = Math.min(1, positive / total) * 100;

    return (
        <div className="vote-beam">
            <p className="vote-beam__question">{question}</p>
            <div
                className="vote-beam__beam"
                role="img"
                aria-label={`${t("mark.refutedVotes")}: ${negative}. ${t("mark.confirmedVotes")}: ${positive}.`}
            >
                <div className="vote-beam__side vote-beam__side--refute">
                    <div className="vote-beam__fill" style={{ width: `${refute}%` }}>
                        {negative > 0 && <span className="vote-beam__count">{negative}</span>}
                    </div>
                    {negative === 0 && <span className="vote-beam__count">0</span>}
                </div>
                <div className="vote-beam__pivot" aria-hidden="true" />
                <div className="vote-beam__side vote-beam__side--confirm">
                    <div className="vote-beam__fill" style={{ width: `${confirm}%` }}>
                        {positive > 0 && <span className="vote-beam__count">{positive}</span>}
                    </div>
                    {positive === 0 && <span className="vote-beam__count">0</span>}
                </div>
            </div>
            <div className="vote-beam__labels" aria-hidden="true">
                <p>{t("mark.refutedVotes")}</p>
                <p>{t("mark.confirmedVotes")}</p>
            </div>
        </div>
    );
};

export default DoubleProgressBar;
