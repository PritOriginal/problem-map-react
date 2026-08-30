/** Value/label metric tile; place inside a `.stat-grid` container. */
export function StatTile({ value, label }: { value: number | string; label: string }) {
    return (
        <div className="stat-grid__item">
            <b>{value}</b>
            <span>{label}</span>
        </div>
    );
}
