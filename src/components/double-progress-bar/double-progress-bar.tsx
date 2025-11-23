
import "./double-progress-bar.scss"

const DoubleProgressBar = ({ negative, positive }: { negative: number, positive: number }) => {
    var sum = negative + positive;
    if (sum < 5) {
        sum = 5
    }

    return (
        <div className="double-progress-bar">
            <div className="double-progress-bar__left__zone"></div>
            <div className="double-progress-bar__left" style={{ width: `${Math.min(1, negative / sum / 0.7) * 50}%` }}>
                <span className="double-progress-bar__left__text">{negative}</span>
            </div>
            <div className="double-progress-bar__right__zone"></div>
            <div className="double-progress-bar__right" style={{ width: `${Math.min(1, positive / sum / 0.7) * 50}%` }}>
                <span className="double-progress-bar__right__text">{positive}</span>
            </div>
        </div>
    );
};

export default DoubleProgressBar;
