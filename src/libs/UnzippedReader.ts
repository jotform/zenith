import JSZip from "../types/JSZip";

class UnzippedReader {
    jszipObject: JSZip;
    file_list: string[];

    constructor(jszip: JSZip) {
        this.jszipObject = jszip;
        this.file_list = [];
        const fileArr = Object.values(jszip.files);
        fileArr.forEach((file: JSZip.JSZipObject) => {
            if (!file.dir) {
                this.file_list.push(file.name);
            }
        });
    }

    contents() {
        return this.file_list;
    }

    async read(_path: string, type: "nodebuffer" | "text"): Promise<Buffer | string> {
        if (this.file_list.includes(_path)) {
            const file = this.jszipObject.file(_path);
            if (file) {
                return file.async(type).then((data: Buffer | string) => {
                    return data;
                });
            }
            return Promise.reject(`File ${_path} not found`);
        }
        return Promise.reject(`File ${_path} not found`);
    }
}

export default UnzippedReader;