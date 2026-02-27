
import "./double-progress-bar.scss"

const DoubleProgressBar = ({ negative, positive }: { negative: number, positive: number }) => {
    let sum = negative + positive;
    if (sum < 3) {
        sum = 3
    }

    return (
        <div className="double-progress-bar">
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
                <p>Опровергли</p>
                <p>Подтвердили</p>
            </div>
        </div>
    );
};

export default DoubleProgressBar;
