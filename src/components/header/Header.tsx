import { useEffect, useRef, useState } from "react";
import { Button } from "../button/button";
import "./Header.scss"
import MapService from "../../services/MapService";
import InfoRow from "../info-row/info-row";

export default function Header() {
    const [showAddMenu, setShowAddMenu] = useState(false);
    return (
        <header>
            <div className="header-container">
                <p>Карта проблем</p>
                <div>
                    <Button style="white-2-black" onClick={() => setShowAddMenu(!showAddMenu)}>
                        <p>Добавить метку</p>
                    </Button>
                </div>
            </div>
            {showAddMenu && <AddMarkMenu />}
        </header>
    );
}

function AddMarkMenu() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const photoRef = useRef<HTMLCanvasElement>(null);

    const getVideo = () => {
        navigator.mediaDevices
            .getUserMedia({
                video: {},
            })
            .then(stream => {
                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    video.play();
                }
            })
            .catch(err => {
                console.error(err);
            })
    }

    const makePhoto = () => {
        const video = videoRef.current;
        const photo = photoRef.current;

        if (video && photo) {
            const ctx = photo.getContext("2d");
            ctx!.drawImage(video, 0, 0);
            photo.toBlob((blob) => {
                console.log(blob);
                if (blob) {
                    MapService.addPhoto(blob);
                }
            });
        }
    }

    useEffect(() => {
        getVideo();
        // getUserLocation();
    }, [videoRef])

    return (
        <div className="add-mark-menu">
            <div className="camera">
                <video ref={videoRef} width={320}></video>
                <canvas ref={photoRef} width={640} height={480}></canvas>
            </div>
            <Button style="white-2-black" onClick={makePhoto}>
                <p>Сделать фото</p>
            </Button>
            <InfoRow>
                <p>Название метки</p>
                <input type="text" className="edit-multiline-text" />
            </InfoRow>
            {/* <InfoRow>
                <p>Пользователь:</p>
                <p>Пользователь 1</p>
            </InfoRow> */}
            <InfoRow>
                <p>Район</p>
                <input type="text" className="edit-multiline-text" />
            </InfoRow>
        </div>
    )
}