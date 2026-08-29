import "./double-progress-bar.scss"
import { useT } from "../../i18n";

/**
 * The confirm/refute vote on a mark status, drawn as a balance beam.
 *
 * Both sides grow outward from a central fulcrum, so the reader sees which way
 * the evidence tips and by how much. The denominator is floored at 3 so that a
 * single early vote does not fill half the beam.
 *
 * The counts sit with the labels rather than inside the bars. Inside, a count is
 * only legible when its own side happens to be wide enough, and it changes
 * background colour underneath as the ratio moves. Beside the label it reads at
 * any ratio, in either theme -- and it is real text, so the beam itself can be
 * hidden from screen readers instead of carrying a describe-the-picture label.
 */
const DoubleProgressBar = ({ question, negative, positive }: { question: string, negative: number, positive: number }) => {
    const { t } = useT();
    const total = Math.max(3, negative + positive);
    const refute = Math.min(1, negative / total) * 100;
    const confirm = Math.min(1, positive / total) * 100;

    return (
        <div className="vote-beam">
            <p className="vote-beam__question">{question}</p>
            <div className="vote-beam__beam" aria-hidden="true">
                <div className="vote-beam__side vote-beam__side--refute">
                    <div className="vote-beam__fill" style={{ width: `${refute}%` }} />
                </div>
                <div className="vote-beam__pivot" />
                <div className="vote-beam__side vote-beam__side--confirm">
                    <div className="vote-beam__fill" style={{ width: `${confirm}%` }} />
                </div>
            </div>
            <div className="vote-beam__labels">
                <p className="vote-beam__label">
                    {t("mark.refutedVotes")}
                    <b className="vote-beam__count vote-beam__count--refute">{negative}</b>
                </p>
                <p className="vote-beam__label">
                    {t("mark.confirmedVotes")}
                    <b className="vote-beam__count vote-beam__count--confirm">{positive}</b>
                </p>
            </div>
        </div>
    );
};

export default DoubleProgressBar;
