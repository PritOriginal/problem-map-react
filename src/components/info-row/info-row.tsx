import "./info-row.scss"

export default function InfoRow({ spaceBetween=false, children }: { spaceBetween?: boolean, children: React.ReactNode }) {
    return(
        <div className={"info-row " + (spaceBetween ? "space-between" : "")}>
            {children}
        </div>
    ); 
}