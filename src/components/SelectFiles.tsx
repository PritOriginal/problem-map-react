import { ChangeEvent, useId, useState } from "react";

interface SelectFilesProps {
    onSelectedFiles?: (files: File[]) => void;
}


export default function SelectFiles({ onSelectedFiles }: SelectFilesProps) {
    const [files, setFiles] = useState<File[]>([]);

    const onChangeHandle = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setFiles(files);
            onSelectedFiles?.(files);
        }
    }

    const id = useId();
    return (
        <>
            <label className="photo add" htmlFor={id}>
                <input
                    type="file"
                    id={id}
                    style={{ display: 'none' }}
                    onChange={onChangeHandle}
                    multiple
                    accept="image/*"
                />
                <div className="">
                    +
                </div>
            </label>
            {files.map((file, index) => (
                <img key={index} className="photo" src={URL.createObjectURL(file)} alt="" />
            ))}
        </>
    );
}
