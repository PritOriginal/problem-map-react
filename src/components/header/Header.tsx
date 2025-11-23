import "./Header.scss"

export default function Header() {
    return (
        <header>
            <div className="header-container">
                <div style={{display: "flex", gap: "32px"}}>
                    <p>Карта проблем</p>
                    <p style={{color: "#bdbdbdff"}}>Задания</p>
                    <p style={{color: "#bdbdbdff"}}>Рейтинг</p>
                </div>
                <div>
                    <p style={{color: "#bdbdbdff"}}>Логин</p>
                </div>
            </div>
        </header>
    );
}