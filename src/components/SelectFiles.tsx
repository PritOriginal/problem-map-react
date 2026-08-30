import { ChangeEvent, useEffect, useMemo, useRef } from "react";
import { useT } from "../i18n";
import "./select-files.scss";

interface SelectFilesProps {
    /** The chosen files. Controlled: the picker keeps no copy of its own. */
    files: File[];
    onChange: (files: File[]) => void;
    /** Upper bound on how many may be attached; the buttons go away at the limit. */
    max?: number;
}

export const PHOTOS_MAX = 5;

function CameraIcon({ size = 22 }: { size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5h3l1.5-2h9L18 8.5h3v11H3z" />
            <circle cx="12" cy="13.5" r="3.2" />
        </svg>
    );
}

function GalleryIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 5h18v14H3z" />
            <path d="M3 16l5-5 4 4 3-3 6 6" />
            <circle cx="8.5" cy="9" r="1.4" />
        </svg>
    );
}

/**
 * Photo picker.
 *
 * Two routes, not one. `accept="image/*"` on its own opens the system file
 * chooser, but the case this app is built for is someone standing in front of
 * the problem with a phone: "Снять" carries `capture="environment"` and opens
 * the camera directly, which is why it is the accented one.
 *
 * Empty, the field is a zone that says what it wants and how many it takes; the
 * old empty state was a 72px square with a plus in it, which promised nothing
 * while being the one field the form cannot be submitted without. Once there is
 * a photo the zone collapses to a row of thumbnails, because by then the reader
 * knows what the field is for.
 *
 * Controlled on purpose. It used to hold the list in its own state as well as
 * hand it to the parent, and those two copies are why a photo could not be
 * removed and why picking again replaced everything already attached instead of
 * adding to it.
 *
 * Object URLs are created once per file and revoked when it goes: the previous
 * version called `URL.createObjectURL` inside render, leaking one blob URL per
 * thumbnail per re-render.
 */
export default function SelectFiles({ files, onChange, max = PHOTOS_MAX }: SelectFilesProps) {
    const { t } = useT();
    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
    useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

    const add = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) {
            return;
        }
        onChange([...files, ...Array.from(e.target.files)].slice(0, max));
        // Lets the same file be picked again after it has been removed.
        e.target.value = "";
    };

    const actions = (
        <div className="photo-picker__actions">
            <button type="button" className="photo-picker__btn photo-picker__btn--key" onClick={() => cameraRef.current?.click()}>
                <CameraIcon size={18} />
                {t("photos.take")}
            </button>
            <button type="button" className="photo-picker__btn" onClick={() => galleryRef.current?.click()}>
                <GalleryIcon />
                {t("photos.fromGallery")}
            </button>
        </div>
    );

    return (
        <div className="photo-picker">
            {files.length === 0
                ? <div className="photo-picker__zone">
                    <CameraIcon />
                    <p className="photo-picker__title">{t("photos.zoneTitle")}</p>
                    <p className="photo-picker__limit">{t("photos.limit", { max })}</p>
                    {actions}
                </div>
                : <>
                    <div className="photo-picker__row">
                        {files.map((file, index) => (
                            <div key={`${file.name}-${file.lastModified}-${index}`} className="photo-picker__item">
                                <img className="photo-picker__thumb" src={previews[index]} alt="" />
                                <button
                                    type="button"
                                    className="photo-picker__remove"
                                    aria-label={t("common.remove")}
                                    onClick={() => onChange(files.filter((_, i) => i !== index))}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="photo-picker__foot">
                        {files.length < max && actions}
                        <span className="photo-picker__count">{t("photos.count", { n: files.length, max })}</span>
                    </div>
                </>
            }

            {/* Two inputs rather than one: `capture` cannot be toggled per click,
                it is what the browser reads when the dialog opens. */}
            <input ref={cameraRef} type="file" className="visually-hidden" accept="image/*" capture="environment" multiple onChange={add} />
            <input ref={galleryRef} type="file" className="visually-hidden" accept="image/*" multiple onChange={add} />
        </div>
    );
}
